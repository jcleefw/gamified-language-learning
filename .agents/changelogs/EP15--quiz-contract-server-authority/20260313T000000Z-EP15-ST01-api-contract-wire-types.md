# EP15-ST01: Update `@gll/api-contract` wire types

**Created**: 20260313T000000Z
**Epic**: [EP15 - Quiz Contract: Server-Side Answer Authority](../../plans/epics/EP15-quiz-contract-server-authority.md)
**Status**: Complete ✅

## Summary

Updated `@gll/api-contract` wire types to support server-side answer authority. Breaking change to `QuizAnswer` is intentional — forces all callers to migrate from client-reported correctness to `selectedKey`.

## Files Modified

### `packages/api-contract/src/srs.ts`

- `QuizQuestion`: added `choices: Record<string, string>` — server-generated a/b/c/d choices per question
- `QuizAnswer`: replaced `correct: boolean` with `selectedKey: string` — client sends chosen key, not self-reported result
- `AnswerResultPayload`: added `submittedKey: string` and `correctKey: string` — server returns both keys so client can display feedback

### `packages/api-contract/src/errors.ts`

- `ErrorCode`: added `INSUFFICIENT_WORD_POOL = 'INSUFFICIENT_WORD_POOL'` — returned when batch pool has fewer than 4 unique words

### `packages/api-contract/CODEMAP.md`

- Updated `errors.ts` and `srs.ts` rows to reflect new fields and error code

## Behavior Preserved / New Behavior

- `@gll/api-contract` typechecks clean
- `@gll/server` has 6 intentional type errors (ST02 fixes `choices` construction + batchRegistry; ST03 fixes `/answers` handler and tests)
- All existing fields on `QuizQuestion`, `BatchPayload`, `SubmitAnswersRequest`, `AnswerResultPayload` preserved — only additions and one replacement

## Next Steps

- EP15-ST02: Update `/api/srs/batch` — distractor generation + `BatchEntry` registry shape
