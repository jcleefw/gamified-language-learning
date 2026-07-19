# CODEMAP.md — `data/mock/`

Mock data for development and testing. Not for production use.

---

## Files

| File | Purpose |
| --- | --- |
| `mock-consonants.ts` | 5 Thai consonants used as the quiz content pool |
| `mock-vowels.ts` | 5 Thai vowel marks with placeholder carrier |
| `mock-tones.ts` | 5 Thai tone marks with placeholder carrier |
| `mock-words.ts` | 15 Thai vocabulary items — not yet wired into main pipeline |
| `mock-decks.ts` | 2 conversation decks ("let's eat something", "the weather is hot today") built from `MockLine`/`MockDeck` (see `src/learn/types/deck.ts`) |
| `mock-word-pool.ts` | Global de-duplicated `wordPool` — union of unique words referenced across `mock-decks.ts` |

---

## Exports — `mock-consonants.ts`

| Export | Kind | Detail |
| --- | --- | --- |
| `MockConsonant` | Interface | `{ id, foundationalType: 'consonant', native, romanization, english, class: 'middle'\|'high'\|'low', language: 'th' }` |
| `mockConsonants` | `MockConsonant[]` | ก (Ko Kai), ข (Kho Khai), ค (Kho Khwai), ง (Ngo Ngu), จ (Cho Chan) |

---

## Exports — `mock-vowels.ts`

| Export | Kind | Detail |
| --- | --- | --- |
| `mockVowels` | `MockVowel[]` | 5 core Thai vowels (ี, า, ิ, ึ, ื) with `อ` carrier |

---

## Exports — `mock-tones.ts`

| Export | Kind | Detail |
| --- | --- | --- |
| `mockTones` | `MockTone[]` | 4 tone marks (เอก, โท, ตรี, จัตวา) + mid tone |

---

## Exports — `mock-words.ts`

| Export | Kind | Detail |
| --- | --- | --- |
| `MockWord` | Interface | `{ id, native, romanization, english, type, language: 'th' }` |
| `mockWords` | `MockWord[]` | 15 items across food and weather themes |

---

## Exports — `mock-decks.ts`

| Export | Kind | Detail |
| --- | --- | --- |
| `mockDecks` | `MockDeck[]` | `deck-eat` (4 lines, 6 words) and `deck-weather` (4 lines, 6 words); each line carries native/romanization/english + its `MockWord[]` |

---

## Exports — `mock-word-pool.ts`

| Export | Kind | Detail |
| --- | --- | --- |
| `wordPool` | `MockWord[]` | 12 unique words — union across both `mock-decks.ts` decks, each appearing exactly once |
