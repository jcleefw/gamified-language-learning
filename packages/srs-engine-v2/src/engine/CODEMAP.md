# CODEMAP.md — `src/engine/`

Quiz generation logic. Pure functions only — no I/O, no side effects.

---

## Files

| File | Purpose |
| --- | --- |
| `compose-batch.ts` | Composes `QuizQuestion[]` from language content |

---

## Exports — `compose-batch.ts`

| Export | Signature | Purpose |
| --- | --- | --- |
| `composeBatch` | `(consonant: MockConsonant, pool: MockConsonant[]) → QuizQuestion[4]` | One question per `QuizDirection` for a single consonant; uses `pool` for distractors |
| `composeBatchMulti` | `(words: QuizItem[], pool: QuizItem[], options: { questionLimit: number; shuffle?: boolean }) → QuizQuestion[N]` | Covers all input words, fills to `questionLimit`; optional `shuffle` parameter controls randomness (default: `true`); when `shuffle: false`, returns deterministic order for testing |

### Internal Helpers

| Helper | Purpose |
| --- | --- |
| `englishWithClass` | Formats English as `"sound (class)"` |
| `makeChoices` | Builds 4-choice set (1 correct + 3 distractors), assigns labels a–d |
| `shuffle` | Fisher-Yates in-place shuffle |

### `composeBatchMulti` Algorithm

1. Generate 4 questions per word via `composeBatch`
2. Take first question from each word → coverage guaranteed
3. Collect remaining questions as leftover
4. Fill gap to `questionLimit` with shuffled leftover
5. Shuffle final array

---

## Dependencies

| Import | Source |
| --- | --- |
| `QuizQuestion`, `QuizDirection`, `QuizChoice` | `../types/quiz` |
| `MockConsonant` | `../../../data/mock/mock-consonants` |

---

## Unit Tests

`src/__tests__/unit/compose-batch.test.ts`
