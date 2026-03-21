# EP23-ST01: Structural Refactor & Learning Phase Scoping

**Created**: 20260321T201547Z
**Epic**: [EP23 - SRS Engine v2: Learning Phase Refactor & Persistence Bridge](file:///Users/jc.lee/projects/experiments/gamified-language-learning/.agents/plans/epics/EP23-srs-engine-v2-learning-refactor-persistence-bridge.md)
**Status**: Complete ✅

## Summary

Successfully isolated the Learning phase by moving core session logic into `src/learning/`. Renamed strategies and entry points to clarify their role in the learning phase and avoid collision with upcoming revision logic. Extracted constants into a dedicated config file.

## Files Modified

### packages/srs-engine-v2/src/learning/learning-runner.ts
- (Formerly `src/main.ts`) Updated imports and constants; renamed strategy classes.

### packages/srs-engine-v2/src/learning/learning-io.ts
- (Formerly `src/runner/interactive.ts`) Updated imports and renamed `AnswerStrategy` to `AutoAnswerStrategy`.

### packages/srs-engine-v2/src/learning/auto-answer-strategy.ts
- (Formerly `src/types/answer-strategy.ts`) Renamed interface and classes to `AutoAnswerStrategy`, `CorrectAutoAnswerStrategy`, etc. Updated imports.

### packages/srs-engine-v2/src/learning/auto-answerer.ts
- (Formerly `src/runner/auto-answerer.ts`) Updated imports and renamed interface.

### packages/srs-engine-v2/src/learning/config.ts
- New file containing learning phase constants (`AUTO_MODE`, `LEARNING_CONFIG`, `STREAK_THRESHOLDS`).

### packages/srs-engine-v2/src/learning/CODEMAP.md
- New CODEMAP for the learning directory.

### packages/srs-engine-v2/package.json
- Added `pnpm learnv2` script.

### package.json (root)
- Replaced `quizv2` with `learnv2`.

### packages/srs-engine-v2/src/__tests__/integration/auto-scenarios.test.ts
- Updated imports and renamed strategy classes.

### packages/srs-engine-v2/src/__tests__/unit/auto-answerer.test.ts
- Updated imports and renamed strategy classes.

### packages/srs-engine-v2/src/__tests__/unit/answer-strategy.test.ts
- Updated imports and renamed strategy classes/test cases.

### packages/srs-engine-v2/src/__tests__/unit/adaptive-loop.test.ts
- Updated imports.

### packages/srs-engine-v2/src/__tests__/unit/recheck.test.ts
- Updated imports.

### packages/srs-engine-v2/CODEMAP.md
- Updated entry points, source layout, and data flow.

### packages/srs-engine-v2/src/types/CODEMAP.md
- Removed `answer-strategy.ts` and added other types.

## Behavior Preserved / New Behavior

- `pnpm learnv2` (formerly `pnpm quizv2`) executes identically to before.
- All integration and unit tests pass (111 tests).
- All learning phase constants are now centralized in `src/learning/config.ts`.

## Next Steps

- EP23-ST02: Implement unified `WordStore` and SQLite schema management.
