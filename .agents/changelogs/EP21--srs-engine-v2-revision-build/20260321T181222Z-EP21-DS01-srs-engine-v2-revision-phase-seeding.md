# EP21-DS01: Revision Runner + Mock Seeder ~~[REJECTED]~~

**Date**: 20260321T181221Z
**Status**: ❌ Rejected — 20260321T192000Z
**Rejected by**: Engineering Review + User Review
**Epic**: [EP21 - SRS Engine v2: Revision Phase](../../epics/EP21-srs-engine-v2-revision-phase.md)

> **Note**: This DS was rejected before implementation. Do not use as a basis for coding. A full rewrite is required after EP23 is designed. The findings below are preserved as a record for that rewrite.

---

## 1. Feature Overview

Instead of coupling the initial Review phase development to the Learning phase (`runAdaptiveLoop`), we will build the Review phase in isolation. We will create a mock seeder script to inject mocked graduated words as `ReviewCard` records into our SQLite database. Then, we will build a basic Review session runner (`runReviewSession`) that can read these due cards, present them via an auto-answering strategy (leveraging EP22's logic), and persist the new scheduled dates back to SQLite. This provides a complete, isolated vertical slice of the Revision phase.

## 2. Core Requirements

| Requirement | Decision   | Rationale |
| ----------- | ---------- | --------- |
| Persistence | `better-sqlite3` | Need a crash-safe, synchronous local DB. `review_cards` table maps to FSRS cards. |
| FSRS Isolation | Decorator / Adapter | Keep `ts-fsrs` entirely within `FsrsScheduler`. Engine code shouldn't import it. |
| Seeding Source | Mock Script | A dev script (`seed-review-mock.ts`) will generate `ReviewCards` with manipulated `due` dates (e.g., due today) so we can test the runner. |
| Runner | `runReviewSession` | A new runner loop for the Review phase that evaluates cards, infers ratings based on response time (or mocked response time via strategy), and updates schedule. |

## 3. Data Structures

```typescript
// src/types/review-card.ts
export interface ReviewCard {
  wordId: string;
  due: Date;
  schedulerData: unknown; // Opaque ts-fsrs payload
}

export type ReviewRating = 'again' | 'hard' | 'good' | 'easy';

export interface GraduationPerformance {
  correctStreak: number;
  lapses: number;
  correctRatio: number;
}

// src/persistence/review-store.ts
export interface ReviewStore {
  upsert(card: ReviewCard): void;
  getByWordId(wordId: string): ReviewCard | null;
  getDue(now: Date): ReviewCard[];
  getDueForDeck(wordIds: string[], now: Date): ReviewCard[];
  getAll(): ReviewCard[];
}

// src/types/word-state.ts (modifications)
export interface WordState {
  wordId: string;
  seen: number;
  correct: number;
  mastery: number;
  correctStreak: number;
  wrongStreak: number;
  lapses: number; // NEW
}
```

## 4. User Workflows

```
START → pnpm seed-mocks → Clear existing DB → Mock cards persisted with 'due <= today'
START → pnpm reviewv2 → Prompt user: "Run auto or manual mode?" → Read due cards → Quiz via chosen mode → infer FSRS rating → PERSIST new dates to SqliteStore → END
```

## 5. Stories

### EP21-ST01: Revision Runner + Mock Seeder (Vertical Slice)

**Scope**: End-to-end SQLite persistence, FSRS scheduling adapter, mock seeding script, and a basic Revision auto-answerer runner, bypassing the Learning phase.
**Read List**:
- `packages/srs-engine-v2/src/runner/auto-answerer.ts`
- `packages/srs-engine-v2/src/runner/interactive.ts`

**Tasks**:

- [ ] Implement `ReviewCard`, `ReviewStore`, and `SqliteReviewStore` (with `:memory:` or file path).
      **Acceptance Criteria**:
- [ ] `review-store.test.ts` passes with `:memory:`, confirming CRUD works and JSON dates are round-tripped as `Date` objects correctly.
- [ ] Implement `ReviewScheduler` interface and `FsrsScheduler` Adapter (`ts-fsrs` imported only here). Includes `.seed()` and `.schedule()` methods.
      **Acceptance Criteria**:
- [ ] `fsrs-scheduler.test.ts` passes, confirming rating mapping works based on performance/response time.
- [ ] Write a mock seeder script (e.g. `src/scripts/seed-mock-reviews.ts`) that first clears any existing `ReviewCard` records from SQLite. It then takes fixed mock words, runs them through `FsrsScheduler.seed`, manipulates `due` dates to ensure they are immediately reviewable, and saves to SQLite.
      **Acceptance Criteria**:
- [ ] Running the script truncates the table and populates `data/review-state.db` with fresh due cards, ensuring a clean state for testing.
- [ ] Implement `runReviewSession` (interactive/auto runner) in `src/runner/main-review.ts`. On startup, prompt the user: "Run auto or manual mode?". Then read due cards, quiz them via strategy or interactive input, update their schedule via `FsrsScheduler.schedule()`, and persist back to SQLite.
      **Acceptance Criteria**:
- [ ] Running `pnpm reviewv2` yields a prompt asking the user which mode to run. Both manual and auto modes successfully update `ReviewCard` due dates in `data/review-state.db` to future dates.

## 6. Success Criteria

1. End-to-end validation passes: seeding the database and then running `pnpm reviewv2` (auto mode) successfully clears the due queue and writes future dates to the DB.
2. No type errors.
3. No `ts-fsrs` imports exist outside of `src/scheduler/fsrs-scheduler.ts`.

---

## 7. Rejection Record — Engineering Review (20260321T192000Z)

### AI Engineering Review Findings

**Critical**
- `review-runner.ts` is missing from the file manifest — DS01 doesn't list it as a file despite the TDD plan referencing it. Would cause implementor confusion.
- `deleteAll()` is mentioned in prose but missing from the `ReviewStore` interface definition.

**High**
- Auto-mode rating inference is undefined. The DS assumes a response-time strategy for interactive mode but makes no decision for auto mode. The ADR (§6) is explicit that rating is derived from response time — this doesn't translate to auto mode without a defined mapping rule. DS was silent on this.
- Mock seeder `GraduationPerformance` values are undefined: the seed script fakes graduation but doesn't say what `lapses`/`correctStreak`/`correctRatio` values to use and therefore what initial FSRS rating each seeded card receives.

**Medium**
- `src/scripts/` is a new directory not present in CODEMAP.md.
- `pnpm seed-mocks` was not listed in the package.json file manifest.

---

### User Review Findings (20260321T192000Z)

**Unclear phase-related file structure**
The current `srs-engine-v2` package folder structure and file names were set up for the Learning phase but named generically. Specifically:
- Both runner files in `packages/srs-engine-v2/src/runner/`
- `packages/srs-engine-v2/src/types/answer-strategy.ts`
- `packages/srs-engine-v2/src/main.ts`

These should be renamed and moved to a `learning-phase/` or equivalent scoped folder to avoid confusion when the Revision phase files land.

**ST01 scope is not atomic — story is too large**
The story tries to deliver too many concerns at once:
1. Setup persistent storage
2. Setup Learning phase interaction with persistent store
3. Write Learning results to persistent store
4. Transition from Learning → Revision
5. Run Revision based on mock data

These are 5 separate responsibilities. Even the descoped mock-seeder version still highlights the gap: items 1–4 are pre-conditions that are unaddressed and should belong to an earlier epic.

**Fix**: Create EP23 as pre-requisite for EP21, addressing points 1–4. EP23 must be complete before EP21 ST01 is meaningful.

**Planning without asking clarifying questions**
The AI proceeded with assumptions rather than asking about:
- Store interaction design (who owns the store reference? How is it injected?)
- Rating inference in auto mode — assumption conflicted with the ADR (§6 specifies response-time based rating; auto mode has no response time signal)

**Required outcome**:
- DS01 marked Rejected ✅ (done)
- Rewrite DS01 after EP23 is defined ← pending
- Create EP23 epic next, guided by question-by-question clarification ← next step
