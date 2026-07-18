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
| `MockWord` | Interface | `{ native, romanization, english, type, language: 'th' }` |
| `mockWords` | `MockWord[]` | 15 items across food and weather themes |

