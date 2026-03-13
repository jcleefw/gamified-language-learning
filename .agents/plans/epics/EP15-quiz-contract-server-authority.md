# EP15 - Quiz Contract: Server-Side Answer Authority

**Created**: 20260313T000000Z
**Status**: Impl-Complete

<!-- Status: Draft | Accepted | In Progress | Impl-Complete | BDD Pending | Completed | Shelved | Withdrawn -->

**Type**: Epic Plan
**Depends on**: EP13
**Parallel with**: N/A
**Predecessor**: EP13 (breaking change to EP13 contract)

---

## Problem Statement

EP13 delivered `POST /api/srs/batch` and `POST /api/srs/answers`, but the quiz loop is not trustworthy:

- `/batch` returns questions with no `choices` — a client cannot render a multiple-choice question.
- `/answers` accepts `correct: boolean` from the client — the server cannot verify correctness; a client can trivially cheat.
- The batch registry stores only `QuizQuestion[]`, so even if the server wanted to check the answer, it has no record of what the correct key was.

The server must own the quiz from question generation through correctness verification. This epic implements the ADR decision: server generates choices, withholds the answer, and determines correctness when answers are submitted.

## Scope

**In scope**:

- `@gll/api-contract` wire type updates:
  - `QuizQuestion` gains `choices: Record<string, string>` (e.g. `{ a: "ก", b: "ข", c: "ค", d: "ง" }`)
  - `QuizAnswer.correct: boolean` → `QuizAnswer.selectedKey: string`
  - `AnswerResultPayload` gains `submittedKey: string` and `correctKey: string`
- Batch registry internal type: `BatchEntry { questions: QuizQuestion[]; correctKeys: Record<string, string> }` replaces bare `QuizQuestion[]`
- `POST /api/srs/batch` updates:
  - Pool size validation: reject with `INSUFFICIENT_WORD_POOL` if pool has < 4 unique words
  - Distractor generation: 3 random `targetText` values from pool (excluding correct word), shuffled with correct answer into `a/b/c/d` slots
  - Store `correctKeys` map (`wordId → correctKey`) in batch registry alongside questions
  - Return `choices` in each `QuizQuestion`; do **not** return the correct key
- `POST /api/srs/answers` updates:
  - Accept `selectedKey: string` per answer (breaking: removes `correct: boolean`)
  - Look up `correctKey` from batch registry for each `wordId`
  - Determine `correct` server-side (`selectedKey === correctKey`)
  - Return `submittedKey` and `correctKey` in each `AnswerResultPayload`
- `POST /api/srs/seed` update: return `deckId` in response body (removes console-log dependency)
- Update E2E integration test to use new wire shapes

**Out of scope**:

- Quiz runner script — EP16
- `word_block` and `audio` question types generating choices — multiple choice only for this epic
- Per-user state, auth, persistence

---

## Stories

### Phase 1: API Contract (EP15-PH01)

### EP15-ST01: Update `@gll/api-contract` wire types

**Scope**: In `packages/api-contract/src/srs.ts` — add `choices: Record<string, string>` to `QuizQuestion`; replace `correct: boolean` with `selectedKey: string` on `QuizAnswer`; add `submittedKey: string` and `correctKey: string` to `AnswerResultPayload`. Add a `SeedPayload` export interface `{ deckId: string; seedId?: string; wordCount: number; phase: MasteryPhase }` for the `/seed` response. No server changes in this story — contract only.

### Phase 2: Server Implementation (EP15-PH02)

### EP15-ST02: Update `/api/srs/batch` — distractor generation + pool validation

**Scope**: In `apps/server/src/routes/srs.ts` — update `POST /batch` handler: validate word pool has ≥ 4 unique `targetText` values (return `INSUFFICIENT_WORD_POOL` 400 error if not); for each question, generate 3 random distractors from the pool excluding the correct word and shuffle with the correct answer into `a/b/c/d` keys; update batch registry internal type to `BatchEntry { questions: QuizQuestion[]; correctKeys: Record<string, string> }` and store `wordId → correctKey` map; include `choices` in each `QuizQuestion` in the response. Update `apps/server/src/state/batchRegistry.ts` to store and retrieve `BatchEntry` instead of `QuizQuestion[]`.

### EP15-ST03: Update `/api/srs/answers` + `/seed` + integration tests

**Scope**: In `apps/server/src/routes/srs.ts` — update `POST /answers` handler: read `selectedKey` from each answer; look up `correctKey` from `BatchEntry.correctKeys` for each `wordId`; compute `correct = selectedKey === correctKey`; include `submittedKey` and `correctKey` in each `AnswerResultPayload`. Update `POST /seed` handler: return `deckId` in response body using `SeedPayload` wire type. Update the EP13 E2E integration test to send `selectedKey` values, assert `choices` are present on questions, and assert `submittedKey`/`correctKey` in results.

---

## Overall Acceptance Criteria

- [ ] `POST /api/srs/batch` response includes `choices: { a, b, c, d }` on every `multiple_choice` question
- [ ] Correct answer key is **not** present in the `/batch` response body
- [ ] `POST /api/srs/batch` returns `400 INSUFFICIENT_WORD_POOL` when pool has < 4 unique words
- [ ] `POST /api/srs/answers` accepts `selectedKey` per answer (old `correct: boolean` shape is rejected by TypeScript)
- [ ] Server determines `correct` independently — submitting any key returns a real verdict with `correctKey` in the response
- [ ] `POST /api/srs/seed` response includes `deckId` in the JSON body
- [ ] `pnpm test` green for `apps/server` and `packages/api-contract`
- [ ] `pnpm typecheck` green across the monorepo
- [ ] Postman flow: seed → batch → answers with a wrong key → response shows `correct: false` and reveals `correctKey`

---

## Dependencies

- EP13 — SRS routes + in-memory state (base implementation being extended)
- EP11 — `@gll/api-contract` package (wire types updated in ST01)

## Next Steps

1. Review and approve plan
2. Implement ST01 (contract) → ST02 (batch) → ST03 (answers + seed + tests)
3. Verify via Postman after ST03 before starting EP16
