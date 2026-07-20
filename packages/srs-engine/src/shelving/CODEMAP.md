# CODEMAP.md — `src/shelving/`

Stuck-word shelving policy — the `shelving` subpath export
(`@gll/srs-engine/shelving`). Decides which stagnant words to pull out of
active rotation, given a per-batch stagnation window and a cap on how many
words can be shelved at once.

---

## Files

| File | Purpose |
| --- | --- |
| `index.ts` | Public barrel — re-exports types `ShelvingConfig`, `ShelvedWord`, `ShelvingDecision`, value `DEFAULT_SHELVING_CONFIG`, functions `evaluateShelving`, `unshelveAll` |
| `types.ts` | Config, state, and decision shapes |
| `policy.ts` | The shelving/unshelving decision logic |

---

## Exports — `types.ts`

| Export | Kind | Detail |
| --- | --- | --- |
| `ShelvingConfig` | Interface | `{ stagnationBatchWindow, maxShelved }` — consecutive no-progress batches before shelving; max simultaneously shelved |
| `DEFAULT_SHELVING_CONFIG` | Const | `{ stagnationBatchWindow: 3, maxShelved: 2 }` |
| `ShelvedWord` | Interface | `{ wordId, shelvedAtBatch }` |
| `ShelvingDecision` | Interface | `{ toShelve: string[], toUnshelve: string[] }` |

---

## Exports — `policy.ts`

| Export | Signature | Purpose |
| --- | --- | --- |
| `evaluateShelving` | `(stagnantWordIds: string[], currentlyShelved: Set<string>, config: ShelvingConfig) → ShelvingDecision` | Fills only `config.maxShelved` available slots, filters out words already shelved, preserves input order when capping. `toUnshelve` is always empty — unshelving is handled separately |
| `unshelveAll` | `() → Set<string>` | Returns an empty set representing "all unshelved"; caller applies it to their own shelved-state store |
