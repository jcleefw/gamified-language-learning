# CODEMAP.md — `src/types/`

Shared TypeScript type definitions. No logic.

---

## Files

| File | Purpose |
| --- | --- |
| `quiz.ts` | All quiz-domain types shared across `engine/` and `runner/` |

---

## Exports — `quiz.ts`

| Export | Kind | Shape |
| --- | --- | --- |
| `QuizDirection` | Union type | `'native-to-english' \| 'english-to-native' \| 'native-to-romanization' \| 'romanization-to-native'` |
| `QuizChoice` | Interface | `{ label: 'a'\|'b'\|'c'\|'d', value: string, isCorrect: boolean }` |
| `QuizQuestion` | Interface | `{ direction: QuizDirection, prompt: string, choices: QuizChoice[] }` |
