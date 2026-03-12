# EP13 - `apps/server` — SRS Routes + In-Memory State

**Created**: 20260311T000000Z
**Status**: Draft

<!-- Status: Draft | Accepted | In Progress | Impl-Complete | BDD Pending | Completed | Shelved | Withdrawn -->

**Type**: Epic Plan
**Depends on**: EP12, EP08
**Parallel with**: EP14
**Predecessor**: N/A

---

## Problem Statement

The Hono server scaffold exists (EP12) but has no SRS functionality. The SRS engine is complete (EP07) and seed data + mappers are available (EP08). This epic wires them together: an in-memory state store seeded from EP08 mappers, a `SrsEngine` singleton, a batch registry, and the two SRS HTTP routes defined in the API surface ADR (`POST /api/srs/batch` and `POST /api/srs/answers`).

## Scope

**In scope**:

- In-memory word state store: `WordState[]` seeded from EP08 content mappers on process start
- In-memory `targetText` lookup: `Map<wordId, wordDetail>` seeded from the same mappers
- `SrsEngine` singleton instantiated once at module load, shared across all requests
- Batch registry: `Map<batchId, QuizQuestion[]>` tracking active batches (server-generated `batchId` via `crypto.randomUUID()`)
- Hardcoded deck ID: random hash generated once at seed time, printed to console on startup
- `POST /api/srs/batch` — accepts `GetBatchRequest`, calls engine, maps engine output to `BatchPayload` wire type, returns `ApiResponse<BatchPayload>`
- `POST /api/srs/answers` — accepts `SubmitAnswersRequest`, validates `batchId` exists in registry, calls engine `processAnswers`, maps result to `AnswerResultPayload` wire type, returns `ApiResponse<AnswerResultPayload>`
- Engine-to-wire type mapping (see Key Type Mappings below)
- End-to-end integration test: seed → `POST /api/srs/batch` → `POST /api/srs/answers` → assert updated mastery state

**Out of scope**:

- `options[]` (MC distractors) — engine does not generate these; field is optional in ADR, omit in Stage 2
- Multi-tenancy / per-user state — single shared in-memory store, no user identity
- Database persistence — Stage 3
- Auth enforcement — Stage 5

---

## Key Type Mappings (Engine → Wire)

These must be handled in route handlers; do not leak engine types into the response:

| Engine value            | Wire value              |
| ----------------------- | ----------------------- |
| `QuestionType: 'mc'`    | `questionType: 'multiple_choice'` |
| `QuestionType: 'wordBlock'` | `questionType: 'word_block'` |
| `QuestionType: 'audio'` | `questionType: 'audio'` |
| `MasteryPhase: 'srsM2_review'` | `phase: 'anki_review'` |
| `QuizAnswer.isCorrect`  | `QuizAnswer.correct`    |

## `targetText` Clarification

`QuizQuestion.targetText` is the **learning target** — the native-language word (e.g. Korean) that the quiz question is designed to strengthen. It is always `WordDetail.native`.

The question direction (show English → answer in Korean, or show Korean → answer in English) is a UI concern. The server always supplies the native word as `targetText`, and the client decides how to present both sides of the question.

---

## Stories

### EP13-ST01: In-memory state store + `SrsEngine` singleton + batch registry

**Scope**: Create `src/state/store.ts` — seeds `WordState[]` from EP08 content mappers, builds `Map<wordId, wordDetail>` for `targetText` lookup, generates a fixed `deckId` hash at module load and logs it to console. Create `src/state/engine.ts` — instantiates `SrsEngine` singleton from `@gll/srs-engine`. Create `src/state/batchRegistry.ts` — `Map<batchId, QuizQuestion[]>` with `register` and `get` helpers. No HTTP logic in this story.

### EP13-ST02: `POST /api/srs/batch` route

**Scope**: Add `src/routes/srs.ts` with `POST /api/srs/batch` handler — validates `deckId` in request body matches the seeded deck ID (400 if not), calls `SrsEngine` to get a batch, maps engine questions to `QuizQuestion[]` wire type (applying type mapping table), registers batch in batch registry with a `crypto.randomUUID()` batchId, returns `ApiResponse<BatchPayload>`. Mount route on the Hono app in `src/index.ts`.

### EP13-ST03: `POST /api/srs/answers` route + end-to-end integration test

**Scope**: Add `POST /api/srs/answers` handler to `src/routes/srs.ts` — validates `batchId` exists in registry (404 if not), maps `QuizAnswer.correct` → engine's `isCorrect`, calls `SrsEngine.processAnswers`, maps result to `AnswerResultPayload` wire type (applying phase mapping), returns `ApiResponse<AnswerResultPayload>`. Write integration test: seed → call `/api/srs/batch` → call `/api/srs/answers` with all-correct answers → assert `processed` count and at least one `updatedWords` entry with a valid `phase`.

---

## Overall Acceptance Criteria

- [ ] `POST /api/srs/batch` with body `{ "deckId": "<seeded-hash>" }` returns `200` with 15 questions
- [ ] Each question has `wordId`, `questionType` (wire format values), and `targetText`
- [ ] `POST /api/srs/answers` with a valid `batchId` returns `200` with `processed` count and `updatedWords[]`
- [ ] `POST /api/srs/answers` with an unknown `batchId` returns `404` with `ApiError` envelope
- [ ] Engine-internal type values are never present in the HTTP response (all mapped to wire values)
- [ ] `pnpm test` green for `apps/server` including the end-to-end integration test
- [ ] `pnpm typecheck` green for `apps/server`
- [ ] Process restart resets all state (no file I/O, no DB, no persistence)

---

## Dependencies

- EP08 — content mappers and seed data (required by in-memory store)
- EP12 — Hono server scaffold (middleware stack, app instance)
- EP11 — `@gll/api-contract` (wire types used throughout)
- EP07 — `SrsEngine` class

## Next Steps

1. Review and approve plan
2. Create Design Spec (DS) for state module layout before ST01
3. Implement ST01 → ST02 → ST03
4. Verify end-to-end via Postman after ST03
