# @gll/srs-shelving

Shelving policy: decides which stagnant words to temporarily remove from active rotation. Pure library — a deterministic function over IDs and config, no I/O. Stagnation *detection* lives elsewhere (the caller supplies stagnant word IDs); this package only decides what to act on.

## Public API

```ts
import { evaluateShelving, unshelveAll, DEFAULT_SHELVING_CONFIG } from '@gll/srs-shelving';
import type { ShelvingConfig, ShelvingDecision, ShelvedWord } from '@gll/srs-shelving';
```

- **`evaluateShelving(stagnantWordIds, currentlyShelved, config)`** → `ShelvingDecision` (`{ toShelve, toUnshelve }`). Skips already-shelved words, respects `config.maxShelved`, preserves input order. `toUnshelve` is always empty (unshelving is handled separately).
- **`unshelveAll()`** → empty `Set<string>`; caller applies it to their shelved state.
- **`ShelvingConfig`** — `{ stagnationBatchWindow, maxShelved }`. `DEFAULT_SHELVING_CONFIG` = `{ stagnationBatchWindow: 3, maxShelved: 2 }`.
- **`ShelvedWord`** — `{ wordId, shelvedAtBatch }`.

## Usage

```ts
const decision = evaluateShelving(stagnantIds, currentlyShelved, DEFAULT_SHELVING_CONFIG);
// decision.toShelve → apply to your shelved state
```
