# EP20-ST07: WordState — per-word tracking across the run

**Created**: 20260319T143500Z
**Epic**: [EP20 - SRS Engine v2: Rebuild from Scratch](../../plans/epics/EP20-srs-engine-v2-rebuild.md)
**Status**: Complete ✅

## Summary

Introduced `WordState` to track how many times each word has been seen and answered
correctly. State is accumulated across all batches in a run and displayed as a per-word
summary after each batch (for words covered in that batch). Each `QuizQuestion` now
carries a `wordId` so the runner can attribute answers back to words.

## Files Added

### `packages/srs-engine-v2/src/types/word-state.ts`

- `WordState` — `{ wordId: string, seen: number, correct: number }`
- `RunState` — `Map<string, WordState>`
- `updateRunState(state, wordId, wasCorrect): RunState` — pure, returns new state

### `packages/srs-engine-v2/src/__tests__/unit/word-state.test.ts`

- 7 tests for `updateRunState`:
  - Creates new entry from empty state (correct + wrong)
  - Increments `seen` on both correct and wrong answers
  - Increments `correct` only on correct answers
  - Tracks multiple words independently
  - Does not mutate the original state

## Files Modified

### `packages/srs-engine-v2/src/types/quiz.ts`

- Added `wordId: string` to `QuizQuestion`

### `packages/srs-engine-v2/src/engine/compose-batch.ts`

- `composeBatch` populates `wordId: item.id` on every generated question

### `packages/srs-engine-v2/src/__tests__/unit/compose-batch.test.ts`

- Added test: `each question carries the wordId of the item`

### `packages/srs-engine-v2/src/runner/interactive.ts`

- `runInteractive` now returns `{ correct, total, results: QuizResult[] }`
  where `QuizResult = { wordId: string, correct: boolean }`
- `runBatchLoop` accumulates `RunState` across all batches via `updateRunState`
- After each batch: prints per-word seen/correct for words covered in that batch
- Run summary at end unchanged

## Behavior

- All 34 tests pass (2 smoke + 26 ST03–ST06 + 7 new ST07 + 1 wordId assertion)
- `pnpm quizv2` — after each batch shows:
  ```
  Word results:
    หิว   seen: 2  correct: 1
    ก     seen: 1  correct: 1
  ```
- RunState threads through all batches — cumulative seen/correct counts

## Roadmap Note

- ST08: Dynamic batch selection — use `RunState` to prioritise weak words (design TBD)
