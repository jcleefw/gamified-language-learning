# EP15-ST04: Mixed Question Direction for `/api/srs/batch`

**Created**: 20260314T000000Z
**Epic**: [EP15 - Quiz Contract: Server-Side Answer Authority](../../plans/epics/EP15-quiz-contract-server-authority.md)
**Design**: [EP15-DS02](./20260314T000000Z-EP15-DS02-mixed-question-direction.md)
**Status**: Complete ✅

## Summary

`POST /api/srs/batch` now assigns a random direction to each `multiple_choice` question — either `english_to_native` (see English sound, pick Thai char) or `native_to_english` (see Thai char, pick English sound). The direction is exposed in the wire response as `questionDirection` so the client can render the prompt correctly. The `buildMcChoices` helper was refactored to accept a `direction` parameter and derive `targetText`, `correctText`, and distractor field from it.

## Files Modified

### `packages/api-contract/src/srs.ts`

- Added `QuestionDirection` type: `'english_to_native' | 'native_to_english'`
- Added `questionDirection?: QuestionDirection` field to `QuizQuestion`

### `apps/server/src/routes/srs.ts`

- `buildMcChoices` signature updated: added `direction: QuestionDirection` parameter; now returns `targetText` in addition to `choices` and `correctKey`
- Logic: `english_to_native` → `targetText = .english`, `correctText = .native`, distractors from `.native`; `native_to_english` → `targetText = .native`, `correctText = .english`, distractors from `.english`
- `/batch` handler: assigns direction with `Math.random() < 0.5 ? 'english_to_native' : 'native_to_english'` per MC question; includes `questionDirection` in each returned `QuizQuestion`

### `apps/server/src/routes/__tests__/srs.test.ts`

- Added test: `multiple_choice` questions have `questionDirection`; when `english_to_native`, `targetText` is from the English set and all choice values are from the native set; when `native_to_english`, vice versa

## Behavior Preserved / New Behavior

- All server tests pass
- Each MC question in `/batch` response includes `questionDirection: 'english_to_native' | 'native_to_english'`
- `targetText` and `choices` values are always different text types — never the same script/language
- `correctKey` determination and `/answers` correctness flow unchanged

## Next Steps

- EP15-ST05: Add `native_to_romanization` as a third direction
