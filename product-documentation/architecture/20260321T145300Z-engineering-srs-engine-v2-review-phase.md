# ADR: SRS Engine v2 — Review Phase

**Date**: 20260321T145300Z
**Status**: Accepted

<!-- Status: Accepted | Superseded | Deprecated -->

**Superseded by**: N/A
**Epic**: EP21
**RFC**: N/A

---

## Context

EP20 built and verified the Learning phase of `srs-engine-v2` (streak-driven mastery 0–5,
sliding active window, multi-deck support). When a word reaches `mastery >= masteryThreshold`
it is retired from the Learning loop — but there is no phase to receive it. The Review phase
is the missing half: bringing graduated words back at day-scale intervals to cement long-term
retention.

EP20's Learning phase and FSRS's own "Learning" state overlap conceptually but serve
different purposes:

| | EP20 Learning phase | FSRS `Learning` / `Relearning` state |
|---|---|---|
| Time scale | Session-bound (minutes) | Within-day (minutes → hours) |
| Mechanic | Streak-driven mastery 0–5 | Fixed learning steps before Review promotion |
| Purpose | Initial acquisition drilling | Short-term consolidation before Review |

Bolting FSRS on naively would create **two competing Learning systems**. The solution is
to bypass FSRS's own short-term learning steps entirely and use it as a pure day-scale
interval scheduler only.

---

## Decision

### 1. Use `ts-fsrs` with `enable_short_term: false`

FSRS's within-day learning steps are disabled. With this flag, every card — even on its
first Review — is scheduled in days, not minutes. The effective state machine becomes:

```
New → Review ⟷ Relearning
```

EP20 owns the `New → Mastered` journey (Learning phase).
FSRS owns the `Mastered → Due` journey (Review phase).

These two phases do not overlap.

### 2. `ReviewScheduler` abstraction — FSRS is one implementation

All Review logic goes through a domain interface. `ts-fsrs` is never imported outside the
adapter file.

```ts
// src/types/review-scheduler.ts  ← no ts-fsrs import
type ReviewRating = 'again' | 'hard' | 'good' | 'easy';

interface GraduationPerformance {
  correctStreak: number;  // final streak at graduation
  lapses: number;         // times mastery dropped during Learning
  correctRatio: number;   // correct / seen
}

interface ReviewCard {
  wordId: string;
  due: Date;
  schedulerData: unknown; // opaque — the scheduler owns this completely
}

interface ReviewScheduler {
  seed(wordId: string, perf: GraduationPerformance): ReviewCard;
  schedule(card: ReviewCard, rating: ReviewRating, now: Date): ReviewCard;
  isDue(card: ReviewCard, now: Date): boolean;
}
```

```ts
// src/scheduler/fsrs-scheduler.ts  ← ts-fsrs ONLY imported here
import { fsrs, generatorParameters, ... } from 'ts-fsrs';

export class FsrsScheduler implements ReviewScheduler { ... }
```

Swapping the scheduler in `main-review.ts`:
```ts
const scheduler = new FsrsScheduler(); // ← change this one line only
await runReviewSession(scheduler, ...);
```

The review runner, persistence layer, and tests are untouched by a scheduler swap.

### 3. `ReviewCard.schedulerData` is opaque

The calling layer and persistence util never inspect or mutate `schedulerData`. The
scheduler reads and writes its own state through this field. For `FsrsScheduler`, this
contains the full `ts-fsrs` `Card` object (stability, difficulty, state, reps, lapses, etc.)
serialised as JSON.

This makes the schema persistence-agnostic: a future custom scheduler stores different
fields in the same column without any schema change.

### 4. FSRS entry triggered at end of Learning run (not lazily)

When `runAdaptiveLoop` completes (all words mastered), for each graduated word:

1. Compute `GraduationPerformance` from final `WordState`
2. Call `scheduler.seed(wordId, perf)` → initial `ReviewCard`
3. Persist `ReviewCard` to the store

**Not** on lazy first demand. The Learning run is the producer; the Review runner is the
consumer. There is no ambiguity about whether a graduated word has a card.

### 5. Initial FSRS rating derived from `WordState` at graduation

Rather than seeding with a cold default, graduation performance informs the initial
stability. Mapping (thresholds to be calibrated empirically):

| Signal | Rating | Effect |
|---|---|---|
| High final `correctStreak`, zero `lapses` | `Easy` | Higher initial stability → longer first interval |
| Moderate streak, 1–2 mastery drops | `Good` | Standard initial stability |
| Low streak, multiple mastery drops, low `correct/seen` | `Hard` | Lower initial stability → shorter first interval |

### 6. Ongoing review rating inferred from response time

No self-rating UI. No user prompt. Rating is automatic:

| Response time | Rating |
|---|---|
| Wrong answer | `Again` |
| Correct, < 2s | `Easy` |
| Correct, 2–5s | `Good` |
| Correct, > 5s | `Hard` |

Thresholds are configurable constants in `main-review.ts`. `shownAt` timestamp is set when
a question is displayed; delta to answer time determines the rating.

### 7. `lapses` counter added to `WordState`

A `lapses: number` field is added to track how many times `mastery` has decremented
during Learning (i.e. a wrongStreak triggered a mastery drop). This feeds graduation
seeding and future lapse-threshold mechanics (OQ1 in EP21).

```ts
interface WordState {
  // ... existing fields
  lapses: number; // increments each time mastery decrements
}
```

### 8. `WordState` extended with optional `reviewCard`

At graduation, the word's `WordState` gains a reference to its `ReviewCard`:

```ts
interface WordState {
  // ... existing fields
  lapses: number;
  reviewCard?: ReviewCard; // populated at graduation; absent during Learning
}
```

`reviewCard` is absent (`undefined`) while the word is in Learning. Its presence signals
that the word has graduated and has a Review schedule.

### 9. Persistence: SQLite locally, D1 remotely

```sql
CREATE TABLE IF NOT EXISTS review_cards (
  word_id        TEXT PRIMARY KEY,
  due            TEXT NOT NULL,      -- ISO 8601 date string
  scheduler_data TEXT NOT NULL       -- JSON blob, opaque to persistence layer
);
```

- Local runner: `better-sqlite3` writing to `data/review-state.db`
- Remote (future): Cloudflare D1 — identical SQL dialect, zero schema change
- **No JSON file intermediate step**: SQLite and D1 share the same path; a JSON step
  would add a migration with no benefit

### 10. Write-on-answer semantics

Each answered card in a Review session is persisted **immediately** after the answer is
processed — not batched at session end. An early exit or crash does not lose answered
progress. The next session loads remaining due cards naturally.

### 11. Two review modes; deck-scoped and pool-global

```
pnpm reviewv2  →  mode selection
  (a) Deck Review  — due words for a selected deck (getDueForDeck)
  (b) Pool Review  — all due words globally, ordered by due ASC (getDue)
```

Both modes use the same scheduler and persistence layer. Mode is a query filter only.

---

## Consequences

**Positive**:

- FSRS and EP20's Learning phase are cleanly non-overlapping — no dual learning state
- `ReviewScheduler` abstraction means FSRS can be swapped with one line change and zero
  test rewrites
- Opaque `schedulerData` field lets the persistence schema survive a scheduler replacement
  without migration
- SQLite → D1 is a config swap, not a migration rewrite
- Write-on-answer means partial sessions are always safe
- Graduation seeding uses real performance data, not cold FSRS defaults

**Negative**:

- `enable_short_term: false` means FSRS's within-day consolidation steps are bypassed.
  For a word that fails review, the next due date is measured in days, not minutes.
  This may be too lenient for recently-failed words — mitigated by the lapse fallback
  mechanism (OQ1 in EP21) once designed.
- Response time thresholds (2s / 5s) are estimates. Will need empirical tuning against
  real usage data. Miscalibration risks under- or over-rating answers.
- `lapses` counter is a new field on every `WordState`. Existing persisted state (if any)
  would need a migration default of `0`.

**Neutral**:

- `better-sqlite3` is a new runtime dependency. Synchronous API matches the existing
  blocking readline runner style.
- `ts-fsrs` v5+ is already listed as a dependency in `package.json` — no new install
  needed for FSRS itself.
- `pnpm reviewv2` is a separate entry point from `pnpm quizv2` — no changes to the
  Learning runner.

---

## Alternatives Considered

| Option | Pros | Cons | Why Not |
|---|---|---|---|
| Use FSRS with `enable_short_term: true` (default) | Full FSRS learning step coverage | Two competing Learning systems (EP20 + FSRS short-term) | Conceptual conflict; EP20 already owns this phase |
| JSON file for persistence | Zero dependency | No query capability, no sorting, two migrations to reach D1 | SQLite is only marginally harder and halves the migration path |
| Self-rating prompt (Again/Hard/Good/Easy shown to user) | More accurate rating | UX change; adds friction to every correct answer | Response time inferred rating achieves the same without UI change |
| Merge `ReviewCard` into FSRS `Card` type directly | One fewer mapping type | Ties persistence schema to ts-fsrs internals; scheduler swap breaks schema | Opaque `schedulerData` preserves schema stability across scheduler changes |
| Pool-global `ReviewCard` only (no deck-scoped mode) | Simpler query | Loses the deck structure established in EP20 | Deck-scoped review mirrors the Learning session UX; pool mode is additive |

---

## Open Questions

*(Tracked in EP21 — listed here for completeness)*

| # | Question |
|---|---|
| OQ1 | Review → Learning re-entry: lapse count threshold, mastery reset level, card disposition after re-entry |
| OQ2 | Partial session resume UX: does `pnpm reviewv2` reload remaining due cards or require user action? |
| OQ3 | Per-word-type mastery thresholds (5 foundational / 10 curated) — EP21 or later? |
| OQ4 | Stuck word shelving in Review phase |
| OQ5 | Graduation seeding thresholds: exact breakpoints for Easy / Good / Hard mapping |
| OQ6 | Deck isolation vs pool-global `ReviewCard`: one card per `wordId` or one per `(wordId, deckId)`? |

---

## Related

- [SRS Engine v2 Learning Phase ADR](20260319T000000Z-engineering-srs-engine-v2-learning-phase.md)
- [Original SRS Engine ADR (superseded)](20260302T160536Z-engineering-srs-engine-package.md)
- [EP21 Epic Plan](../../.agents/plans/epics/EP21-srs-engine-v2-revision-phase.md)
- [SRS Scheduling Libraries Research](../research/20260319T000000Z-srs-scheduling-libraries.md)
- [Original ADR Gap Analysis](../research/20260321T145300Z-adr-gap-original-srs-engine.md)
