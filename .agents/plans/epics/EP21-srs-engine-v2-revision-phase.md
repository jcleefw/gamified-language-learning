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

### EP21-ST01: Revision Runner + Mock Seeder (Vertical Slice)

**Scope**: To decouple the Revision phase development from the Learning phase, we will implement the Revision auto-answerer runner and a mock seeding script. This lets us generate ready-to-test `ReviewCard` records in SQLite and then run `pnpm reviewv2` (auto mode) to verify that due cards are retrieved, answered, effectively scheduled by FSRS, and persisted back to SQLite.

#### 1. Persistence Layer (`ReviewStore` & `SqliteReviewStore`)
- Domain Type: `ReviewCard` (`wordId`, `due: Date`, `schedulerData: unknown`) — no `ts-fsrs` import.
- Interface: `ReviewStore` with `upsert`, `getByWordId`, `getDue`, `getDueForDeck`, `getAll`.
- Implementation: `SqliteReviewStore` using `better-sqlite3`.
- DB table: `review_cards` (`word_id` TEXT PK, `due` TEXT, `scheduler_data` TEXT). Store dates as ISO 8601.

#### 2. Scheduler Layer (`ReviewScheduler` & `FsrsScheduler`)
- Domain Type: `ReviewScheduler` interface with types `ReviewRating` ('again'|'hard'|'good'|'easy') and `GraduationPerformance`.
- Implementation: `FsrsScheduler` — the **only** place `ts-fsrs` is imported. Initialize FSRS with `enable_short_term: false`. 
- Provide `FsrsScheduler.seed()` to map performance to an initial rating, runs `fsrs.next`, and returns a new `ReviewCard`.
- Provide `FsrsScheduler.schedule()` to take an existing `ReviewCard` and `ReviewRating`, run `fsrs.next`, and return an updated `ReviewCard`.

#### 3. Mock Seeder Script
- Script `src/scripts/seed-mock-reviews.ts` (runnable via `pnpm seed-mocks`).
- Defines a few fixed `wordId`s and simulates graduation by calling `FsrsScheduler.seed()`.
- Manipulates the `dueDate` of the resulting cards so they are actively due *now*.
- Uses `SqliteReviewStore` to persist them to `data/review-state.db`.

#### 4. Revision Mode Runner
- Implement `runReviewSession` in `src/runner/main-review.ts`.
- It connects to `SqliteReviewStore`, calls `getDue(now)`, and iterates through the cards.
- During auto-mode, it uses an `AnswerStrategy` to answer questions, infers a `ReviewRating` based on success, calls `FsrsScheduler.schedule(card, rating)`, and `upsert`s the result back to SQLite.

#### Files Added/Changed

| File | Change |
|---|---|
| `src/types/review-card.ts` | New — `ReviewCard`, `ReviewRating`, `GraduationPerformance` |
| `src/persistence/review-store.ts` | New — `ReviewStore` interface + `SqliteReviewStore` impl |
| `src/scheduler/fsrs-scheduler.ts` | New — `ReviewScheduler` interface + `FsrsScheduler` impl |
| `src/scripts/seed-mock-reviews.ts` | New — Mock seeder script |
| `src/main-review.ts` | New — Entry point for Revision phase |
| `package.json` | Add `better-sqlite3` + `@types/better-sqlite3` |

#### Success criteria

1. We can run `pnpm seed-mocks` to populate `data/review-state.db` with due cards.
2. We can run `pnpm reviewv2` (auto mode) and observe the runner querying, answering, and rescheduling the cards.
3. Querying the DB manually (`sqlite3 data/review-state.db "SELECT * FROM review_cards"`) confirms `due` dates are pushed to the future.
4. `pnpm --filter @gll/srs-engine-v2 test` passes (including new unit tests for persistence/scheduler).

**Status**: To Do

---

### Stories to address (unnumbered — to be sequenced as ST02+ when ST01 is complete)

**`lapses` counter in `WordState` & Graduation Hook**
Later, wire the Learning phase into Revision. Add `lapses: number` to `WordState`, increment on mastery decrement, and implement the graduation hook inside runner at session completion to iterate over mastered words, seed with `FsrsScheduler.seed`, and persist to `SqliteReviewStore`.

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