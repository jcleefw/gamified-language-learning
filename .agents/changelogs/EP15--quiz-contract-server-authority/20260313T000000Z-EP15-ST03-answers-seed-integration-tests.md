# EP15-ST03: Update `/api/srs/answers` + `/seed` + integration tests

**Created**: 20260313T000000Z
**Epic**: [EP15 - Quiz Contract: Server-Side Answer Authority](../../plans/epics/EP15-quiz-contract-server-authority.md)
**Status**: Complete ✅

## Summary

`POST /api/srs/answers` now determines correctness server-side by comparing `selectedKey` against the `correctKey` stored in the batch registry — client-reported correctness is eliminated. `POST /api/srs/seed` is a new route that returns the current `deckId` in the response body, removing the console-log dependency. `SeedPayload` wire type added to `@gll/api-contract`. Tests updated to use `selectedKey`, assert `submittedKey`/`correctKey`, and cover the wrong-key path.

## Files Modified

### `packages/api-contract/src/srs.ts`

- Added `SeedPayload` interface: `{ deckId: string; seedId?: string; wordCount: number; phase: MasteryPhase }` — wire type for `POST /srs/seed` response

### `packages/api-contract/CODEMAP.md`

- Added `SeedPayload` to `srs.ts` row and Exports Summary table

### `apps/server/src/routes/srs.ts`

- `/answers` handler: `engineAnswers` now computes `isCorrect = a.selectedKey === correctKey` (looked up from `registeredEntry.correctKeys`)
- `/answers` handler: `updatedWords` map now populates `submittedKey` and `correctKey` from registry; `correct` derived server-side
- Added `POST /seed` route: returns `ApiResponse<SeedPayload>` with `deckId`, `wordCount: wordDetails.size`, `phase: 'learning'`
- Added `SeedPayload` to `@gll/api-contract` imports

### `apps/server/src/routes/CODEMAP.md`

- Updated `/answers` description to reflect `selectedKey` + server-side correctness
- Added `/seed` route entry

### `apps/server/src/routes/__tests__/srs.test.ts`

- All `/answers` answer payloads updated from `{ correct: boolean }` → `{ selectedKey: string }`
- Tests use `get(batchId)` from batchRegistry to look up correct keys before submitting answers
- Added assertions: `submittedKey` and `correctKey` present in each `AnswerResultPayload`
- New test: "returns correct: false and reveals correctKey when wrong key is submitted"
- New describe block: `POST /api/srs/seed` — asserts 200, `deckId`, `wordCount`, `phase`
- E2E test renamed to reflect updated assertions

## Behavior Preserved / New Behaviour

- 18 server tests pass, 197 tests pass across monorepo
- `pnpm typecheck` green across all packages
- Wrong key → `correct: false` with `correctKey` revealed in response
- Correct key → `correct: true`, `masteryCount` increments
- `/seed` returns `deckId` — no more console-log dependency for Postman flow

## Acceptance Criteria Met

- [x] `POST /api/srs/answers` accepts `selectedKey` per answer (old `correct: boolean` shape rejected by TypeScript)
- [x] Server determines `correct` independently — submitting any key returns a real verdict with `correctKey` in response
- [x] `POST /api/srs/seed` response includes `deckId` in the JSON body
- [x] `pnpm test` green for `apps/server` and `packages/api-contract`
- [x] `pnpm typecheck` green across the monorepo
