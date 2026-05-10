# CODEMAP.md — `src/types/`

Shared TypeScript type definitions. No logic except in `word-state.ts`.

---

## Files

| File | Purpose |
| --- | --- |
| `quiz.ts` | Quiz-domain types shared across `engine/` and `demo/` |
| `word-state.ts` | Word mastery/streak state types and pure update functions |
| `deck.ts` | Deck and line types |
| `foundational.ts` | Foundational item types (Thai/Japanese consonants, vowels, tones) |

---

## Exports — `quiz.ts`

| Export | Kind | Shape |
| --- | --- | --- |
| `QuizDirection` | Union | `'native-to-english' \| 'english-to-native' \| 'native-to-romanization' \| 'romanization-to-native'` |
| `QuizChoice` | Interface | `{ label: 'a'\|'b'\|'c'\|'d', value: string, isCorrect: boolean }` |
| `QuizQuestion` | Interface | `{ wordId: string, direction: QuizDirection, prompt: string, choices: QuizChoice[] }` |
| `QuizResult` | Interface | `{ wordId: string, correct: boolean }` |

---

## Exports — `word-state.ts`

| Export | Kind | Detail |
| --- | --- | --- |
| `WordState` | Interface | `{ wordId, seen, correct, mastery, correctStreak, wrongStreak }` |
| `RunState` | Type | `Map<string, WordState>` |
| `StreakThresholds` | Interface | `{ correctStreakThreshold, wrongStreakThreshold, maxMastery }` |
| `updateRunState` | Function | Returns new `RunState` with streak/mastery updated for one answer |
| `isMastered` | Function | `(ws, threshold) → boolean` |

---

## Exports — `deck.ts`

| Export | Kind | Detail |
| --- | --- | --- |
| `MockLine` | Interface | One conversation line with speaker, text fields, and word list |
| `MockDeck` | Interface | `{ id, topic, lines, wordIds }` |

---

## Exports — `foundational.ts`

| Export | Kind | Detail |
| --- | --- | --- |
| `ThaiFoundationalType` | Union | `'consonant' \| 'vowel' \| 'tone'` |
| `JapaneseFoundationalType` | Union | `'hiragana' \| 'katakana' \| 'kanji'` |
| `MockVowel` | Interface | Thai vowel mark with `position` and `length` |
| `MockTone` | Interface | Thai tone mark |
| `MockFoundational` | Union | `MockConsonant \| MockVowel \| MockTone` |
| `ThaiFoundational` | Union | `ThaiConsonant \| ThaiVowel \| ThaiTone` |
