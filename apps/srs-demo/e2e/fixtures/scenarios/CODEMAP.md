# CODEMAP.md — `e2e/fixtures/scenarios/`

Fixture JSON files, each matching a `ScenarioFixture` shape
(see [../CODEMAP.md](../CODEMAP.md)), loaded via `loadScenario(name)`.

---

## Files

| File | Scenario (from its own `description` field) |
|---|---|
| `cross-deck-isolation.json` | Words from both `deck-eat` and `deck-weather` seeded; `stagnationBatchWindow=1` triggers shelving in `deck-eat` only — `deck-weather` unaffected |
| `fresh-session-with-shelved-words.json` | Two words pre-shelved in `deck-eat`; starting a new session unshelves all |
| `mid-session-stagnation.json` | All `deck-eat` words at mastery 0, `window=2`, for mid-session shelving tests |
| `minimal-sentence-ready.json` | Only the 6 words of sentence 1, all `seen=1`, for sentence-scheduling tests |
| `stagnant-word-ready-to-shelve.json` | All `deck-eat` words at mastery 0, `window=1`, `maxShelved=2` — one bad batch triggers shelving |
| `two-words-shelved-cap-reached.json` | 3 active words all stagnate but only 2 (of `maxShelved=2`) get shelved — cap enforcement test |

Note: `fixtures/index.ts`'s `ScenarioName` type lists a 7th name,
`sentence-context-ready`, with no corresponding file here — see the drift
note in [../CODEMAP.md](../CODEMAP.md).
