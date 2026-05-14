# CODEMAP.md — `src/engine/`

Quiz generation and session state logic. Pure functions only — no I/O,
no side effects.

---

## Files

| File | Purpose |
| --- | --- |
| `compose-batch.ts` | Composes `QuizQuestion[]` from language content |
| `session.ts` | Session state transitions — recheck, pool rotation, mastery updates |

---

## Exports — `compose-batch.ts`

| Export | Signature | Purpose |
| --- | --- | --- |
| `composeWordBatch` | `(item: QuizItem, pool: QuizItem[]) → QuizQuestion[]` | One question per direction for a single item; uses `pool` for distractors |
| `composeWordBatchMulti` | `(words: QuizItem[], pool: QuizItem[], options: { questionLimit: number; shuffle?: boolean }) → QuizQuestion[N]` | Covers all input words, fills to `questionLimit`; `shuffle: false` for deterministic order |
| `composeWordBatchItems` | alias for `composeWordBatchMulti` | Registry-wiring name per batch-execution-mechanics ADR D5 |
| `FOUNDATIONAL_DIRECTIONS` | `Record<FoundationalType, QuizDirection[]>` | Direction sets per foundational type (consonant/vowel = 4, tone = 2) |
| `QuizItem` | `type` | `MockFoundational \| MockWord` |

### `composeWordBatchMulti` Algorithm

1. Generate all directions per word via `composeWordBatch`
2. Take first question from each word → coverage guaranteed
3. Collect remaining questions as leftover
4. Fill gap to `questionLimit` with (optionally shuffled) leftover
5. Optionally shuffle final array

---

## Exports — `session.ts`

| Export | Signature | Purpose |
| --- | --- | --- |
| `processRecheckResult` | `(wordId, wasCorrect, runState, recheckPending, recheckReentered, masteryThreshold, streakThresholds?) → RecheckResultOutput` | Applies one answer; suppresses streak/mastery on first recheck attempt |
| `nextActivePool` | `(active, queue, questionLimit, runState, masteryThreshold, recheckExempt?) → { active, queue }` | Retires mastered words and fills freed slots from queue |
| `updateMasteryState` | `(results, runState, prevState, recheckPending, recheckReentered, masteryThreshold, streakThresholds) → MasteryUpdateResult` | Applies a full batch of results; returns `newlyMasteredIds` for this batch |
| `RecheckResultOutput` | `interface` | `{ runState, recheckPending, recheckReentered }` |
| `MasteryUpdateResult` | `interface` | `{ runState, recheckPending, recheckReentered, masteredCount, newlyMasteredIds }` |

---

## Dependencies

| Import | Source |
| --- | --- |
| `QuizQuestion`, `QuizDirection`, `QuizChoice`, `QuizResult` | `../types/quiz` |
| `MockFoundational` | `../types/foundational` |
| `MockWord` | `../../data/mock/mock-words` |
| `RunState`, `StreakThresholds`, `updateRunState`, `isMastered` | `../types/word-state` |

---

## Unit Tests

| Test file | Covers |
| --- | --- |
| `src/__tests__/unit/compose-batch.test.ts` | `composeWordBatch`, `composeWordBatchMulti` |
| `src/__tests__/unit/recheck.test.ts` | `processRecheckResult`, `nextActivePool` |
| `src/__tests__/unit/adaptive-loop.test.ts` | `nextActivePool` pool rotation |
| `src/__tests__/unit/update-mastery-state.test.ts` | `updateMasteryState` |
