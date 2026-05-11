# EP22: Auto-Script SRS Quiz Runner

**Created**: 2026-03-20T02:38:50Z
**Epic**: [EP22 - Auto-Script SRS Quiz Runner](.agents/plans/epics/EP22-auto-script-srs-quiz-runner.md)
**Status**: Complete ✅

## Summary

Implemented automated quiz answering capability for the SRS engine, enabling scripted test scenarios without user input. The feature adds a pluggable answer strategy pattern that allows the engine to automatically select answers based on different test scenarios (perfect accuracy, realistic patterns, edge cases).

Key design principle: Determinism through disabling shuffle in `composeBatchMulti` for auto mode, ensuring reproducible test results. All changes are backward compatible — interactive mode remains unchanged and all existing tests pass.

**Deliverables**:
- 3 answer strategy implementations (Correct, Random, WeightedAccuracy)
- Auto-answerer runner with deterministic question ordering
- AUTO_MODE flag for mode selection in `main.ts`
- 3 test scenarios with integration test validation
- 111 total unit + integration tests (all passing)

## Files Modified

### `packages/srs-engine-v2/src/types/answer-strategy.ts` (NEW)

- Created `AnswerStrategy` interface for pluggable answer selection
- Implemented `CorrectAnswerStrategy` — always selects correct answer
- Implemented `RandomAnswerStrategy` — selects random choice
- Implemented `WeightedAccuracyStrategy` — targets N% accuracy with configurable accuracy rate

### `packages/srs-engine-v2/src/runner/auto-answerer.ts` (NEW)

- Created `runAutoInteractive()` function — mirrors `runInteractive()` contract
- Returns same `{ correct, total, results }` structure as interactive runner
- No readline I/O; completes instantly using provided strategy

### `packages/srs-engine-v2/src/runner/interactive.ts` (MODIFIED)

- Added imports for `AnswerStrategy` and `runAutoInteractive`
- Updated `runBatch()` signature to accept optional `strategy` parameter
- Conditional shuffle behavior: `shuffle = !strategy` (deterministic for auto, random for interactive)
- Conditional runner selection: calls either `runAutoInteractive()` or `runInteractive()`
- Updated `runAdaptiveLoop()` signature to accept optional `strategy` parameter
- Modified batch continuation logic: auto mode continues automatically, interactive mode asks user

### `packages/srs-engine-v2/src/engine/compose-batch.ts` (MODIFIED)

- Added `shuffle?: boolean` parameter to `composeBatchMulti()` options
- Default value: `true` (backward compatible)
- When `shuffle: false`: returns deterministic question order (coverage-first, then filler)
- Conditional shuffling applied to both internal question selection and final batch ordering

### `packages/srs-engine-v2/src/main.ts` (MODIFIED)

- Added `AUTO_MODE = false` flag for mode selection
- Added imports for all 3 strategy classes
- Created `selectStrategy()` function to choose strategy for auto mode
- Updated deck selection: `mockDecks[0]` when `AUTO_MODE = true`, user prompt when `false`
- Updated `runAdaptiveLoop()` call to pass optional strategy parameter
- Added auto-exit: `break` after one run in auto mode, loop in interactive mode
- Documented three test scenario options with expected outcomes

### `packages/srs-engine-v2/src/__tests__/unit/answer-strategy.test.ts` (NEW)

- 11 unit tests for all 3 strategy implementations
- Tests cover correctness selection, randomness, accuracy distributions
- Edge case validation: invalid accuracy bounds, questions with no correct answer

### `packages/srs-engine-v2/src/__tests__/unit/auto-answerer.test.ts` (NEW)

- 10 unit tests for `runAutoInteractive()` function
- Tests validate all strategy types, result structure, error handling
- Accuracy variance testing (WeightedAccuracyStrategy distribution)

### `packages/srs-engine-v2/src/__tests__/unit/compose-batch.test.ts` (MODIFIED)

- Added 4 new tests for shuffle parameter behavior
- `with shuffle: false, returns deterministic question order` — validates same input → same output
- `with shuffle: true, may return different order` — validates randomness when enabled
- `defaults to shuffle: true for backward compatibility` — ensures default behavior unchanged

### `packages/srs-engine-v2/src/__tests__/integration/auto-scenarios.test.ts` (NEW)

- 4 integration tests validating all three test scenarios
- `perfect scenario: CorrectAnswerStrategy reaches 100% accuracy` — validates word mastery progression
- `realistic scenario: WeightedAccuracyStrategy(0.8) completes with ~80% accuracy` — validates mixed accuracy behavior
- `edge case scenario: RandomAnswerStrategy completes without crashing` — validates robustness
- `determinism: Same input with shuffle: false produces identical results` — validates reproducibility

## Behavior Preserved / New Behavior

- ✅ **Interactive mode fully preserved**: User prompts, random question order, deck selection unchanged
- ✅ **Backward compatible**: `composeBatchMulti()` shuffle parameter defaults to `true`
- ✅ **Core engine unchanged**: No modifications to `WordState`, `updateRunState()`, mastery logic, or streak calculations
- ✅ **New auto runner**: `runAutoInteractive()` uses answer strategies, completes instantly, continues batches automatically
- ✅ **Deterministic auto mode**: Same input with `shuffle: false` produces identical questions and results
- ✅ **Three test scenarios**: Perfect accuracy, realistic 80/20, and edge cases with random answers
- ✅ **111 tests passing**: All existing EP20 tests + 20 new tests for EP22

## Test Results

```
Test Files  9 passed (9)
Tests       111 passed (111)
Passing:    ✅ answer-strategy (11 unit tests)
            ✅ auto-answerer (10 unit tests)
            ✅ compose-batch (23 unit tests, +4 new)
            ✅ auto-scenarios (4 integration tests)
            ✅ All other EP20 tests (unchanged)
```

## Next Steps

1. Code review and merge to feature/EP21 branch
2. Update current-focus.md to reference EP22 completion
3. Plan EP23 or next epic based on product roadmap
4. Optional: Add CLI argument for scenario selection instead of hardcoded flag
5. Optional: Create Grafana dashboard to visualize auto-mode test runs

## Files Status

| File | Type | Status |
|------|------|--------|
| `answer-strategy.ts` | NEW | ✅ Complete |
| `auto-answerer.ts` | NEW | ✅ Complete |
| `interactive.ts` | MODIFIED | ✅ Complete |
| `compose-batch.ts` | MODIFIED | ✅ Complete |
| `main.ts` | MODIFIED | ✅ Complete |
| Unit tests (answer-strategy) | NEW | ✅ Complete |
| Unit tests (auto-answerer) | NEW | ✅ Complete |
| Unit tests (compose-batch) | MODIFIED | ✅ Complete |
| Integration tests | NEW | ✅ Complete |

---
