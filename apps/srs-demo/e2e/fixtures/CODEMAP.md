# CODEMAP.md — `e2e/fixtures/`

Fixture loader + type for seeding a known SRS state before an e2e scenario
runs.

---

## Files

| File | Purpose |
|---|---|
| `index.ts` | Exports `ScenarioFixture` (interface: `deckId`, `wordStates[]`, `stagnationCounters[]`, `shelvedWords[]`, optional `config`) and `ScenarioName` (union of 7 literal names), plus `loadScenario(name)` which reads + parses `scenarios/<name>.json` |

**Drift note (pre-existing, not a CODEMAP issue):** `ScenarioName` includes
`'sentence-context-ready'` as a valid literal, but no
`scenarios/sentence-context-ready.json` file exists — only 6 JSON files are
present (see [scenarios/CODEMAP.md](scenarios/CODEMAP.md)). Calling
`loadScenario('sentence-context-ready')` would throw at runtime.

---

## Subfolders

| Folder | Purpose | CODEMAP |
|---|---|---|
| `scenarios/` | The actual fixture JSON files | [CODEMAP](scenarios/CODEMAP.md) |
