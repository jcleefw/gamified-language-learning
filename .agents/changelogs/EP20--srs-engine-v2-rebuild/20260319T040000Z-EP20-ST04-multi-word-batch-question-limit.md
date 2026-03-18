# EP20-ST04: Batch composition — N foundational words, configurable question limit

**Created**: 20260319
**Epic**: [EP20 - SRS Engine v2: Rebuild from Scratch](../../plans/epics/EP20-srs-engine-v2-rebuild.md)
**Status**: Complete ✅

## Summary

Extended the quiz engine to support multiple foundational words with a configurable total
question limit and guaranteed per-word coverage. Added `composeBatchMulti` using a
coverage-first shuffle algorithm. Refactored `main.ts` to use two named constants so word
count and question limit can each be changed in one place. Also updated the interactive
runner to accept keypresses without requiring Enter.

## Files Modified

### `packages/srs-engine-v2/src/engine/compose-batch.ts`

- Added `composeBatchMulti(words, pool, { questionLimit })` — coverage-first shuffle:
  picks 1 guaranteed question per word, then fills remaining slots from shuffled leftovers
- `composeBatch` (single-word) left unchanged

### `packages/srs-engine-v2/src/main.ts`

- Replaced hardcoded single-word logic with `FOUNDATIONAL_WORD_COUNT = 3` and `QUESTION_LIMIT = 5` constants
- Calls `composeBatchMulti` instead of `composeBatch`

### `packages/srs-engine-v2/src/__tests__/unit/compose-batch.test.ts`

- Added `describe('composeBatchMulti')` block with 5 tests:
  - Returns exactly `questionLimit` questions
  - Every input word appears in at least 1 question
  - Each question has exactly 4 choices, exactly 1 correct
  - No duplicate word+direction pairs
  - Returns all questions when `questionLimit >= total possible`

### `packages/srs-engine-v2/src/runner/interactive.ts`

- Replaced `readline` with raw stdin keypress — answer registers on single key, no Enter needed
- Ctrl+C (`\u0003`) handled for clean exit
- Echoes pressed key back to stdout

## Behavior Preserved / New Behavior

- All 15 tests pass (2 smoke + 7 ST03 + 5 ST04 + 1 pre-existing)
- `composeBatch` (single-word, 4 questions) behavior unchanged
- `pnpm quizv2` now presents 5 questions across 3 words; each word guaranteed to appear at least once
- Changing `FOUNDATIONAL_WORD_COUNT` or `QUESTION_LIMIT` requires editing one constant each
- Answers no longer require Enter — single keypress submits immediately

## Next Steps

- ST05: `processAnswers` — mastery counting, phase transition, carry-over flagging
