# EP13-DS01: SRS Routes + In-Memory State Specification

**Date**: 20260312T000000Z
**Status**: Draft
**Epic**: [EP13 - `apps/server` — SRS Routes + In-Memory State](.agents/plans/epics/EP13-srs-routes-in-memory-state.md)

---

## 1. Feature Overview

Wire the existing `SrsEngine` and EP08 seed data into the Hono server (EP12) via two HTTP routes. A single in-memory state module (`src/state/`) holds `WordState[]`, a `wordDetail` lookup map, a `SrsEngine` singleton, and a batch registry. Two routes — `POST /api/srs/batch` and `POST /api/srs/answers` — compose batches and process answers, mapping engine-internal types to wire types before returning `ApiResponse<T>`.

**Wire contract gap**: `@gll/api-contract` is missing fields required by EP13. These must be added in ST01 before any route implementation:
- `QuizQuestion` — missing `targetText: string`
- `GetBatchRequest` — missing `deckId: string`
- `BatchPayload` — missing `batchId: string`
- `SubmitAnswersRequest` — missing `batchId: string`
- No batch-level answers response type (acceptance criteria requires `{ processed, updatedWords[] }`)

---

## 2. Core Requirements

| Requirement | Decision | Rationale |
| --- | --- | --- |
| State scope | Module-level singletons, reset on process restart | No persistence until Stage 3 |
| Seed data source | `consonants` (first 5) + `conversations-2026-03-08.json` | Mirrors `quiz-runner.ts` pattern exactly |
| `wordId` key format | `foundational:<id>` / `curated:<native>` | Defined by existing mappers in `data/mappers.ts` |
| Deck ID | `crypto.randomUUID()` generated once at module load, logged to console | Single shared deck; Stage 3 will replace with DB |
| Batch registry | `Map<batchId, QuizQuestion[]>` (wire type) | Holds questions for answer validation; batchId is server-generated UUID |
| `SrsConfig` | Same values as `quiz-runner.ts` (`batchSize: 15`, etc.) | Consistent with existing demo tooling |
| Type mapping | Engine → wire mapping applied in route handler, not in state module | State module stays engine-typed; wire concerns isolated to routes |
| Test framework | Vitest (already in monorepo) | No new tooling |
| HTTP test | Hono's `app.request()` test helper | No port binding needed in tests |

---

## 3. Data Structures

```typescript
// ── api-contract additions (ST01) ──────────────────────────────────────────

// srs.ts updates in @gll/api-contract:

export interface QuizQuestion {
  wordId: string;
  questionType: QuestionType;
  targetText: string;        // ADD: native script for display
}

export interface GetBatchRequest {
  deckId: string;            // ADD: must match seeded deck ID
  size?: number;
}

export interface BatchPayload {
  batchId: string;           // ADD: server-generated UUID for answer submission
  questions: QuizQuestion[];
  batchSize: number;
}

export interface SubmitAnswersRequest {
  batchId: string;           // ADD: references active batch in registry
  answers: QuizAnswer[];
}

// ADD: batch-level answers response
export interface SubmitAnswersResponse {
  processed: number;
  updatedWords: AnswerResultPayload[];
}

// ── State module types (apps/server internal) ──────────────────────────────

interface WordDetail {
  native: string;
  romanization: string;
  english: string;
  category: 'foundational' | 'curated';
}

// src/state/store.ts exports:
// wordStates: WordState[]          — mutable, updated by processAnswers
// wordDetails: Map<string, WordDetail>
// deckId: string                   — UUID, logged on startup

// src/state/batchRegistry.ts exports:
// register(batchId: string, questions: QuizQuestion[]): void
// get(batchId: string): QuizQuestion[] | undefined

// src/state/engine.ts exports:
// engine: SrsEngine                — singleton
```

---

## 4. User Workflows

```
POST /api/srs/batch  { deckId }
  → validate deckId === seeded deckId  (400 if mismatch)
  → engine.composeBatch(wordStates)    (returns engine Batch)
  → map Batch.questions → QuizQuestion[] wire type
      type: 'mc' → 'multiple_choice'
      type: 'wordBlock' → 'word_block'
      type: 'audio' → 'audio'
      add targetText from wordDetails map
  → batchId = crypto.randomUUID()
  → batchRegistry.register(batchId, questions)
  → return 200 ApiResponse<BatchPayload> { batchId, questions, batchSize }

POST /api/srs/answers  { batchId, answers[] }
  → validate batchId in batchRegistry  (404 ApiError if not found)
  → map answers: correct → isCorrect   (wire → engine)
  → engine.processAnswers(answers, wordStates)
  → update module-level wordStates in place
  → map updated WordState[] → AnswerResultPayload[]
      phase: 'srsM2_review' → 'anki_review'
      phase: 'learning' → 'learning'
  → return 200 ApiResponse<SubmitAnswersResponse> { processed, updatedWords[] }
```

---

## 5. Stories

### EP13-ST01: Update `@gll/api-contract` wire types + state module

**Scope**: Update `packages/api-contract/src/srs.ts` with the five additions listed in the contract gap above. Then create `apps/server/src/state/` with `store.ts`, `engine.ts`, and `batchRegistry.ts`. No HTTP logic.

**Read List**:
- `packages/api-contract/src/srs.ts`
- `packages/srs-engine/data/mappers.ts`
- `packages/srs-engine/data/types.ts`
- `packages/srs-engine/data/samples/foundations-consonants.ts`
- `packages/srs-engine/src/srs-engine.ts`
- `packages/srs-engine/src/types.ts`
- `scripts/quiz-runner.ts` (seed loading pattern, SrsConfig values)

**Tasks**:

- [ ] Add `targetText: string` to `QuizQuestion` in `api-contract/src/srs.ts`
- [ ] Add `deckId: string` to `GetBatchRequest`
- [ ] Add `batchId: string` to `BatchPayload`
- [ ] Add `batchId: string` to `SubmitAnswersRequest`
- [ ] Add `SubmitAnswersResponse` interface (`processed: number`, `updatedWords: AnswerResultPayload[]`)
- [ ] Create `apps/server/src/state/store.ts` — seed `WordState[]` from first 5 consonants + conversations JSON; build `wordDetails` map; generate and export `deckId` via `crypto.randomUUID()`; log `deckId` to console on module load
- [ ] Create `apps/server/src/state/engine.ts` — instantiate and export `SrsEngine` singleton with the standard `SrsConfig` (batchSize 15, matching quiz-runner values)
- [ ] Create `apps/server/src/state/batchRegistry.ts` — export `register(batchId, questions)` and `get(batchId)` backed by a `Map<string, QuizQuestion[]>`
- [ ] Add `@gll/srs-engine` and `@gll/api-contract` as workspace dependencies in `apps/server/package.json`
- [ ] Verify `pnpm typecheck` passes for both `@gll/api-contract` and `apps/server`

**Acceptance Criteria**:

- [ ] `@gll/api-contract` exports `SubmitAnswersResponse`; `QuizQuestion`, `BatchPayload`, `GetBatchRequest`, `SubmitAnswersRequest` all have the new fields
- [ ] `apps/server/src/state/store.ts` exports `wordStates`, `wordDetails`, `deckId`
- [ ] `deckId` is printed to console when the module is first imported
- [ ] `batchRegistry.get('unknown')` returns `undefined`
- [ ] `pnpm typecheck` passes for `@gll/api-contract` and `apps/server`

---

### EP13-ST02: `POST /api/srs/batch` route

**Scope**: Add `src/routes/srs.ts` with the batch route and mount it in `src/index.ts`.

**Read List**:
- `apps/server/src/index.ts` (from EP12)
- `apps/server/src/state/store.ts`
- `apps/server/src/state/engine.ts`
- `apps/server/src/state/batchRegistry.ts`
- `packages/api-contract/src/srs.ts`
- `packages/srs-engine/src/types.ts` (engine `QuestionType` values)

**Tasks**:

- [ ] Create `apps/server/src/routes/srs.ts` with a Hono router
- [ ] Implement `POST /api/srs/batch` handler:
  - Parse and validate `deckId` from request body (return `400 ApiError { code: BAD_REQUEST }` if missing or mismatched)
  - Call `engine.composeBatch(wordStates)`
  - Map engine `Question[]` → wire `QuizQuestion[]` (type mapping + `targetText` from `wordDetails`)
  - Generate `batchId` via `crypto.randomUUID()`
  - Register batch in `batchRegistry`
  - Return `200 ApiResponse<BatchPayload>`
- [ ] Mount `srs` router on `/api/srs` in `src/index.ts`
- [ ] Write unit test for `POST /api/srs/batch`:
  - Happy path: valid `deckId` → 200 with 15 questions, all `questionType` values are wire format
  - Unknown `deckId` → 400 with `ApiError` envelope

**Acceptance Criteria**:

- [ ] `POST /api/srs/batch` with valid `deckId` returns `200` with `batchId`, `questions[]`, `batchSize`
- [ ] Each question has `wordId`, `questionType` (wire values only — never `'mc'` or `'wordBlock'`), `targetText`
- [ ] `POST /api/srs/batch` with wrong `deckId` returns `400 { success: false, error: { code: "BAD_REQUEST" } }`
- [ ] `pnpm typecheck` passes for `apps/server`

---

### EP13-ST03: `POST /api/srs/answers` route + end-to-end integration test

**Scope**: Add the answers route to `src/routes/srs.ts` and write the end-to-end integration test.

**Read List**:
- `apps/server/src/routes/srs.ts` (from ST02)
- `apps/server/src/state/store.ts`
- `packages/api-contract/src/srs.ts`
- `packages/srs-engine/src/types.ts`

**Tasks**:

- [ ] Implement `POST /api/srs/answers` handler:
  - Parse `batchId` and `answers[]` from request body
  - Look up `batchId` in registry (return `404 ApiError { code: NOT_FOUND }` if missing)
  - Map wire `answers` (`correct`) → engine `QuizAnswer[]` (`isCorrect`)
  - Call `engine.processAnswers(engineAnswers, wordStates)`
  - Update `wordStates` in place (replace the module-level array)
  - Map updated `WordState[]` → `AnswerResultPayload[]` (phase mapping: `srsM2_review` → `anki_review`)
  - Return `200 ApiResponse<SubmitAnswersResponse> { processed: answers.length, updatedWords[] }`
- [ ] Write end-to-end integration test:
  - Import the Hono app directly (no port binding)
  - Call `POST /api/srs/batch` with valid `deckId` → capture `batchId` and `questions[]`
  - Build all-correct `answers[]` from returned `questions`
  - Call `POST /api/srs/answers` with `batchId` and answers
  - Assert: `processed === questions.length`, `updatedWords.length > 0`, each `updatedWords[].phase` is `'learning'` or `'anki_review'`
- [ ] Write error-path test: unknown `batchId` → `404 { success: false, error: { code: "NOT_FOUND" } }`

**Acceptance Criteria**:

- [ ] `POST /api/srs/answers` with valid `batchId` returns `200 { processed, updatedWords[] }`
- [ ] `POST /api/srs/answers` with unknown `batchId` returns `404 ApiError`
- [ ] `updatedWords[].phase` values are wire format only (`'learning'` or `'anki_review'` — never `'srsM2_review'`)
- [ ] Engine-internal type values never appear in any HTTP response
- [ ] End-to-end integration test passes: seed → batch → answers → updated mastery
- [ ] `pnpm test` green for `apps/server`
- [ ] `pnpm typecheck` green for `apps/server`

---

## 6. Success Criteria

1. `POST /api/srs/batch` returns 15 questions with wire-format `questionType` and `targetText` populated
2. `POST /api/srs/answers` updates in-memory state and returns `processed` + `updatedWords[]`
3. `POST /api/srs/answers` with unknown `batchId` returns `404` with `ApiError` envelope
4. No engine-internal type strings (`'mc'`, `'wordBlock'`, `'srsM2_review'`) appear in any HTTP response
5. Process restart resets all state — no file I/O or DB
6. `pnpm test` and `pnpm typecheck` green for both `@gll/api-contract` and `apps/server`
