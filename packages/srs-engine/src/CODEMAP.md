# CODEMAP.md — `src/`

No files directly in this folder — only module subfolders, each its own
subpath export (see package root `CODEMAP.md` → Entry Points). There is no
`src/index.ts`.

---

## Subfolders

| Folder | Purpose | CODEMAP |
| --- | --- | --- |
| `src/learn/` | Quiz composition, adaptive session, batch queue, mastery/recheck, sentence scheduling — the `learn` subpath export | [CODEMAP](learn/CODEMAP.md) |
| `src/review/` | FSRS-backed review scheduling — the `review` subpath export | [CODEMAP](review/CODEMAP.md) |
| `src/shelving/` | Stuck-word shelving policy — the `shelving` subpath export | [CODEMAP](shelving/CODEMAP.md) |
| `src/config/` | Language config — `LANGUAGE_CONFIG` for space-less scripts | [CODEMAP](config/CODEMAP.md) |
