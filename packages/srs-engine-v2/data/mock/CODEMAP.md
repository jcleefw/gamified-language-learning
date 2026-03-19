# CODEMAP.md — `data/mock/`

Mock data for development and testing. Not for production use.

---

## Files

| File | Purpose |
| --- | --- |
| `mock-consonants.ts` | 5 Thai consonants used as the quiz content pool |
| `mock-words.ts` | 15 Thai vocabulary items — not yet wired into main pipeline |

---

## Exports — `mock-consonants.ts`

| Export | Kind | Detail |
| --- | --- | --- |
| `MockConsonant` | Interface | `{ id, native, romanization, english, class: 'middle'\|'high'\|'low', language: 'th' }` |
| `mockConsonants` | `MockConsonant[]` | ก (Ko Kai), ข (Kho Khai), ค (Kho Khwai), ง (Ngo Ngu), จ (Cho Chan) |

---

## Exports — `mock-words.ts`

| Export | Kind | Detail |
| --- | --- | --- |
| `MockWord` | Interface | `{ native, romanization, english, type, language: 'th' }` |
| `mockWords` | `MockWord[]` | 15 items across food and weather themes |
