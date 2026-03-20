# CODEMAP.md — `src/types/`

Shared TypeScript type definitions. No logic.

---

## Files

| File | Purpose |
| --- | --- |
| `quiz.ts` | All quiz-domain types shared across `engine/` and `runner/` |
| `answer-strategy.ts` | Answer strategy pattern for automated quiz answering |

---

## Exports — `quiz.ts`

| Export | Kind | Shape |
| --- | --- | --- |
| `QuizDirection` | Union type | `'native-to-english' \| 'english-to-native' \| 'native-to-romanization' \| 'romanization-to-native'` |
| `QuizChoice` | Interface | `{ label: 'a'\|'b'\|'c'\|'d', value: string, isCorrect: boolean }` |
| `QuizQuestion` | Interface | `{ direction: QuizDirection, prompt: string, choices: QuizChoice[] }` |

## Exports — `answer-strategy.ts`

| Export | Kind | Purpose |
| --- | --- | --- |
| `AnswerStrategy` | Interface | Pluggable contract for answer selection: `selectAnswer(question: QuizQuestion): number` |
| `CorrectAnswerStrategy` | Class | Always selects correct answer (perfect run scenario) |
| `RandomAnswerStrategy` | Class | Selects random choice (edge case scenario) |
| `WeightedAccuracyStrategy` | Class | Targets N% accuracy with configurable rate (realistic scenario) |
