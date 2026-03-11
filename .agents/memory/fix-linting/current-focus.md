# current-focus.md

**Updated**: 20260312T000000Z

## Completed

- EP11 Impl-Complete: `packages/api-contract/` created with all wire types
  - ST01: scaffold + error types (`ErrorCode`, `ApiError`, `ApiResponse<T>`) + stubs
  - ST02: SRS wire types (`QuestionType`, `GetBatchRequest`, `QuizQuestion`, `BatchPayload`, `QuizAnswer`, `SubmitAnswersRequest`, `MasteryPhase`, `AnswerResultPayload`, `WordMasterySummary`)
  - `pnpm --filter @gll/api-contract typecheck` passes

## What's Next

- EP12: Hono server scaffold (can begin — only needs error types from EP11, which are ready)
- EP13: SRS routes in-memory state
- EP14: CI Stage 2 update
