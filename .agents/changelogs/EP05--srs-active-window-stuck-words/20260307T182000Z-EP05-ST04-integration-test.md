# EP05-ST04: Integration Test — Active Window + Stuck Words Lifecycle

**Created**: 20260307T182000Z
**Epic**: [EP05 - SRS Engine: Active Window + Stuck Words](../../plans/epics/EP05-srs-engine-active-window-stuck-words.md)
**Status**: Complete ✅

## Summary

Added `packages/srs-engine/__tests__/integration/active-window-lifecycle.test.ts` with 4 integration tests verifying that the EP05 modules compose correctly with real `updateMastery`-driven word states.

## Files Added

### `packages/srs-engine/__tests__/integration/active-window-lifecycle.test.ts`
- File-level doc comment describing the 4 integration scenarios
- Test 1: Words promoted via `updateMastery` are counted as active by `getEligibleWords`; non-promoted words appear in `eligible`
- Test 2: `newSlots` decreases correctly as the active window fills to `activeWordLimit` (partial fill → 2 slots; full → 0 slots)
- Test 3: `detectStuckWords` correctly identifies words at or above `shelveAfterBatches` threshold; `toShelve` respects `maxShelved` cap
- Test 4: `shelveWord` → `isShelved` → `unshelveWord` round-trip, plus expired `shelvedUntil` returns `false`

## Behavior Preserved / New Behavior

- All 107 pre-existing tests unchanged ✓
- 4 new integration tests pass ✓
- Full suite: 111/111 tests passing

## Key Design Notes

- Local config overrides (`windowConfig`, `shelveConfig`) used in tests 2 and 3 to exercise boundary conditions without large word pools
- `batchesSinceLastProgress` set directly in tests — reflects caller-managed field (not set by `updateMastery`)
- `promoteToReview` helper accepts optional `cfg` param to support local config overrides

## Next Steps

- EP05 complete — raise PR: `feature/EP05-srs-active-window-stuck-words` → `main`
