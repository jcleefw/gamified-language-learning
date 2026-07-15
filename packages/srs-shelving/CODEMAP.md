# packages/srs-shelving CODEMAP

Package: `@gll/srs-shelving`
Purpose: Shelving policy for Learning stage. Detects stagnant words (no mastery progress for N consecutive batches) and manages the shelf queue (max 2 words) to avoid repetitive, frustrating drilling.

## Files

| File | Purpose |
|---|---|
| `src/index.ts` | Public exports: types and policy functions. |
| `src/types.ts` | Type contracts: ShelvingConfig, ShelvedWord, ShelvingDecision, DEFAULT_SHELVING_CONFIG. |
| `src/policy.ts` | Decision logic: evaluateShelving() (detect stagnant words and fill shelf slots), unshelveAll() (reset shelf). |

## Core Concepts

**ShelvingConfig** — Tunable parameters:
- `stagnationBatchWindow`: How many consecutive batches with no mastery progress before a word is flagged stagnant (default: 3).
- `maxShelved`: Max words on the shelf at once (default: 2).

**ShelvedWord** — Metadata for a shelved word:
- `wordId`: The word being shelved.
- `shelvedAtBatch`: Batch number when shelved (for reshelving cooldown, future).

**ShelvingDecision** — Output of policy evaluation:
- `toShelve`: Word IDs to move to the shelf (up to `config.maxShelved`, filtered for already-shelved).
- `toUnshelve`: Word IDs to remove from the shelf (always empty; manual unshelving is caller's responsibility).

## API

**`evaluateShelving(stagnantWordIds, currentlyShelved, config)`**
- Input: list of stagnant word IDs, current shelf state (Set), config.
- Logic:
  1. Calculate available slots: `maxShelved - |currentlyShelved|`.
  2. Filter stagnant IDs: exclude those already on the shelf.
  3. Fill available slots from filtered candidates (order-preserving).
- Output: ShelvingDecision (toShelve list capped at available slots, toUnshelve always []).

**`unshelveAll()`**
- Returns an empty Set, representing all words removed from the shelf.
- Caller applies this to their shelved state.

## Dependencies

| Package | Source | Purpose |
|---|---|---|
| @gll/srs-engine-v2 | `workspace:*` | Type context (word models, session state). |

## Design Notes

- **Stateless policy**: evaluateShelving() is a pure function; state (currentlyShelved) is passed in, not mutated.
- **Respects constraints**: Never exceeds maxShelved cap. Prevents re-shelving of already-shelved words.
- **Single decision direction**: Only provides `toShelve`; unshelving is manual or time-based (future).
- **Order-preserving**: When capping stagnant candidates, respects input order for deterministic selection.
