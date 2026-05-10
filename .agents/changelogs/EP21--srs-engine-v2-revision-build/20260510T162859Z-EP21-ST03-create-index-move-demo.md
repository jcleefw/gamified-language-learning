# EP21-ST03: Create `src/index.ts` and Move Demo Files

**Created**: 20260510T162859Z
**Epic**: [EP21 - SRS Engine v2: Revision Phase](../../plans/epics/EP21-srs-engine-v2-revision-phase.md)
**Status**: Complete ✅

## Summary

Created the public library API (`src/index.ts`) and moved all terminal demo code from `src/learning/` to a new top-level `demo/` folder. After this change, `@gll/srs-engine-v2` is a proper standalone library: a consumer imports everything they need from the package root, and the demo folder shows exactly how to build a terminal interface on top of it.

The `pnpm learnv2` script (root `package.json`) was updated to point at `demo/learning-runner.ts`. All demo files import from `../src/index.js` — the same path a server or frontend would use.

`better-sqlite3` and `@types/better-sqlite3` were removed from `package.json`; persistence belongs in the server.

## Files Modified

### `packages/srs-engine-v2/src/index.ts` (new)

Public barrel exporting the full library surface:
- Engine: `composeBatch`, `composeBatchMulti`, `FOUNDATIONAL_DIRECTIONS`, `QuizItem`
- Session: `processRecheckResult`, `nextActivePool`, `updateMasteryState`, `RecheckResultOutput`, `MasteryUpdateResult`
- State: `updateRunState`, `isMastered`, `WordState`, `RunState`, `StreakThresholds`
- Types: `QuizQuestion`, `QuizChoice`, `QuizDirection`, `QuizResult`, `MockDeck`, `MockLine`, foundational types

### `demo/` (new folder)

| File | Origin | Notes |
|---|---|---|
| `demo/learning-runner.ts` | `src/learning/learning-runner.ts` | Imports from `../src/index.js` and `./learning-io.js` |
| `demo/learning-io.ts` | `src/learning/learning-io.ts` | Imports all pure logic from `../src/index.js` |
| `demo/auto-answerer.ts` | `src/learning/auto-answerer.ts` | Removed duplicate `QuizResult` definition |
| `demo/auto-answer-strategy.ts` | `src/learning/auto-answer-strategy.ts` | `QuizQuestion` imported from `../src/index.js` |
| `demo/config.ts` | `src/learning/config.ts` | Unchanged logic |

### `src/learning/` (deleted)

All five files removed after contents moved to `demo/`.

### `packages/srs-engine-v2/package.json`

- Removed `better-sqlite3` (runtime dep)
- Removed `@types/better-sqlite3` (dev dep)

### Root `package.json`

- `learnv2` script: `tsx packages/srs-engine-v2/src/learning/learning-runner.ts` → `tsx packages/srs-engine-v2/demo/learning-runner.ts`

### Test files — import path updates only

| File | Old import | New import |
|---|---|---|
| `src/__tests__/unit/answer-strategy.test.ts` | `../../learning/auto-answer-strategy.js` | `../../../demo/auto-answer-strategy.js` |
| `src/__tests__/unit/auto-answerer.test.ts` | `../../learning/auto-answerer.js` | `../../../demo/auto-answerer.js` |
| `src/__tests__/integration/auto-scenarios.test.ts` | `../../learning/learning-io.js`, `../../learning/auto-answer-strategy.js` | `../../../demo/learning-io.js`, `../../../demo/auto-answer-strategy.js` |

## Behavior Preserved / New Behavior

- All 116 tests pass unchanged
- `pnpm learnv2` runs identically to before (terminal demo behavior unchanged)
- `demo/learning-io.ts` contains zero pure engine logic — only I/O and orchestration that calls `src/index.js`
- A web server can now import `{ composeBatch, processRecheckResult, nextActivePool, updateRunState }` from `@gll/srs-engine-v2` with no knowledge of internal paths

## Next Steps

- EP21-ST01: Revision runner + FSRS scheduler — now has a clean foundation to build on
