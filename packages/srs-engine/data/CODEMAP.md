# CODEMAP.md — `data/`

Shared type for sample/seed foundational-character data. Navigate to
subfolder CODEMAPs for the actual data sets.

---

## Files

| File | Purpose |
| --- | --- |
| `types.ts` | Exports `FoundationalCharacter` — language-agnostic foundational character shape (`id, char, name, romanization, language, nameThai?, type: 'consonant'\|'vowel'\|'tone', audioFile?, metadata?`). Used by `data/samples/foundations-consonants.ts` |

---

## Subfolders

| Folder | Purpose | CODEMAP |
| --- | --- | --- |
| `data/mock/` | Thai mock decks/words/foundational data, consumed by `demo/` and tests | [CODEMAP](mock/CODEMAP.md) |
| `data/samples/` | Raw sample conversation JSON + hand-authored Thai consonant reference data | [CODEMAP](samples/CODEMAP.md) |
| `data/seed-data/` | Full Thai/Japanese foundational-character seed sets | [CODEMAP](seed-data/CODEMAP.md) |
