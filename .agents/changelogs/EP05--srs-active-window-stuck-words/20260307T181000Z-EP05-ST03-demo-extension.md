# EP05-ST03: Demo Script Extension — Active Window + Stuck Words

**Created**: 20260307T181000Z
**Epic**: [EP05 - SRS Engine: Active Window + Stuck Words](../../plans/epics/EP05-srs-engine-active-window-stuck-words.md)
**Status**: Complete ✅

## Summary

Extended `scripts/demo-srs.ts` with two new scenarios demonstrating the EP05 modules (`getEligibleWords`, `detectStuckWords`, `shelveWord`, `unshelveWord`, `isShelved`) end-to-end using realistic word pools.

## Files Modified

### `scripts/demo-srs.ts`

- Added `getEligibleWords`, `detectStuckWords`, `shelveWord`, `unshelveWord`, `isShelved` to the import from `@gll/srs-engine`
- Added **Scenario G**: Active window slot calculation using a local `windowConfig` (`activeWordLimit=5`) to show `newSlots` decreasing to 0 as the window fills; reuses existing `makeWord`/`promoteToReview` helpers
- Added **Scenario H**: Stuck word detection and shelving — sets `batchesSinceLastProgress` directly (caller-managed field), calls `detectStuckWords`, demonstrates `shelveWord`/`isShelved`/`unshelveWord` transitions, and shows cap behaviour (`canReShelve=false`) using a local `shelveConfig` (`maxShelved=2`)

### `packages/srs-engine` (build)

- Ran `pnpm build` to emit `dist/active-window.js` and `dist/stuck-words.js` (had not been built since EP05 implementation)

## Behavior Preserved / New Behavior

- All existing Scenarios A–F output unchanged ✓
- Scenario G output: `active=3 → newSlots=2`, `active=5 → newSlots=0`
- Scenario H output: stuck words detected, shelve/unshelve round-trip, cap with `canReShelve=false` and newest stuck word in `toShelve`
- `pnpm tsx scripts/demo-srs.ts` exits clean, no TypeScript errors

## Key Design Notes

- Local config overrides (`windowConfig`, `shelveConfig`) used to demonstrate boundary conditions without requiring 20 or 50 words
- `batchesSinceLastProgress` set directly in demo — reflects its caller-managed nature (not set by `updateMastery`)

## Next Steps

- EP05-ST04: Integration test — `active-window-lifecycle.test.ts`
