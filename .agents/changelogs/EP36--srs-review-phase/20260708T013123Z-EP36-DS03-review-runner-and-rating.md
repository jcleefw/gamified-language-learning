# EP36-DS03: Review Runner, Rating Inference & Graduation Wiring Specification

**Date**: 20260708T013123Z
**Status**: Draft
**Epic**: [EP36 - SRS Review Phase](../../plans/epics/EP36-srs-review-phase.md)

**Depends on**: [DS01](20260708T011607Z-EP36-DS01-review-scheduler-package.md) (`FsrsScheduler`), [DS02](20260708T012724Z-EP36-DS02-review-store-persistence.md) (`SqliteReviewStore`)
**Architecture**: [Review Phase Packaging ADR](../../../product-documentation/architecture/20260708T005635Z-engineering-srs-review-phase-packaging.md) (D3, D5, D6)

---

## 1. Feature Overview

This DS covers **Phase 3 (EP36-PH03)**: the application layer that wires the scheduler (DS01) and
the store (DS02) into a working Review loop. Everything here is **app-layer orchestration**, not
library code — it lives in `apps/cli-demo-db` (which already depends on `@gll/db` and
`@gll/srs-engine-v2`, and already drives the Learning loop via `learning-runner-db.ts`).

This DS has two tracks that share the same scheduler/store/rating logic:

**Track A — CLI runner** (`apps/cli-demo-db`, headless dev harness):

1. **Graduation seeding** — turn the existing `onGraduation` hook (today a `console.log` at
   [`learning-io.ts:444`](../../../apps/cli-demo-db/src/learning-io.ts)) into "seed a `ReviewCard`
   and persist it."
2. **Review runner** — `review-runner-db.ts` (`engine:review` script), deck-scoped and pool-global
   modes, write-on-answer.
3. **Rating inference** — response-time → `ReviewRating`, generous per the ADR; the user is never
   asked (D5). No manual "mark as hard" (D6 — deferred).
4. **Mock seeder** — populate due-now cards for testing the runner without a full Learning run.

**Track B — Server-authority path for `@gll/srs-demo`** (the interactive Vue demo). `srs-demo` is
a frontend that talks to `@gll/server` over `/api` (EP15 server-authority) and never touches
`@gll/db` or `ts-fsrs`. So surfacing Review in the demo means: review **DTOs** in
`@gll/api-contract`, a review **route** in `@gll/server` (which owns the scheduler + store), and a
Review **mode** in the frontend. Rating inference runs **server-side** (the server is the
authority); the frontend only measures and sends `latencyMs`.

**Homes**: Track A → `apps/cli-demo-db/src/` (add `@gll/srs-review` dep). Track B → `@gll/api-contract`,
`apps/server/src/routes/`, `apps/srs-demo/src/` (server adds `@gll/srs-review` dep). The EP36
`pnpm reviewv2` label maps to the CLI `engine:review` script (existing `engine:real-db` convention).

**Shared rating logic**: `inferReviewRating` (§3) is needed by both the CLI runner (ST08) and the
server route (ST11). It is a small pure function; **recommendation** — define it once and import it
in both, rather than duplicate. The cleanest shared home without a new package is
`@gll/api-contract` (both server and, if ever needed, frontend already depend on it, and the
threshold bands are arguably part of the review contract). If that feels like logic-in-contract
creep, duplicate the ~6-line function per app. Decide at ST08/ST11; either way the scheduler
package stays inference-free (ADR D5).

---

## 2. Core Requirements

| Requirement | Decision | Rationale |
| --- | --- | --- |
| Runner location | `apps/cli-demo-db/src/review-runner-db.ts` | Already wires `db` + engine; mirrors `learning-runner-db.ts` |
| Scheduler instance | `new FsrsScheduler()` constructed once in the runner | One swap point (ADR); pass to seed + schedule |
| Graduation seed | In `onGraduation`, map each graduated `WordState` → `GraduationPerformance` → `scheduler.seed` → `reviewStore.upsertReviewCard` | Producer/consumer split (ADR §4); mapping is app-layer (RULES.md) |
| `WordState → GraduationPerformance` | Pure helper `toGraduationPerformance(ws)` | The cross-package mapping `srs-review` must not do itself |
| Rating source | **Inferred**, never prompted; wrong → `again`, correct → `easy`/`good`/`hard` by response time | ADR D5 |
| Thresholds | Generous defaults `≤4s easy`, `4–12s good`, `>12s hard`; configurable constants | ADR D5; calibration-ready |
| `shownAt` | Set when a review question is displayed; `answeredAt − shownAt` = latency | ADR D5 |
| Auto mode | Simulated latency (default band → `good`) so the loop is exercisable headlessly | Matches existing `AUTO_MODE` demo pattern |
| Persistence timing | `upsertReviewCard` immediately after each answer | Write-on-answer (ADR §10); safe early exit |
| Review modes | (a) deck-scoped `getDueReviewCardsForDeck`, (b) pool-global `getDueReviewCards` | ADR §11 |
| Question building | Reuse engine word-MC composer to build a question per due word | Review cards are graduated *vocabulary*; word MC only |
| Zero-due UX | Clean message + exit when no cards due | EP36 edge-case acceptance criterion |
| No Learning re-entry | A lapse (`again`) only reschedules the card; never touches Learning state | EP36 guarantee |

---

## 3. Data Structures

App-layer helpers (no new library types):

```typescript
// apps/cli-demo-db/src/review-rating.ts
import type { ReviewRating } from '@gll/srs-review';

export interface RatingThresholds {
  easyMaxMs: number; // ≤ this (correct) ⇒ easy
  goodMaxMs: number; // ≤ this (correct) ⇒ good; above ⇒ hard
}

// Generous defaults (ADR D5) — calibrate against real timing data.
export const DEFAULT_RATING_THRESHOLDS: RatingThresholds = {
  easyMaxMs: 4_000,
  goodMaxMs: 12_000,
};

/** Wrong ⇒ again. Correct ⇒ easy/good/hard by latency. User is never asked. */
export function inferReviewRating(
  wasCorrect: boolean,
  latencyMs: number,
  thresholds: RatingThresholds = DEFAULT_RATING_THRESHOLDS,
): ReviewRating {
  if (!wasCorrect) return 'again';
  if (latencyMs <= thresholds.easyMaxMs) return 'easy';
  if (latencyMs <= thresholds.goodMaxMs) return 'good';
  return 'hard';
}
```

```typescript
// apps/cli-demo-db/src/graduation-performance.ts
import type { WordState } from '@gll/srs-engine-v2';
import type { GraduationPerformance } from '@gll/srs-review';

/** App-layer mapping: Learning WordState → Review seed input. */
export function toGraduationPerformance(ws: WordState): GraduationPerformance {
  return {
    correctStreak: ws.correctStreak,
    lapses: ws.lapses,
    correctRatio: ws.seen > 0 ? ws.correct / ws.seen : 0,
  };
}
```

---

## 4. User Workflows

```
GRADUATION (inside the Learning run, learning-runner-db.ts)
  onGraduation(graduatedWordIds, runState):
    for wordId in graduatedWordIds:
      ws   = runState.get(wordId)
      perf = toGraduationPerformance(ws)
      card = scheduler.seed(wordId, perf, now)
      await reviewStore.upsertReviewCard(USER_ID, card)

REVIEW SESSION (review-runner-db.ts, `engine:review`)
  mode = deck | pool
  due  = mode==deck ? getDueReviewCardsForDeck(USER_ID, DECK_ID, now)
                    : getDueReviewCards(USER_ID, now)
  if due.empty: print "Nothing due 🎉"; exit 0
  for card in due:
     question = buildWordQuestion(card.wordId)
     shownAt  = now()
     answer   = strategy.answer(question)          # auto or interactive
     latency  = now() - shownAt
     rating   = inferReviewRating(answer.correct, latency)
     next     = scheduler.schedule(card, rating, now())
     await reviewStore.upsertReviewCard(USER_ID, next)   # write-on-answer
```

---

## 5. Stories

### Phase 3: Review Runner & Integration (EP36-PH03)

### EP36-ST06: Graduation seeding hook

**Scope**: Wire `onGraduation` to seed + persist review cards. Add the mapping helper.
**Read List**:
- `apps/cli-demo-db/src/learning-runner-db.ts` (the `onGraduation` arg, currently logging)
- `apps/cli-demo-db/src/learning-io.ts` L289–L444 (`runAdaptiveLoop` + where `onGraduation` fires)
- `packages/srs-review/src/types.ts` (`GraduationPerformance`), DS01 §3

**Tasks**:
- [ ] Add `@gll/srs-review` to `apps/cli-demo-db/package.json`; `pnpm install`
- [ ] Create `src/graduation-performance.ts` with `toGraduationPerformance` (§3)
- [ ] In `learning-runner-db.ts`: construct `const scheduler = new FsrsScheduler()` and `const reviewStore = new SqliteReviewStore(db)`
- [ ] Replace the logging `onGraduation` with: for each `wordId`, read `WordState` from `runState`, map, `scheduler.seed`, `await reviewStore.upsertReviewCard(CLI_USER_ID, card)`
- [ ] Unit test `toGraduationPerformance` (streak/lapses passthrough; `correctRatio` incl. `seen===0 ⇒ 0`)

**Acceptance Criteria**:
- [ ] After a Learning run graduates words, `review_cards` holds one row per graduated word for `cli-user`, each with a future `due`
- [ ] A word that does **not** graduate produces no review card
- [ ] `pnpm --filter cli-demo-db typecheck` + `test` pass

### EP36-ST07: Review runner — deck-scoped & pool-global

**Scope**: New `review-runner-db.ts` + `engine:review` script. Write-on-answer loop.
**Read List**:
- `apps/cli-demo-db/src/learning-runner-db.ts` (runner skeleton, `getDb`, `DbClient`, constants)
- `apps/cli-demo-db/src/auto-answer-strategy.ts` (strategy interface for auto/interactive)
- `packages/db/src/index.ts` (`SqliteReviewStore` from DS02)
- Engine word-MC composer export (build a question per due word)

**Tasks**:
- [ ] Create `src/review-runner-db.ts`: open db, `new SqliteReviewStore(db)`, `new FsrsScheduler()`, `CLI_USER_ID`/`DECK_ID` as in the Learning runner
- [ ] Mode selection (env or arg): `deck` → `getDueReviewCardsForDeck`, `pool` → `getDueReviewCards`
- [ ] Zero-due: print a friendly message and exit `0`
- [ ] For each due card: build a word-MC question, answer via strategy, infer rating (ST08), `scheduler.schedule`, `upsertReviewCard` immediately
- [ ] Add `"engine:review": "tsx src/review-runner-db.ts"` to `package.json`
- [ ] `closeDb()` on exit; early exit leaves already-answered cards persisted

**Acceptance Criteria**:
- [ ] `pnpm --filter cli-demo-db engine:review` runs a session over due cards and pushes their `due` into the future (verify via `getReviewCard`)
- [ ] Deck mode returns only in-deck due words; pool mode returns all due words ordered by `due` asc
- [ ] Interrupting mid-session leaves answered cards persisted and unanswered cards still due
- [ ] Zero due cards → clean message, exit 0, no error

### EP36-ST08: Response-time → rating inference

**Scope**: Pure inference helper + wiring into the runner. No UI prompt.
**Read List**:
- ADR D5 (rating policy), this DS §3
- `apps/cli-demo-db/src/review-runner-db.ts` (from ST07)

**Tasks**:
- [ ] Create `src/review-rating.ts` with `RatingThresholds`, `DEFAULT_RATING_THRESHOLDS`, `inferReviewRating` (§3)
- [ ] Runner sets `shownAt` before presenting each question; computes `latencyMs` at answer
- [ ] Auto mode supplies a simulated latency (configurable; default lands in the `good` band)
- [ ] Unit tests: wrong ⇒ `again` regardless of latency; boundaries `4000ms ⇒ easy`, `4001ms ⇒ good`, `12000ms ⇒ good`, `12001ms ⇒ hard`

**Acceptance Criteria**:
- [ ] No self-rating prompt exists anywhere in the runner
- [ ] Correct + fast ⇒ `easy`; correct + mid ⇒ `good`; correct + slow ⇒ `hard`; wrong ⇒ `again`
- [ ] Thresholds are a single configurable constant (generous defaults); changing them needs no scheduler/store change

### EP36-ST09: Mock review seeder

**Scope**: Script to seed due-now cards for testing the runner in isolation.
**Read List**:
- `apps/cli-demo-db/src/db-tools.ts` / `db-tools-cli.ts` (existing seed pattern)
- DS01 §A (`FsrsScheduler.seed`), DS02 (`upsertReviewCard`)

**Tasks**:
- [ ] Add a `seed reviews` subcommand (or `src/seed-mock-reviews.ts`) that seeds a few fixed `wordId`s via `scheduler.seed`, then forces their `due` to `now` and `upsertReviewCard`s for `cli-user`
- [ ] Add a `package.json` script (e.g. `engine:review:seed`)

**Acceptance Criteria**:
- [ ] Running the seeder then `engine:review` presents the seeded words as due
- [ ] Seeded cards carry valid `schedulerData` that `FsrsScheduler.schedule` accepts (no throw)

### Phase 4: Server-Authority Review Path for `srs-demo` (EP36-PH04)

> Track B. Server owns the scheduler + store + rating inference; the frontend is a thin client.

### EP36-ST10: Review DTOs in `@gll/api-contract`

**Scope**: Contract types only — no logic.
**Read List**:
- `packages/api-contract/src/srs.ts` (existing DTO + `ApiResponse<T>` style)
- DS01 §3 (`ReviewCard`), DS02 §3 (store methods)

**Tasks**:
- [ ] Add to `src/srs.ts`: `ReviewCardPayload { wordId: string; due: string /* ISO */ }`; `ReviewQuestionPayload` (word-MC question shape reused from the existing quiz DTO); `GetDueReviewsResponse { questions: ReviewQuestionPayload[] }`; `SubmitReviewAnswerRequest { wordId: string; correct: boolean; latencyMs: number }`; `SubmitReviewAnswerResponse { wordId: string; due: string }`
- [ ] Export via the `srs.ts` barrel

**Acceptance Criteria**:
- [ ] Types compile and are importable from `@gll/api-contract`
- [ ] No `ts-fsrs` or engine internals leak into the contract (primitives + existing quiz DTOs only)

### EP36-ST11: Server review route + graduation seeding

**Scope**: `apps/server` Hono route + server-side seed on graduation. Server owns FSRS + rating.
**Read List**:
- `apps/server/src/routes/state.ts` (route + `getDb()` + store pattern, `USER_ID = 'demo-user'`)
- `apps/server/src/app.ts` (route mounting under `/api`)
- `packages/db/src/index.ts` (`SqliteReviewStore`), DS02
- `apps/cli-demo-db/src/review-rating.ts` + `graduation-performance.ts` (reuse `inferReviewRating`, `toGraduationPerformance`)

**Tasks**:
- [ ] Add `@gll/srs-review` to `apps/server/package.json`
- [ ] Create `src/routes/review.ts`: `new SqliteReviewStore(getDb())`, `new FsrsScheduler()`
- [ ] `GET /api/review/due` (optional `?deckId=`) → `getDueReviewCards` / `getDueReviewCardsForDeck` for `demo-user`, build a word-MC question per due card, return `GetDueReviewsResponse`
- [ ] `POST /api/review/answer` → validate `SubmitReviewAnswerRequest`, `inferReviewRating(correct, latencyMs)`, `scheduler.schedule`, `upsertReviewCard`, return `SubmitReviewAnswerResponse` (next `due`)
- [ ] Graduation seeding: on the server's learning-answer path, when a word crosses the mastery threshold, `scheduler.seed` + `upsertReviewCard` for `demo-user` (server-side equivalent of ST06)
- [ ] Mount the router in `app.ts` under `/api`

**Acceptance Criteria**:
- [ ] `GET /api/review/due` returns only due cards' questions, deck-filtered when `deckId` given, wrapped in `ApiResponse`
- [ ] `POST /api/review/answer` reschedules + persists and returns the new `due`; invalid body → `ApiResponse` 400 (matching `state.ts`)
- [ ] Rating is inferred server-side; the request carries no rating field
- [ ] A word graduating during a server learning session gets a persisted `ReviewCard`
- [ ] `pnpm --filter @gll/server test` + `typecheck` pass

### EP36-ST12: `srs-demo` Review mode (Vue frontend)

**Scope**: Frontend Review session — thin client over the server route.
**Read List**:
- `apps/srs-demo/src/composables/useStore.ts` (fetch + `ApiResponse` unwrap pattern)
- `apps/srs-demo/src/components/QuizCard.vue` (reuse the question UI)
- `apps/srs-demo/src/App.vue` (mode/entry wiring)

**Tasks**:
- [ ] Create `src/composables/useReview.ts`: `loadDueReviews(deckId?)` → `GET /api/review/due`; `submitReviewAnswer(wordId, correct, latencyMs)` → `POST /api/review/answer`
- [ ] Measure `latencyMs` client-side: record `shownAt` when a review question renders, send delta on answer
- [ ] Add a Review view/entry that reuses `QuizCard`, iterating due questions; empty-due shows a "nothing due" state
- [ ] No `ts-fsrs`, no rating UI, no engine scheduling in the frontend

**Acceptance Criteria**:
- [ ] From the demo, a user can start a Review session, answer due words, and see them removed from the due set (persisted server-side)
- [ ] The frontend sends `latencyMs` but never a rating; it imports neither `ts-fsrs` nor `@gll/db`
- [ ] Zero-due Review shows a clean empty state
- [ ] `pnpm --filter @gll/srs-demo typecheck` passes

---

## 6. Success Criteria

1. A full loop works end-to-end: Learning graduates a word → review card seeded → `engine:review`
   brings it back when due → answering reschedules it → progress persists across runs.
2. Ratings are entirely inferred; no prompt; generous bands mean an ordinary correct answer is `good`.
3. Deck-scoped and pool-global modes both work; zero-due exits cleanly.
4. Write-on-answer holds: an interrupted session never loses answered cards.
5. A lapse (`again`) reschedules within Review only — no Learning re-entry (EP36 guarantee).
6. **Track B**: `srs-demo` has a working Review mode over the server route — due words are fetched,
   answered (with client-measured `latencyMs`), rescheduled server-side, and drop out of the due
   set; the frontend imports neither `ts-fsrs` nor `@gll/db`.
7. No type errors; `cli-demo-db`, `@gll/server`, and `@gll/srs-demo` suites green.

---

## 7. Out of Scope (this DS)

- Explicit "mark as hard" override (ADR D6 — deferred)
- Per-question-type threshold normalisation beyond word MC (review deals with graduated vocabulary)
- Review → Learning re-entry (OQ1), practice/on-demand mode (OQ8)
- Cloudflare **D1** remote persistence (the local SQLite path + Hono route ship here; D1 later)
- BDD/e2e `.feature` coverage for the review flow (add alongside existing srs-demo specs in a follow-up)
