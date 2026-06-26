# EP26-ST01: srs-shelving DS01→DS02 Corrective

**Created**: 20260626T130504Z
**Epic**: [EP26 - SRS Shelving Policy](../../plans/epics/EP26-srs-shelving-policy.md)
**Status**: Complete ✅

## Summary

Purged DS01 stagnation artifacts from `@gll/srs-shelving`. DS01 had in-memory stagnation detection (`recordMasterySnapshot`, `detectStagnantWords`, `MasterySnapshot`, `MasteryHistory`) in the package. DS02 moves detection to the DB layer (persistent counters). The package now contains only policy types and cap-enforcement functions.

## Files Modified

### `packages/srs-shelving/src/types.ts`
- Removed `MasterySnapshot` interface and `MasteryHistory` type alias

### `packages/srs-shelving/src/stagnation.ts`
- **Deleted** — DS01 stagnation detection functions removed entirely

### `packages/srs-shelving/src/__tests__/unit/stagnation.test.ts`
- **Deleted** — tests for removed functions

### `packages/srs-shelving/src/index.ts`
- Removed exports: `MasterySnapshot`, `MasteryHistory`, `recordMasterySnapshot`, `detectStagnantWords`
- Retained: `ShelvingConfig`, `DEFAULT_SHELVING_CONFIG`, `ShelvedWord`, `ShelvingDecision`, `evaluateShelving`, `unshelveAll`

### `packages/srs-shelving/src/__tests__/unit/exports.test.ts`
- Rewrote to match reduced export surface — removed DS01 function tests and type assertions

## Behavior Preserved / New Behavior

- `evaluateShelving` and `unshelveAll` unchanged — reused from DS01 as-is
- Stagnation detection responsibility moved to `@gll/db` layer (DS02 design)
- Package surface is now minimal: types + cap enforcement only

## Next Steps

- EP26-ST02: Verify `assembleBatch` `excludeIds` filter (already implemented in DS01 worktree)
