# EP06-ST02: Foundational Batch Allocation

**Created**: 20260308T033500Z
**Epic**: [EP06 - SRS Engine: Foundational Deck](../../plans/epics/EP06-srs-engine-foundational-deck.md)
**Status**: Complete ✅

## Summary

Implemented `getFoundationalAllocation` — returns batch slot count (20% active / 5% depleted) and pool depletion status based on mastery threshold.

## Files Modified

### `packages/srs-engine/src/foundational.ts`

- Added `FoundationalAllocation` interface (`slots`, `poolDepleted`)
- Added `getFoundationalAllocation(totalBatchSize, foundationalWords, config)` — depletion check via `masteryThreshold.foundational`, slot calculation via `Math.round`

### `packages/srs-engine/src/index.ts`

- Added exports for `FoundationalAllocation` type and `getFoundationalAllocation` function

### `packages/srs-engine/src/__tests__/foundational.test.ts`

- 9 new tests: active/depleted allocation modes, empty array, mixed mastery, threshold boundary, batchSize 0 and 1 edge cases

## Behavior Preserved / New Behavior

- **New**: 20% of batch slots allocated to foundational words when pool is active
- **New**: 5% allocation when pool is depleted (all words at/above mastery threshold)
- **New**: Empty foundational word list treated as depleted
- **Preserved**: All 111 pre-existing tests unchanged and passing

## Next Steps

- EP06 epic is complete — all stories delivered
