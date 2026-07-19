# CODEMAP.md — `e2e/`

Playwright-BDD end-to-end tests. No files directly in this folder — only the
three subfolders below. `.features-gen/` (sibling, not under `e2e/`) is
`playwright-bdd`-generated output compiled from `features/` + `steps/` —
build output, excluded from CODEMAP.

---

## Subfolders

| Folder | Purpose | CODEMAP |
|---|---|---|
| `features/` | Gherkin `.feature` specs | [CODEMAP](features/CODEMAP.md) |
| `fixtures/` | JSON scenario fixtures + loader | [CODEMAP](fixtures/CODEMAP.md) |
| `steps/` | Playwright-BDD step definitions | [CODEMAP](steps/CODEMAP.md) |
