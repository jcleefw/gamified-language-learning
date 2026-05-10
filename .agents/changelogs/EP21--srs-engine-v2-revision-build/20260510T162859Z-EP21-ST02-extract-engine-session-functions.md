# EP21-ST02: Extract Engine Session Functions

**Created**: 20260510T162859Z
**Epic**: [EP21 - SRS Engine v2: Revision Phase](../../plans/epics/EP21-srs-engine-v2-revision-phase.md)
**Status**: Complete ✅

## Summary

Extracted `processRecheckResult`, `nextActivePool`, and `updateMasteryState` from `src/learning/learning-io.ts` into a new `src/engine/session.ts`. These are pure functions with no I/O that form the core session state machine — they now live where they belong alongside `compose-batch.ts`.

`updateMasteryState` was also purified: the original version called `printWordSummary` (a `console.log` side effect) internally. The extracted version returns `newlyMasteredIds: string[]` instead, leaving the caller to decide what to print.

`QuizResult` (`{ wordId, correct }`) was moved from `learning-io.ts` to `src/types/quiz.ts` as a proper domain type.

## Files Modified

### `packages/srs-engine-v2/src/engine/session.ts` (new)

- `processRecheckResult(wordId, wasCorrect, runState, recheckPending, recheckReentered, masteryThreshold, streakThresholds)` → `RecheckResultOutput`
- `nextActivePool(active, queue, questionLimit, runState, masteryThreshold, recheckExempt?)` → `{ active, queue }`
- `updateMasteryState(results, runState, prevState, recheckPending, recheckReentered, masteryThreshold, streakThresholds)` → `MasteryUpdateResult` (includes `newlyMasteredIds: string[]`)
- Exports `RecheckResultOutput`, `MasteryUpdateResult` interfaces

### `packages/srs-engine-v2/src/types/quiz.ts`

- Added `QuizResult` interface (`{ wordId: string; correct: boolean }`)

### `packages/srs-engine-v2/src/learning/learning-io.ts`

- Removed `processRecheckResult`, `nextActivePool`, `updateMasteryState`, `RecheckResultOutput`, `MasteryUpdateResult`, `QuizResult` — replaced with imports from their new locations
- `runAdaptiveLoop` now calls `updateMasteryState` and uses returned `newlyMasteredIds` to drive `printWordSummary` and mastery log output

### `packages/srs-engine-v2/src/__tests__/unit/recheck.test.ts`

- Import path updated: `../../learning/learning-io.js` → `../../engine/session.js`

### `packages/srs-engine-v2/src/__tests__/unit/adaptive-loop.test.ts`

- Import path updated: `../../learning/learning-io.js` → `../../engine/session.js`

## Behavior Preserved / New Behavior

- All 116 tests pass unchanged — no logic changes, import paths only
- `updateMasteryState` is now side-effect-free; `learning-io.ts` owns the print/log responsibility
- `processRecheckResult` and `nextActivePool` are importable by any consumer (server, future web adapter) without pulling in terminal I/O

## Next Steps

- EP21-ST03: Create `src/index.ts` and move demo files
