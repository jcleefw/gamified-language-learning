# EP21 - SRS Engine v2: Revision Phase

**Created**: 20260321T145300Z
**Status**: Draft

<!-- Status: Draft | Accepted | In Progress | Impl-Complete | BDD Pending | Completed | Shelved | Withdrawn -->

**Type**: Epic Plan
**Depends on**: EP20 (all stories complete)
**Parallel with**: N/A
**Predecessor**: EP03 (replaced by this epic)

---

## Problem Statement

EP20 built and verified the Learning phase of `srs-engine-v2`. When a word graduates
(mastery ≥ 5), it currently disappears — there is no Review phase. Words learned are
never revisited.

EP21 builds the Review phase: a separate, day-scale scheduling loop powered by FSRS
(via `ts-fsrs`) that brings graduated words back at optimal intervals to cement long-term
retention.

**Architectural decisions for this epic are documented in the ADR:**
[20260321T145300Z-engineering-srs-engine-v2-review-phase.md](../../product-documentation/architecture/20260321T145300Z-engineering-srs-engine-v2-review-phase.md)

---

## Approach

Same vertical-slice philosophy as EP20:

- Each story has one job, verified before the next begins
- The scheduler sits behind a `ReviewScheduler` interface — FSRS is one implementation
- Review runs as a separate command (`pnpm reviewv2`) — fully decoupled from Learning
- Persistence: SQLite locally (write-on-answer), D1 Cloudflare remotely (later)
- No Hono wiring until the Review engine is proven

---

## Package

`packages/srs-engine-v2/` — extended in-place.

New entry point: `src/main-review.ts` → `pnpm reviewv2`.

---

## Scope

**In scope**:

- `ReviewCard` domain type (no ts-fsrs import)
- `ReviewScheduler` interface (domain types only)
- `FsrsScheduler` implementing `ReviewScheduler` (ts-fsrs isolated here only)
- `ReviewStore` — SQLite persistence for `ReviewCard` (write-on-answer semantics)
- Graduation hook: seed initial `ReviewCard` from `WordState` at Learning run completion
- `lapses` counter added to `WordState` (triggers on mastery decrement)
- Review session runner — deck-scoped (`pnpm reviewv2`)
- Global pool review mode — all due words across all decks
- Response time → FSRS rating inference (configurable thresholds)

**Out of scope** (deferred):

- Review → Learning re-entry on lapse threshold (OQ1)
- Per-word-type mastery thresholds, 5 foundational / 10 curated (OQ3)
- Stuck word shelving (OQ4)
- Hono / D1 wiring (remote persistence)
- Question type distribution — MC only throughout

---

## Stories

### EP21-ST01: SQLite persistence layer for ReviewCard

**Scope**: Introduce a SQLite-backed persistence utility for `ReviewCard` state. Pure I/O —
no FSRS, no scheduler logic. The engine remains side-effect-free; the persistence
utility lives in `src/persistence/`.

#### New type — `src/types/review-card.ts`

```ts
interface ReviewCard {
  wordId: string;
  due: Date;
  schedulerData: unknown; // opaque — the scheduler owns this completely
}
```

No ts-fsrs import. The persistence layer never inspects `schedulerData`.

#### SQLite schema

```sql
CREATE TABLE IF NOT EXISTS review_cards (
  word_id        TEXT PRIMARY KEY,
  due            TEXT NOT NULL,      -- ISO 8601 date string
  scheduler_data TEXT NOT NULL       -- JSON-serialised blob
);
```

D1-compatible: standard SQL, no SQLite-specific extensions.

#### `ReviewStore` interface — `src/persistence/review-store.ts`

```ts
interface ReviewStore {
  upsert(card: ReviewCard): void;
  getByWordId(wordId: string): ReviewCard | null;
  getDue(now: Date): ReviewCard[];
  getDueForDeck(wordIds: string[], now: Date): ReviewCard[];
  getAll(): ReviewCard[];
}
```

Implementation notes:

- `better-sqlite3` (synchronous API — consistent with existing readline runner)
- DB file: `data/review-state.db` (gitignored)
- `upsert` uses `INSERT OR REPLACE`
- `due` stored as ISO 8601 string; parsed to `Date` on read
- `schedulerData` round-trips via `JSON.stringify` / `JSON.parse`
- Constructor accepts a file path (runtime) or `:memory:` (tests)

#### Files

| File | Change |
|---|---|
| `src/types/review-card.ts` | New — `ReviewCard` domain type |
| `src/persistence/review-store.ts` | New — `ReviewStore` interface + `SqliteReviewStore` impl |
| `src/__tests__/unit/review-store.test.ts` | New — unit tests using `:memory:` SQLite |
| `package.json` | Add `better-sqlite3` + `@types/better-sqlite3` |

#### Unit tests — `review-store.test.ts`

- `upsert` creates a new row when word doesn't exist
- `upsert` replaces existing row when word already exists
- `getByWordId` returns `null` for unknown `wordId`
- `getDue` returns only cards where `due <= now`
- `getDue` excludes cards where `due > now`
- `getDueForDeck` returns only the intersection of provided `wordIds` AND `due <= now`
- `getDueForDeck` with empty `wordIds` returns empty array
- `schedulerData` round-trips through JSON without mutation
- `due` dates round-trip correctly as ISO 8601

#### Success criteria

1. `pnpm --filter @gll/srs-engine-v2 test` — all tests pass (including all existing EP20 tests)
2. `ReviewStore` works with both `:memory:` and a real file path
3. No ts-fsrs import anywhere in `src/persistence/` or `src/types/review-card.ts`

**Status**: To Do

---

### Stories to address (unnumbered — to be sequenced as ST02+ when ST01 is complete)

**`ReviewScheduler` interface + `FsrsScheduler` adapter**
Define `ReviewScheduler` interface in `src/types/review-scheduler.ts` (no ts-fsrs import).
Types: `ReviewRating` ('again'|'hard'|'good'|'easy'), `GraduationPerformance`. Implement
`FsrsScheduler` in `src/scheduler/fsrs-scheduler.ts` — ts-fsrs imported here only.
Configured with `enable_short_term: false`.

**`lapses` counter in `WordState`**
Add `lapses: number` to `WordState`. Increments whenever `mastery` decrements (a
wrongStreak triggers a mastery drop). Needed for graduation seeding. Scope: modify
`word-state.ts`, update `updateRunState`, update existing unit tests.

**Graduation hook — seed `ReviewCard` at Learning run completion**
At the end of `runAdaptiveLoop`, for each mastered word: compute `GraduationPerformance`
from final `WordState` (correctStreak, lapses, correct/seen ratio), call
`FsrsScheduler.seed(wordId, perf)`, persist `ReviewCard` via `ReviewStore`. First time
`ReviewStore` is wired into `main.ts`.

**Response time → rating calibration config**
Configurable thresholds in `main-review.ts` for response time → FSRS rating mapping.
Defaults: wrong = `Again`, < 2s correct = `Easy`, 2–5s correct = `Good`,
> 5s correct = `Hard`. `shownAt` timestamp set when question is displayed.

**Review session runner — deck-scoped (`pnpm reviewv2`)**
New entry point `src/main-review.ts`. Deck selection prompt (reuse EP20's `selectDeck`).
Load due cards via `ReviewStore.getDueForDeck`. Quiz loop over due words. Response time
tracked per question. Rating inferred. Each answered card updated and persisted immediately.
Session ends when all due words answered or user exits early; partial completion is safe.

**Global pool review mode**
Second mode selectable in `pnpm reviewv2`. Reviews all due words across all decks, ordered
by `due` ascending (most overdue first). Uses `ReviewStore.getDue()`. All other mechanics
identical to deck-scoped session.

---

## Open Questions

| # | Question | Impact |
|---|---|---|
| OQ1 | **Review → Learning re-entry**: if a Review word accumulates N `Again` ratings, should it fall back to Learning for re-drilling? What is N? What resets (mastery to 0, or a specific level)? Does the `ReviewCard` get deleted or archived? | Core gap from original ADR — not yet designed |
| OQ2 | **Partial session resume UX**: answered words are persisted on-answer. If a session is interrupted, does `pnpm reviewv2` reload remaining due words automatically, or require user action? | Affects runner design |
| OQ3 | **Per-word-type mastery thresholds**: 5 foundational / 10 curated from original ADR. EP20 uses single threshold. EP21 or later? | Affects graduation trigger |
| OQ4 | **Stuck word shelving in Review**: words failing Review but not hitting OQ1 threshold — is there a separate shelving mechanic? | Deferred from EP20 |
| OQ5 | **Graduation seeding thresholds**: exact `correctStreak` / `lapses` breakpoints that map to `Easy` / `Good` / `Hard` on first FSRS seed | Needs empirical calibration |
| OQ6 | **Deck isolation vs pool-global `ReviewCard`**: one card per `wordId` globally, or one per `(wordId, deckId)`? Currently assumed: global. | Affects schema + deck re-check behaviour |
| OQ7 | **Shelving logic in Review phase only** — what does it mean to shelve a word that is already graduated? How does it interact with the `ReviewCard` in SQLite? |
| OQ8 | **Enthusiastic learner problem** — a user who keeps revisiting words and ignores FSRS scheduling. Does the system allow session-on-demand (bypassing due date check)? Does doing so corrupt FSRS stability data? Should there be a "practice mode" vs "scheduled review mode" distinction? |

---

## Overall Acceptance Criteria

- [ ] A word that graduates from Learning has a `ReviewCard` created and persisted to SQLite
- [ ] `pnpm reviewv2` presents only words with `due <= today` for the chosen deck or pool
- [ ] Each answered card is persisted immediately — early exit does not lose progress
- [ ] ts-fsrs is only imported inside `src/scheduler/fsrs-scheduler.ts` — nowhere else
- [ ] Swapping FSRS for a custom scheduler requires changing one line in `main-review.ts`
- [ ] All existing EP20 tests continue to pass unchanged
- [ ] SQLite schema is D1-compatible (standard SQL, no SQLite-specific syntax)

---

## Dependencies

- EP20 complete (ST01–ST11)
- `better-sqlite3` added to package dependencies

## References

- [Review Phase ADR](../../product-documentation/architecture/20260321T145300Z-engineering-srs-engine-v2-review-phase.md)
- [SRS Engine v2 Learning Phase ADR](../../product-documentation/architecture/20260319T000000Z-engineering-srs-engine-v2-learning-phase.md)
- [SRS Scheduling Libraries Research](../../product-documentation/research/20260319T000000Z-srs-scheduling-libraries.md)
- [Original ADR Gap Analysis](../../product-documentation/research/20260321T145300Z-adr-gap-original-srs-engine.md)
- [Design Session: EP20 vs FSRS](../../product-documentation/research/202603211351000Z-gap-srs-enginev2-vs-fsrs.md)
- [EP20 Epic Plan](EP20-srs-engine-v2-rebuild.md)