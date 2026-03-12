# EP13-ST03: POST /api/srs/answers Route + E2E Integration Test

**Created**: 20260312
**Epic**: [EP13 - SRS Routes + In-Memory State](.agents/plans/epics/EP13-srs-routes-in-memory-state.md)
**Status**: Complete ✅

## Summary

Added `POST /api/srs/answers` handler to `src/routes/srs.ts`. Validates `batchId` in registry (404 on miss), maps wire `QuizAnswer.correct` → engine `isCorrect`, calls `SrsEngine.processAnswers`, updates the in-memory store via `setWordStates`, maps results to `AnswerResultPayload` wire type (applying `srsM2_review` → `anki_review` phase mapping), returns `ApiResponse<SubmitAnswersResponse>`.

Added E2E integration test: seed → batch → answers (all correct) → assert `processed` count and `masteryCount > 0` for each updated word. Break-Verify-Restore confirmed the E2E test detects regressions.

## Files Modified

### apps/server/src/routes/srs.ts

- Added `ENGINE_TO_WIRE_PHASE` mapping table
- Added `POST /answers` handler with batchId validation, answer processing, state update, and response mapping
- Added imports: `SubmitAnswersRequest`, `SubmitAnswersResponse`, `AnswerResultPayload`, `MasteryPhase`, `EngineMasteryPhase`, `setWordStates`, `get`

### apps/server/src/routes/__tests__/srs.test.ts

- Added `POST /api/srs/answers` describe block: 404 on unknown batchId, 200 with valid answers
- Added `E2E: batch → answers` describe block: full seed → batch → answers flow

### apps/server/src/routes/CODEMAP.md

- Added `POST /api/srs/answers` route entry

### apps/server/CODEMAP.md

- Added `POST /api/srs/answers` to route table

### .agents/plans/epics/EP13-srs-routes-in-memory-state.md

- Status updated to `Impl-Complete`

## Behavior Preserved / New Behavior

- `POST /api/srs/answers` with unknown `batchId` → 404 `NOT_FOUND`
- `POST /api/srs/answers` with valid `batchId` + answers → 200 with `{ processed, updatedWords[] }`
- Engine `MasteryPhase: 'srsM2_review'` → wire `'anki_review'`
- In-memory `wordStates` updated after each answers call (state persists across requests within process lifetime)
- E2E: all-correct answers increase `masteryCount` from 0 to 1

## Next Steps

- EP13 complete. Verify end-to-end via Postman after PR merge.
