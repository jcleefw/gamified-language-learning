# CODEMAP.md — `src/config/`

Language config — how words join into a displayed sentence, per language.

---

## Files

| File | Purpose |
| --- | --- |
| `language.ts` | Exports `WordJoin` type (`'space' \| 'no-space'`), `LanguageConfig` interface, `LANGUAGE_CONFIG` record mapping `th/ja/zh/ko → no-space`, `en → space` |
