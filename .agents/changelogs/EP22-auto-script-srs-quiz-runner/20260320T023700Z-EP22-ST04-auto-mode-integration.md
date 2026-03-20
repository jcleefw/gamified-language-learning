# EP22-ST04: Update Main Runner for Auto Mode

**Created**: 2026-03-20T02:37:00Z
**Status**: Complete ✅

## Summary

Integrated auto mode into the main quiz loop. Added `AUTO_MODE` flag and conditional logic to `runAdaptiveLoop()` and `main.ts` enabling automatic batch continuation without user prompts.

## Files Modified

### `packages/srs-engine-v2/src/runner/interactive.ts`
- Imported `AnswerStrategy` interface and `runAutoInteractive`
- Updated `runBatch()` signature: added optional `strategy?: AnswerStrategy` parameter
- Conditional shuffle: `shouldShuffle = !strategy` (deterministic for auto, random for interactive)
- Conditional runner: calls `runAutoInteractive(questions, strategy)` if strategy provided, else `runInteractive(questions)`
- Updated `runAdaptiveLoop()` signature: added optional `strategy?: AnswerStrategy` parameter
- Modified batch continuation logic: auto mode continues automatically, interactive mode shows "Next batch?" prompt
- Passes strategy to `runBatch()`

### `packages/srs-engine-v2/src/main.ts`
- Added `AUTO_MODE = false` flag at top (default: interactive)
- Imported all 3 strategy classes and `AnswerStrategy` type
- Created `selectStrategy()` function returning `AnswerStrategy`
- Conditional deck selection: `mockDecks[0]` when `AUTO_MODE = true`, user prompt when `false`
- Conditional strategy selection: `selectStrategy()` when `AUTO_MODE = true`, `undefined` when `false`
- Updated `runAdaptiveLoop()` call to pass `strategy` parameter
- Added auto-exit: `break` after one run in auto mode, loop continues in interactive mode

## Acceptance Criteria Met

- ✅ `AUTO_MODE = false` → uses `runInteractive()`, shows readline prompts, random question order
- ✅ `AUTO_MODE = true` → uses `runAutoInteractive()`, no prompts, deterministic question order
- ✅ Changing `AUTO_MODE` is the only flag needed for mode selection
- ✅ No changes to core engine types or mastery logic
- ✅ Backward compatible: interactive mode unchanged when `AUTO_MODE = false`

## Test Results

All existing tests still pass:
```
✓ src/__tests__/unit/word-state.test.ts (23 tests)
✓ src/__tests__/unit/adaptive-loop.test.ts (6 tests)
✓ src/__tests__/unit/recheck.test.ts (13 tests)
✓ ... all integration tests pass
```

## Dependencies

- Requires ST01: `AnswerStrategy` interface
- Requires ST02: `composeBatchMulti` shuffle parameter
- Requires ST03: `runAutoInteractive()` function

## Next Step

→ ST05: Implement test scenarios with integration test validation
