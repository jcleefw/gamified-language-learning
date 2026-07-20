# CODEMAP.md — `data/samples/`

Raw sample/reference source data — a step upstream of `data/mock/`, not
directly wired into the engine pipeline.

---

## Files

| File | Purpose |
| --- | --- |
| `conversations-2026-03-08.json` | Raw seed conversation data — 2 topics (`let's eat something`, weather), each with `lines[]` (`speaker`, `thai`, `english`, `romanization`). Source material `data/mock/mock-decks.ts` was hand-derived from |
| `foundations-consonants.ts` | Hand-authored reference data for all 44 Thai consonants — full metadata (class, soundClass, IPA, pronunciation, audio file, notes) per character |

---

## Exports — `foundations-consonants.ts`

| Export | Kind | Detail |
| --- | --- | --- |
| `consonants` | `FoundationalCharacter[]` | All 44 Thai consonants, each defined as an individual named `const` (`KO_KAI`, `KHO_KHAI`, …) then collected into this array |
| `getConsonantById` | `(id: string) => FoundationalCharacter \| undefined` | Lookup by `id` |
| `getConsonantByChar` | `(char: string) => FoundationalCharacter \| undefined` | Lookup by Thai character |

Uses `FoundationalCharacter` from `../types.ts`.
