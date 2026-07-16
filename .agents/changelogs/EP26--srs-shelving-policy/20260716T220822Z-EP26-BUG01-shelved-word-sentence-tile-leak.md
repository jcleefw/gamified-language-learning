# EP26-BUG01: Shelved Word Leaking Into Sentence Tiles

**Created**: 20260716T220822Z
**Epic**: [EP26 - SRS Shelving Policy](../../plans/epics/EP26-srs-shelving-policy.md)
**Status**: Complete ✅

## Summary

`excludeIds` (the shelving exclusion set) was only ever applied to the word-mode MCQ pool in
`assembleBatch`. `resolveEligibleContexts` had no exclusion parameter, so a shelved word could
still be looked up into the sentence tile pool and appear as a tile inside a sentence question —
in both the CLI and demo consumers. A learner who shelved a word could still be quizzed on it via
a sentence. Identified and confirmed against source while reviewing
`product-documentation/rfcs/20260716T095048Z-engineering-domain-logic-protocol-vs-consumer-strategy.md`.

Fix: thread `excludeIds` into `resolveEligibleContexts` so excluded words are removed from the
tile-lookup pool before contexts are resolved. The existing `tiles.length === wordOrder.length`
guard then drops any sentence context that depends on an excluded word — no new invariant logic
was needed, only the missing wiring.

## Files Modified

### `packages/srs-engine-v2/src/engine/sentence-scheduling.ts`
- `resolveEligibleContexts` gains an optional `excludeIds?: Set<string>` parameter
- The tile-lookup pool map now filters out excluded word IDs before building `poolMap`

### `packages/srs-engine-v2/src/__tests__/unit/sentence-spacing.test.ts`
- New `describe('Word-level shelving (excludeIds)')` block — 2 tests: excluding a word used by a
  sentence drops that sentence context; an empty/omitted `excludeIds` is a no-op

### `apps/cli-demo-db/src/learning-io.ts`
- `runBatch` now passes its existing `excludeIds` param through to `resolveEligibleContexts`

### `apps/srs-demo/src/composables/useLearningSession.ts`
- `startBatch` now passes `shelvedSet.value` through to `resolveEligibleContexts`

## Behavior Preserved / New Behavior

- Existing `resolveEligibleContexts` behavior fully preserved when `excludeIds` is omitted/empty
- Shelved words can no longer surface as sentence tiles in either the CLI or demo consumer
- All 217 `srs-engine-v2` tests pass; `cli-demo-db` (`tsc`) and `srs-demo` (`vue-tsc`) typecheck clean

## Next Steps

- Broader batch-integrity work (pure `validateBatch`, CLI/demo convergence on directions and
  batch-size bound) remains open per the RFC above — deferred pending PO decisions on its three
  open questions, out of scope for this bugfix.
