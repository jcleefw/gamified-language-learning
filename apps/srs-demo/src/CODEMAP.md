# CODEMAP.md — `src/`

Root-level files are covered in the package [CODEMAP.md](../CODEMAP.md)
(entry point, layout shell, env, types, router). This file exists per
code-map-guide's "every non-test folder" rule; navigate to subfolder
CODEMAPs for `composables/`, `components/`, `views/`.

No `src/global.css`, `src/utils/`, or `src/stores/` exist yet — RULES.md
documents them as available-but-currently-unused conventions.

---

## Subfolders

| Folder | Purpose | CODEMAP |
|---|---|---|
| `composables/` | State management and reusable logic as Vue composition functions | [CODEMAP](composables/CODEMAP.md) |
| `components/` | Presentational Vue SFCs | [CODEMAP](components/CODEMAP.md) |
| `views/` | Thin route-component wrappers | [CODEMAP](views/CODEMAP.md) |
