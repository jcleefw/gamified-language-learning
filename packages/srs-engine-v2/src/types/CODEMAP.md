# CODEMAP.md — `src/types/`

Shared TypeScript type definitions. No logic.

---

## Files

| File | Purpose |
| --- | --- |
| `quiz.ts` | All quiz-domain types shared across `engine/` and `runner/` |
| `word-state.ts` | Word mastery and streak state types |
| `deck.ts` | Deck and Batch types |
| `foundational.ts` | Thai foundational types (consonants, vowels, tones) |

---

## Exports — `foundational.ts`

| Export | Kind | Detail |
| --- | --- | --- |
| `MockVowel` | Interface | Thai vowel mark with position and length |
| `MockTone` | Interface | Thai tone mark |
| `MockFoundational` | Union | `MockConsonant \| MockVowel \| MockTone` |

---

## Exports — `quiz.ts`

| Export | Kind | Shape |
| --- | --- | --- |
| `QuizDirection` | Union type | `'native-to-english' \| 'english-to-native' \| 'native-to-romanization' \| 'romanization-to-native'` |
| `QuizChoice` | Interface | `{ label: 'a'\|'b'\|'c'\|'d', value: string, isCorrect: boolean }` |
| `QuizQuestion` | Interface | `{ direction: QuizDirection, prompt: string, choices: QuizChoice[] }` |


