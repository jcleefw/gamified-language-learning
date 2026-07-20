# CODEMAP.md — `data/seed-data/`

Full foundational-character seed sets (as opposed to `data/mock/`'s small
dev/test subsets). Not yet wired into the demo or engine pipeline.

---

## Files

| File | Purpose |
| --- | --- |
| `thai-full-foundations.ts` | All 44 Thai consonants (middle/high/low class), 28 vowels, 5 tone marks |
| `japanese-full-foundations.ts` | 46 hiragana + 46 katakana entries (kanji not yet seeded) |

---

## Exports — `thai-full-foundations.ts`

| Export | Kind | Detail |
| --- | --- | --- |
| `thaiConsonants` | `ThaiConsonant[]` | 44 entries across all 3 consonant classes |
| `thaiVowels` | `ThaiVowel[]` | 28 entries |
| `thaiTones` | `ThaiTone[]` | 5 entries |

Uses `ThaiConsonant`/`ThaiVowel`/`ThaiTone` from `src/learn/types/foundational.ts`.

---

## Exports — `japanese-full-foundations.ts`

| Export | Kind | Detail |
| --- | --- | --- |
| `japaneseFoundational` | `FoundationalBase[]` | 92 entries — 46 hiragana + 46 katakana, no kanji yet |

Uses `FoundationalBase` from `src/learn/types/foundational.ts`.
