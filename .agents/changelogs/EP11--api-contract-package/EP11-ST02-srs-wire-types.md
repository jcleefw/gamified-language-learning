# EP11-ST02: SRS wire types

**Created**: 20260312T000000Z
**Epic**: [EP11 - `@gll/api-contract` — Shared HTTP Types](../../plans/epics/EP11-api-contract-package.md)
**Status**: Complete ✅

## Summary

Added `src/srs.ts` with all Stage 2 SRS wire types and exported from the barrel. `pnpm --filter @gll/api-contract typecheck` still passes.

## Files Modified

### `packages/api-contract/src/srs.ts` (new)

- `QuestionType` = `'multiple_choice' | 'word_block' | 'audio'` (HTTP snake_case; distinct from engine `'mc' | 'wordBlock' | 'audio'`)
- `GetBatchRequest` — `{ size?: number }` (GET /srs/batch query params)
- `QuizQuestion` — `{ wordId: string; questionType: QuestionType }`
- `BatchPayload` — `{ questions: QuizQuestion[]; batchSize: number }`
- `QuizAnswer` — `{ wordId: string; correct: boolean }`
- `SubmitAnswersRequest` — `{ answers: QuizAnswer[] }` (POST /srs/answers body)
- `MasteryPhase` = `'learning' | 'anki_review'` (public-facing; maps from engine `'srsM2_review'`)
- `AnswerResultPayload` — `{ wordId, correct, masteryCount, phase }`
- `WordMasterySummary` — `{ wordId, masteryCount, phase }`

### `packages/api-contract/src/index.ts` (updated)

- Added `export * from './srs.js'`

## Behavior Preserved / New Behavior

- All 9 SRS wire types exported from package root
- No engine-internal types imported or re-exported
- `QuizAnswer.correct` is `boolean` (not `isCorrect`)
- `WordMasterySummary.phase` typed as `'learning' | 'anki_review'`
- Typecheck passes with zero errors

## Next Steps

- EP12: Hono server scaffold (unblocked — error types available)
- EP13: SRS routes in-memory state (unblocked — all SRS wire types available)
