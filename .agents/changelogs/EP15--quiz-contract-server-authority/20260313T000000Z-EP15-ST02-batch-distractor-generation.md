# EP15-ST02: Update `/api/srs/batch` — distractor generation + pool validation

**Created**: 20260313T000000Z
**Epic**: [EP15 - Quiz Contract: Server-Side Answer Authority](../../plans/epics/EP15-quiz-contract-server-authority.md)
**Status**: Complete ✅

## Summary

`POST /api/srs/batch` now generates a/b/c/d choices for every `multiple_choice` question. The correct key is stored server-side in the batch registry — never returned to the client. Non-MC questions receive `choices: {}`. Pool validation rejects batches when fewer than 4 words are seeded.

## Files Modified

### `apps/server/src/state/batchRegistry.ts`

- Introduced `BatchEntry` interface: `{ questions: QuizQuestion[]; correctKeys: Record<string, string> }`
- `register(batchId, entry: BatchEntry)` replaces `register(batchId, questions: QuizQuestion[])`
- `get(batchId): BatchEntry | undefined` replaces `get(batchId): QuizQuestion[] | undefined`

### `apps/server/src/routes/srs.ts`

- Added `CHOICE_KEYS` constant and two local helpers: `shuffled<T>` (Fisher-Yates) and `buildMcChoices`
- `/batch` handler: validates `wordDetails.size < 4` → 400 `INSUFFICIENT_WORD_POOL`
- `/batch` handler: generates `choices` + `correctKeys` for MC questions; non-MC gets `choices: {}`
- Calls `register(batchId, { questions, correctKeys })` — correctKeys withheld from HTTP response
- `/answers` handler: uses `registeredEntry` variable name; stubs `submittedKey: ''` and `correctKey: ''` (resolved in ST03)
- Imports `WordDetail` type from store

### `apps/server/src/state/__tests__/batchRegistry.test.ts`

- Updated `MOCK_QUESTIONS` to include `choices` field (required by updated `QuizQuestion` type)
- Updated `register` calls to pass `BatchEntry` shape
- Updated `get` assertions to expect `BatchEntry`

### `apps/server/src/routes/__tests__/srs.test.ts`

- Added: `POST /api/srs/batch` returns 400 `INSUFFICIENT_WORD_POOL` when pool has <4 words
- Added: `multiple_choice` questions have `choices` with keys `a, b, c, d`; non-MC questions have `choices: {}`

### `apps/server/src/state/CODEMAP.md`

- Updated `batchRegistry.ts` row to reflect `BatchEntry` shape

## Behavior Preserved / New Behavior

- All 16 server tests pass
- `POST /api/srs/batch` with valid deckId and pool ≥4 returns `choices` on every MC question
- Correct answer key stored server-side only; not present in response body
- `POST /api/srs/batch` with pool <4 returns `{ success: false, error: { code: 'INSUFFICIENT_WORD_POOL' } }`
- `/answers` handler still uses `a.correct` from body (ST01 intentional breakage); resolved in ST03

## Next Steps

- EP15-ST03: Update `/api/srs/answers` (read `selectedKey`, server-determined correctness) + add `POST /api/srs/seed` route + update E2E tests
