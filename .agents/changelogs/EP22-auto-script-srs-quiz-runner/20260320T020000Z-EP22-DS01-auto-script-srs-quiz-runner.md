# EP22-DS01: Auto-Script SRS Quiz Runner Specification

**Date**: 2026-03-20
**Status**: Draft
**Epic**: [EP22 - Auto-Script SRS Quiz Runner](./EP22-auto-script-srs-quiz-runner.md)

---

## 1. Feature Overview

EP22 adds automated quiz answering to the SRS engine without modifying core engine logic or breaking the existing interactive mode. The design introduces a **pluggable answer strategy pattern** that allows the quiz runner to automatically select answers based on different test scenarios (perfect accuracy, realistic patterns, edge cases).

**Key insight**: Determinism is achieved by disabling shuffle in `composeBatchMulti` for auto mode. This ensures the same questions appear in the same order on every run, making test results reproducible and strategy behavior predictable.

The implementation splits into two parallel runners:
- **Interactive runner** (`runInteractive`) — existing user input flow, random question order
- **Auto runner** (`runAutoInteractive`) — new strategy-based flow, deterministic question order, answers automatically

Both runners share the same quiz composition engine and word pool. A runtime `AUTO_MODE` flag in `main.ts` determines which runner to use, making the feature a safe, isolated addition.

---

## 2. Core Requirements

| Requirement | Decision | Rationale |
|---|---|---|
| **Backward compatibility** | Interactive mode remains functional and unchanged | Zero risk to existing test workflows; shuffle defaults to `true` |
| **Determinism in auto mode** | Disable shuffle in `composeBatchMulti` for auto scenarios | Ensures same questions appear in same order every run; strategy behavior is reproducible |
| **Strategy pattern** | Pluggable `AnswerStrategy` interface with 3+ implementations | Enables quick scenario switching without code changes; extensible for future strategies |
| **Mode selection** | `AUTO_MODE` boolean flag in `main.ts` | Simple, explicit control; can become config file or CLI arg later |
| **Test scenarios** | Hardcoded configs in `main.ts` (perfect, 80/20 accuracy, edge cases) | Self-contained testing; avoids external config complexity |
| **Output format** | Same summary as interactive mode (per-word mastery, run totals) | Output is human-readable; testers can review results manually |
| **No engine changes** | Core `runAdaptiveLoop`, `WordState`, mastery logic untouched | Reduces risk; validates test scenarios only exercise the runner layer |
| **Deck selection** | Auto mode selects first deck by default | Deterministic and predictable for scripted testing |
| **Batch continuation** | Auto runner continues until `active` and `queue` are empty | No manual "Next batch?" prompt in auto mode |

---

## 3. Data Structures

```typescript
// src/types/answer-strategy.ts (NEW)

/**
 * AnswerStrategy determines which choice a quiz runner will select
 * for a given question, without user input.
 */
interface AnswerStrategy {
  /**
   * Select an answer choice index (0–3) for a question.
   * @param question - the quiz question
   * @returns choice index 0–3
   */
  selectAnswer(question: QuizQuestion): number;
}

/**
 * Always select the correct answer.
 * Used for "perfect run" test scenarios.
 */
class CorrectAnswerStrategy implements AnswerStrategy {
  selectAnswer(question: QuizQuestion): number {
    return question.choices.findIndex(c => c.correct);
  }
}

/**
 * Select a random choice (including possibly the correct answer).
 * Used for edge case / chaos testing.
 */
class RandomAnswerStrategy implements AnswerStrategy {
  selectAnswer(question: QuizQuestion): number {
    return Math.floor(Math.random() * question.choices.length);
  }
}

/**
 * Select an answer with a target accuracy rate.
 * If accuracy is 0.8, answer correctly ~80% of the time, randomly ~20%.
 * Used for "realistic accuracy" scenarios.
 */
class WeightedAccuracyStrategy implements AnswerStrategy {
  constructor(private accuracy: number) {}

  selectAnswer(question: QuizQuestion): number {
    if (Math.random() < this.accuracy) {
      // Answer correctly
      return question.choices.findIndex(c => c.correct);
    } else {
      // Answer incorrectly (random wrong choice)
      const wrongChoices = question.choices
        .map((c, i) => (!c.correct ? i : null))
        .filter(i => i !== null) as number[];
      return wrongChoices[Math.floor(Math.random() * wrongChoices.length)];
    }
  }
}
```

---

## 4. User Workflows

### Interactive Mode (Existing)
```
START
  ↓
selectDeck() → user picks deck
  ↓
runAdaptiveLoop(..., interactive=true)
  ├─ for each batch:
  │   ├─ composeBatchMulti(words, pool, { questionLimit, shuffle: true })  [DEFAULT]
  │   ├─ runInteractive() → readline prompt → user inputs a/b/c/d
  │   ├─ updateRunState()
  │   └─ "Next batch? (y/n)"
  ↓
Show run summary
  ↓
END
```

### Auto Mode (New)
```
START
  ↓
Select test scenario (perfect | 80/20 | edge cases)
  ↓
Auto deck selection (first deck)
  ↓
runAdaptiveLoop(..., interactive=false, strategy=<AnswerStrategy>)
  ├─ for each batch:
  │   ├─ composeBatchMulti(words, pool, { questionLimit, shuffle: false })  [DETERMINISTIC]
  │   ├─ runAutoInteractive(questions, strategy)
  │   │   └─ for each question:
  │   │       ├─ strategy.selectAnswer(question)
  │   │       └─ auto-answer without I/O
  │   ├─ updateRunState()
  │   └─ (no "Next batch?" prompt; continue automatically)
  ↓
Show run summary
  ↓
END
```

---

## 5. Stories

### EP22-ST01: Create Auto-Answerer Module

**Scope**: Implement the `AnswerStrategy` interface and 3+ answer strategy classes.

**Read List**:
- `src/types/quiz.ts` — `QuizQuestion`, `QuizChoice` to understand choice structure
- `src/__tests__/unit/compose-batch.test.ts` — sample questions for testing strategies

**Tasks**:

- [ ] Create `src/types/answer-strategy.ts`
  - Define `AnswerStrategy` interface with `selectAnswer(question: QuizQuestion): number`
  - Implement `CorrectAnswerStrategy`
  - Implement `RandomAnswerStrategy`
  - Implement `WeightedAccuracyStrategy(accuracy: number)`

  **Acceptance Criteria**:
  - [ ] `CorrectAnswerStrategy.selectAnswer()` always returns index of correct choice
  - [ ] `RandomAnswerStrategy.selectAnswer()` returns a valid index 0–3
  - [ ] `WeightedAccuracyStrategy(0.8).selectAnswer()` returns correct answer ~80% of time over 100 calls (allow ±10% variance)
  - [ ] `WeightedAccuracyStrategy(0.0)` always returns an incorrect choice
  - [ ] `WeightedAccuracyStrategy(1.0)` always returns the correct choice
  - [ ] All strategies export and are importable

- [ ] Create unit tests `src/__tests__/unit/answer-strategy.test.ts`
  - [ ] Test each strategy with deterministic sample questions
  - [ ] Verify correct/incorrect indices match choice objects

**Dependencies**: None (isolated types)

---

### EP22-ST02: Modify `composeBatchMulti` — Add Shuffle Control

**Scope**: Add `shuffle?: boolean` parameter to `composeBatchMulti()` to enable deterministic question ordering in auto mode.

**Read List**:
- `src/engine/compose-batch.ts` — current `composeBatchMulti` implementation
- `src/__tests__/unit/compose-batch.test.ts` — existing tests
- `src/main.ts` — current callers of `composeBatchMulti`

**Tasks**:

- [ ] Modify `composeBatchMulti` signature in `src/engine/compose-batch.ts`
  ```typescript
  export function composeBatchMulti(
    items: QuizItem[],
    pool: QuizItem[],
    options: { questionLimit: number; shuffle?: boolean }
  ): QuizQuestion[]
  ```
  - Default: `shuffle = true` (backward compatible)
  - When `shuffle = false`: return `[...coverage, ...filler]` without shuffling

  **Acceptance Criteria**:
  - [ ] `composeBatchMulti(..., { questionLimit: 4 })` → same behavior as before (shuffled)
  - [ ] `composeBatchMulti(..., { questionLimit: 4, shuffle: true })` → shuffled
  - [ ] `composeBatchMulti(..., { questionLimit: 4, shuffle: false })` → deterministic order, always coverage-first + filler
  - [ ] Return value is identical between runs with `shuffle: false` (same input → same output)

- [ ] Update `src/__tests__/unit/compose-batch.test.ts`
  - [ ] Add test: `composeBatchMulti(..., shuffle: false)` returns same questions in same order on second call
  - [ ] Existing tests still pass (shuffle defaults to true)

**Dependencies**: None (isolated change to one function)

---

### EP22-ST03: Create Automated Interactive Runner

**Scope**: Build `runAutoInteractive()` that uses an `AnswerStrategy` to answer all questions in a batch without user input, and returns the same `{ correct, total, results }` as the manual runner.

**Read List**:
- `src/runner/interactive.ts` — existing `runInteractive()` implementation
- `src/types/quiz.ts` — `QuizQuestion`, `QuizChoice`
- `src/types/answer-strategy.ts` — new strategy types
- `src/__tests__/integration/smoke.test.ts` — sample test harness

**Tasks**:

- [ ] Create `src/runner/auto-answerer.ts`
  - Implement `runAutoInteractive(questions: QuizQuestion[], strategy: AnswerStrategy): Promise<{ correct: number; total: number; results: { wordId: string; correct: boolean }[] }>`
  - For each question:
    - Call `strategy.selectAnswer(question)` to get choice index
    - Check if returned index is correct
    - Track results
  - No readline I/O; completes instantly

  **Acceptance Criteria**:
  - [ ] Returns `correct` count equal to number of correctly-selected choices
  - [ ] Returns `total` equal to question count
  - [ ] Results array has one entry per question with `wordId` + `correct` flag
  - [ ] Completes instantly (no readline delay)
  - [ ] Works with all three strategy types

- [ ] Export `runAutoInteractive` from `src/runner/interactive.ts` (or import it in `main.ts`)

- [ ] Create unit tests `src/__tests__/unit/auto-answerer.test.ts`
  - [ ] Test with `CorrectAnswerStrategy` on 4-question batch → `correct: 4`
  - [ ] Test with `WeightedAccuracyStrategy(0.0)` on 4-question batch → `correct: 0`
  - [ ] Test with `WeightedAccuracyStrategy(1.0)` on 4-question batch → `correct: 4`
  - [ ] Results array contains all question wordIds

**Dependencies**: ST01 (AnswerStrategy types), ST02 (composeBatchMulti)

---

### EP22-ST04: Update Main Runner for Auto Mode

**Scope**: Add `AUTO_MODE` flag to `main.ts` and conditional logic to choose between interactive and auto runners. Pass `shuffle: false` to `composeBatchMulti` in auto mode.

**Read List**:
- `src/main.ts` — current entry point
- `src/runner/interactive.ts` — runner exports
- `src/runner/auto-answerer.ts` — new auto runner
- `src/types/answer-strategy.ts` — strategy types

**Tasks**:

- [ ] Add `AUTO_MODE` boolean flag at top of `main.ts`
  - Default: `false` (interactive mode)
  - When `true`: use auto runner with strategies

  **Acceptance Criteria**:
  - [ ] `AUTO_MODE = false` → uses `runInteractive()`, shows readline prompts, questions are random
  - [ ] `AUTO_MODE = true` → uses `runAutoInteractive()`, no prompts, questions are deterministic

- [ ] Create `selectStrategy()` function (called only when `AUTO_MODE = true`)
  - Return an `AnswerStrategy` based on config or hardcoded choice
  - Preliminary: return `new CorrectAnswerStrategy()` for now

- [ ] Modify `runAdaptiveLoop()` signature to accept optional strategy
  - Add parameter: `strategy?: AnswerStrategy`
  - Inside the batch loop, check if `strategy` is provided:
    - If yes: pass `shuffle: false` to `composeBatchMulti`; call `runAutoInteractive(questions, strategy)`
    - If no: pass `shuffle: true` (default) to `composeBatchMulti`; call `runInteractive(questions)` (existing behavior)

  **Acceptance Criteria**:
  - [ ] `runAdaptiveLoop(..., undefined)` → interactive, random questions (backward compatible)
  - [ ] `runAdaptiveLoop(..., new CorrectAnswerStrategy())` → auto, deterministic questions, all correct
  - [ ] Changing `AUTO_MODE = true` requires changing only one boolean
  - [ ] No changes to core engine types or mastery logic

- [ ] No changes to core `WordState` or `updateRunState`

**Dependencies**: ST03 (runAutoInteractive), ST02 (composeBatchMulti shuffle param)

---

### EP22-ST05: Implement Test Scenarios

**Scope**: Define and hardcode three test scenario configurations in `main.ts` (perfect mastery, realistic 80/20 accuracy, edge cases). Each scenario uses a different strategy and runs to completion.

**Read List**:
- `src/main.ts` — current config structure
- `src/types/answer-strategy.ts` — strategy implementations
- `src/__tests__/integration/smoke.test.ts` — test structure

**Tasks**:

- [ ] Define three hardcoded scenario configs in `main.ts`:

  ```typescript
  // Scenario 1: Perfect run — all correct answers
  const perfectScenario = {
    name: "Perfect Run",
    strategy: new CorrectAnswerStrategy(),
    deckIndex: 0,
  };

  // Scenario 2: Realistic 80/20 — 80% accuracy
  const variableScenario = {
    name: "80/20 Accuracy",
    strategy: new WeightedAccuracyStrategy(0.8),
    deckIndex: 0,
  };

  // Scenario 3: Edge cases — random answers
  const edgeCaseScenario = {
    name: "Edge Cases",
    strategy: new RandomAnswerStrategy(),
    deckIndex: 0,
  };
  ```

- [ ] Add scenario selection logic to `main.ts` (when `AUTO_MODE = true`)
  - Hardcode which scenario to run, or add a simple menu to select
  - Resolve `deckIndex` to an actual deck from `mockDecks`
  - Pass selected strategy to `runAdaptiveLoop`

  **Acceptance Criteria**:
  - [ ] Perfect scenario runs to completion with all words at `mastery: 5`
  - [ ] 80/20 scenario runs to completion with ~80% correct answers (allow ±10%)
  - [ ] Edge case scenario runs to completion with variable results
  - [ ] Each scenario auto-selects first deck
  - [ ] Each scenario continues batches automatically (no "Next batch?" prompt)

**Dependencies**: ST04 (AUTO_MODE flag), ST01 (strategies)

---

### EP22-ST05b: Verify Output and Review Capability

**Scope**: Ensure auto mode output is readable and reviewable — scores, word state, mastery progression match interactive mode format.

**Read List**:
- `src/runner/interactive.ts` — current output/summary formatting
- `src/__tests__/integration/smoke.test.ts` — expected output structure

**Tasks**:

- [ ] Review `runAdaptiveLoop()` output formatting:
  - Per-batch word summary (mastery, seen, correct counts) — must appear in auto mode
  - Run summary (total batches, score, mastered words) — must appear in auto mode
  - No changes needed; auto mode inherits interactive mode's formatting

  **Acceptance Criteria**:
  - [ ] Auto mode produces identical summary format to interactive mode
  - [ ] Each batch shows word results with `mastery` level
  - [ ] Run summary shows total score + mastered count
  - [ ] Output is human-readable (no binary data or cryptic logs)

- [ ] Create integration test `src/__tests__/integration/auto-scenarios.test.ts`
  - [ ] Perfect scenario: runs 1 deck, final mastery all 5, output shows 100% accuracy
  - [ ] 80/20 scenario: runs 1 deck, final output contains word summaries
  - [ ] Edge case scenario: runs 1 deck, completes without errors

  **Acceptance Criteria**:
  - [ ] All three scenarios complete without crashing
  - [ ] Output is parseable and contains expected summary fields
  - [ ] Results are consistent across multiple runs (deterministic due to `shuffle: false`)

**Dependencies**: ST04, ST05

---

## 6. Success Criteria

- [ ] `pnpm --filter @gll/srs-engine-v2 test` — all tests pass (existing EP20 tests + new EP22 tests)
- [ ] `AUTO_MODE = false; pnpm quizv2` — interactive mode unchanged
  - Deck selection prompt appears
  - Readline input prompt appears for each question
  - Questions appear in random order (shuffle active)
  - Per-batch and run summaries match EP20 output
- [ ] `AUTO_MODE = true; pnpm quizv2` — auto mode runs without user input
  - Deck auto-selected (first deck)
  - Questions appear in deterministic order (shuffle disabled)
  - All questions answered by strategy, no readline
  - Completes in <5 seconds
  - Output shows per-word mastery progression
- [ ] Perfect scenario: final score 100%, all words at mastery 5, identical results on 2nd run
- [ ] 80/20 scenario: final score ≈80% (allow ±10%), word summaries visible
- [ ] Edge case scenario: runs to completion with variable results, no crashes
- [ ] No changes to core engine logic; all new code isolated to runner layer and strategies
- [ ] No type errors (`pnpm --filter @gll/srs-engine-v2 build` succeeds)

---

## 7. Implementation Notes

### Phase 1: Strategy Layer (ST01)
- Three concrete `AnswerStrategy` implementations
- Pure functions; no I/O or side effects
- Test strategies in isolation with sample questions

### Phase 2: Shuffle Control (ST02)
- Add `shuffle?: boolean` parameter to `composeBatchMulti`
- Default `true` for backward compatibility
- No other changes to question composition logic
- Existing tests still pass

### Phase 3: Auto Runner (ST03)
- Implement `runAutoInteractive()` to mirror `runInteractive()`'s contract
- Return type matches interactive mode
- No readline, pure answer selection + correctness checking

### Phase 4: Mode Selection (ST04)
- Hook auto runner into main flow via `AUTO_MODE` flag
- Conditionally pass `shuffle: false` to `composeBatchMulti` in auto mode
- Preserve backward compatibility — `AUTO_MODE = false` is default
- Pass `strategy` param to `runAdaptiveLoop`

### Phase 5: Test Scenarios (ST05)
- Hardcode three scenario configs
- Each scenario uses a different strategy
- Deterministic results due to `shuffle: false`
- Manual review of output validates engine behavior

### Phase 6: Output Verification (ST05b)
- Ensure auto mode output matches interactive mode
- Add integration tests validating all three scenarios
- Confirm results are consistent across runs

---

## 8. Risk & Mitigation

| Risk | Mitigation |
|---|---|
| **Interactive mode broken** | `shuffle` defaults to `true`; all existing callers unaffected; existing tests must pass |
| **Output format divergence** | Both modes use same `updateRunState` + summary logic; formatting is shared |
| **Strategy logic errors** | Each strategy tested in isolation; `runAutoInteractive` tests verify correctness counting |
| **Determinism fails** | `shuffle: false` guarantees same input → same questions → same order; tested |

---

## 9. Open Questions

1. Should scenario selection be a hardcoded choice, menu, or CLI argument?
   - **Assumption**: Hardcoded in `main.ts` for now; can extend later

2. Should we pre-compute which scenario to run, or choose at runtime?
   - **Assumption**: Runtime selection via `AUTO_MODE` flag; both can coexist

---

## Appendix: File Structure

```
packages/srs-engine-v2/
├── src/
│   ├── types/
│   │   └── answer-strategy.ts          (NEW)
│   ├── engine/
│   │   └── compose-batch.ts            (MODIFIED: add shuffle param)
│   ├── runner/
│   │   ├── interactive.ts              (MODIFIED: pass shuffle; import auto-answerer)
│   │   └── auto-answerer.ts            (NEW)
│   └── main.ts                         (MODIFIED: AUTO_MODE flag; selectStrategy; pass strategy to loop)
├── __tests__/
│   ├── unit/
│   │   ├── answer-strategy.test.ts     (NEW)
│   │   └── auto-answerer.test.ts       (NEW)
│   └── integration/
│       └── auto-scenarios.test.ts      (NEW)
```

---
