# EP20-ST06: Deck + Batch architecture

**Created**: 20260319
**Epic**: [EP20 - SRS Engine v2: Rebuild from Scratch](../../plans/epics/EP20-srs-engine-v2-rebuild.md)
**Status**: Complete ✅

## Summary

Introduced `Deck` and `Batch` as first-class types. A deck holds two homogeneous pools
(word + foundational). A batch is a sequential slice of both pools with a question limit.
The runner loops through all batches with a "Next batch?" prompt between each, and shows a
run summary at the end.

## Files Added

### `packages/srs-engine-v2/src/types/deck.ts`

- `Deck` — `{ wordPool: MockWord[], foundationalPool: MockConsonant[] }`
- `BatchConfig` — `{ nonFoundationalFocusCount, foundationalFocusCount, questionLimit }`
- `Batch` — `{ focusWords, focusFoundational, questionLimit }`

### `packages/srs-engine-v2/src/engine/compose-deck.ts`

- `generateBatches(deck, config): Batch[]` — slices deck pools sequentially into batches

### `packages/srs-engine-v2/src/__tests__/unit/compose-deck.test.ts`

- 5 tests for `generateBatches`:
  - Returns correct number of batches
  - Each batch has correct `focusWords` count
  - Each batch has correct `focusFoundational` count
  - Batches cover all `wordPool` words with no repeats
  - Each batch carries the correct `questionLimit`

## Files Modified

### `packages/srs-engine-v2/src/runner/interactive.ts`

- `runInteractive` now returns `{ correct: number, total: number }` instead of `void`
- Added `readLine()` helper for "Next batch?" prompt
- Added `runBatchLoop(batches, fullWordPool, fullFoundationalPool)`:
  - Composes questions per batch via `composeBatchMulti` (split question limit)
  - Runs `runInteractive` per batch
  - Prompts "Next batch? (y/n)" between batches; 'n' exits early
  - Prints run summary: batches count + total score

### `packages/srs-engine-v2/src/main.ts`

- Replaced flat config object with `Deck` + `BatchConfig`
- Calls `generateBatches` then `runBatchLoop`
- Testing config: 3-word deck (1 non-foundational + 1 foundational per batch), 2 questions per batch

## Behavior Preserved / New Behavior

- All 26 tests pass (2 smoke + 19 ST03–ST05 + 5 new ST06)
- `pnpm quizv2` presents 3 batches × 2 questions
- Per-batch score shown after each batch
- "Next batch? (y/n)" prompt between batches — 'n' exits early with summary
- Run summary printed at end: `=== Run Complete === Batches: N  Score: X / Y`

## Roadmap Note

- ST07: `WordState` — track seen/correct counts per word through a run
- ST08: Dynamic batch selection using `WordState` (design TBD)
