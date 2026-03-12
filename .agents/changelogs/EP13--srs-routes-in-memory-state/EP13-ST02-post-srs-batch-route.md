# EP13-ST02: POST /api/srs/batch Route

**Created**: 20260312
**Epic**: [EP13 - SRS Routes + In-Memory State](.agents/plans/epics/EP13-srs-routes-in-memory-state.md)
**Status**: Complete ✅

## Summary

Added `POST /api/srs/batch` route handler in `src/routes/srs.ts`. Validates `deckId` against the seeded store value, calls the `SrsEngine` singleton to compose a batch, maps engine-internal question types to wire format, registers the batch in the batch registry, and returns `ApiResponse<BatchPayload>`. Mounted route on the Hono app at `/api/srs`. Rebuilt `@gll/api-contract` to pick up ST01 type additions.

## Files Modified

### apps/server/src/routes/srs.ts (new)

- `POST /batch` handler: deckId validation, engine call, type mapping, registry registration, response

### apps/server/src/routes/__tests__/srs.test.ts (new)

- 3 tests: 400 on wrong deckId, 200 with valid BatchPayload, wire type format validation

### apps/server/src/app.ts

- Import `srsRoutes` and mount at `/api/srs`

### apps/server/src/routes/CODEMAP.md (new)

- Documents the routes folder

### packages/api-contract/dist/ (rebuilt)

- Rebuilt to expose ST01 additions (`batchId`, `targetText`, `deckId`, `GetBatchRequest`)

## Behavior Preserved / New Behavior

- `POST /api/srs/batch` with wrong `deckId` → 400 `BAD_REQUEST`
- `POST /api/srs/batch` with correct `deckId` → 200 with `{ batchId, questions[], batchSize }`
- Engine `QuestionType` values mapped to wire format (`mc` → `multiple_choice`, `wordBlock` → `word_block`)
- `targetText` set to `WordDetail.native` (the Korean target-language string)
- Batch registered in `batchRegistry` keyed by server-generated UUID

## Next Steps

- EP13-ST03: `POST /api/srs/answers` route + end-to-end integration test
