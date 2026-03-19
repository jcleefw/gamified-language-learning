# EP20-DS01: Interactive Quiz Runner Code Cleanup

**Date**: 2026-03-20
**Status**: Draft
**Epic**: [EP20 - SRS Engine v2 Rebuild](../../plans/epics/EP20-srs-engine-v2-rebuild.md)

---

## 1. Feature Overview

Refactor `packages/srs-engine-v2/src/runner/interactive.ts` to improve maintainability and follow clean-code principles. Focus on:
- Breaking down the 73-line `runAdaptiveLoop()` into focused functions
- Eliminating single-letter variable names (`q`, `ws`, `r`)
- Extracting duplicated stdin patterns into reusable helpers
- Extracting magic values into named constants
- Adding input validation and safer error handling

This is a code quality improvement with **zero behavioral changes** — existing quiz flow remains identical.

---

## 2. Core Requirements

| Requirement | Decision | Rationale |
| --- | --- | --- |
| `runAdaptiveLoop()` size | Split into 4 functions: `runBatch()`, `updateMasteryState()`, `decideContinue()`, main loop | Single responsibility; current 73 lines is too dense to reason about |
| Variable naming | Replace `q`→`question`, `ws`→`wordState`, `r`→`result` | Searchability & clarity; single letters violate clean-code principles |
| stdin duplication | Extract `readFromStdin(options)` helper | DRY principle; pattern repeated in `readKey()` and `readLine()` |
| Magic values | Extract `WORD_ID_PREFIX = 'th::'`, `KEYBOARD_EXIT = '\u0003'` | Maintainability; scattered magic strings are error-prone |
| Error handling | Remove non-null assertions (`!`), add validation | Fail fast with meaningful errors instead of silent undefined |
| Test coverage | Ensure existing tests still pass | Validate refactoring doesn't break behavior |

---

## 3. Data Structures

```typescript
// Extract the stdin helper
interface StdinOptions {
  raw?: boolean;
  trim?: boolean;
}

// Constants for magic values
const WORD_ID_PREFIX = 'th::';
const KEYBOARD_EXIT = '\u0003';
const BATCH_PROMPT = '\nNext batch? (y/n): ';

// Helper types (already exist, just named better)
type WordState = ReturnType<RunState['get']>;
type QuizBatchResult = { correct: number; total: number; results: QuizResult[] };
```

---

## 4. User Workflows

```
User starts → selectDeck() → runAdaptiveLoop()
                                ↓
                          runBatch()
                          ↓ (process results)
                          updateMasteryState()
                          ↓ (print summary)
                          decideContinue() → [y] → loop
                                            ↓ [n]
                                         exit + summary
```

---

## 5. Stories

### EP20-ST12a: Extract stdin Helper & Constants

**Scope**: Utilities
**Read List**: `packages/srs-engine-v2/src/runner/interactive.ts` (lines 1-30)
**Tasks**:

- [ ] Extract `readFromStdin(options)` helper
  - Consolidates `readKey()` and `readLine()` logic
  - Reduces duplication from 2 implementations to 1 parameterized version

- [ ] Define constants at module top
  - `WORD_ID_PREFIX`, `KEYBOARD_EXIT`, `BATCH_PROMPT`
  - Replace all scattered references

**Acceptance Criteria**:
- [ ] `readKey()` and `readLine()` call new helper
- [ ] All magic strings replaced with named constants
- [ ] No functional change to quiz flow

---

### EP20-ST12b: Extract Batch Processing Logic

**Scope**: `runAdaptiveLoop()` refactoring
**Read List**: `packages/srs-engine-v2/src/runner/interactive.ts` (lines 191-220)
**Tasks**:

- [ ] Extract `async runBatch(batchNum, activeItems, ...): Promise<QuizBatchResult>`
  - Lines 203-221: batch composition + interactive run
  - Returns `{ correct, total, results }`

- [ ] Extract `updateMasteryState(results, runState, ...): RunState`
  - Lines 202-212: all state updates + recheck logic
  - Pure function; same behavior

**Acceptance Criteria**:
- [ ] `runBatch()` handles only composition + execution
- [ ] `updateMasteryState()` is pure function
- [ ] Score tracking (`totalCorrect`, `totalQuestions`) remains in main loop

---

### EP20-ST12c: Variable Naming Cleanup

**Scope**: All variable references
**Read List**: Full file
**Tasks**:

- [ ] Replace `q` → `question` (line 57+)
- [ ] Replace `ws` → `wordState` (throughout file)
- [ ] Replace `r` → `result` (line 202+)
- [ ] Rename `nextState` → `updatedRunState` (better clarity)

**Acceptance Criteria**:
- [ ] All single-letter vars replaced
- [ ] Grep finds no orphaned references
- [ ] Code still passes tests

---

### EP20-ST12d: Add Input Validation & Error Handling

**Scope**: Safety
**Read List**: `packages/srs-engine-v2/src/runner/interactive.ts` (lines 51-85)
**Tasks**:

- [ ] Validate `selectDeck()`: non-empty decks array
- [ ] Validate `runInteractive()`: all questions have choices + isCorrect field
- [ ] Remove non-null assertions (`!`); throw meaningful errors instead
- [ ] Add guard in `composeBatchMulti()` calls for empty pools

**Acceptance Criteria**:
- [ ] No code contains `!` assertions
- [ ] Errors have context: `throw new Error('Quiz malformed: no isCorrect choice')`
- [ ] Empty pools caught before composition

---

## 6. Success Criteria

1. ✅ `runAdaptiveLoop()` splits into 4 functions, each <25 lines
2. ✅ All single-letter variables replaced with intention-revealing names
3. ✅ No code duplication in stdin handling
4. ✅ All magic values extracted to named constants
5. ✅ Input validation catches errors early with clear messages
6. ✅ No type errors; existing quiz tests still pass
7. ✅ Code reads naturally without mental mapping

---

## Implementation Notes

- **Refactoring order**: Constants → Helpers → Variable rename → Extract functions → Add validation
- **Testing strategy**: Run existing tests after each story to catch regressions early
- **Behavioral guarantee**: Zero changes to quiz logic or output — refactoring only
- **Review focus**: Does extracted code improve readability? Are function boundaries clear?
