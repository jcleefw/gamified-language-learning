# EP26-ST02: `excludeIds` Filter in `assembleBatch`

**Created**: 20260626T130504Z
**Epic**: [EP26 - SRS Shelving Policy](../../plans/epics/EP26-srs-shelving-policy.md)
**Status**: Complete ✅

## Summary

Engine change carried over from DS01 worktree — already implemented and verified. `assembleBatch` now accepts `excludeIds?: Set<string>` to skip shelved words during question generation while keeping them in the `active` array (preserving slot).

## Files Modified

### `packages/srs-engine-v2/src/engine/assemble-batch.ts`
- Added `excludeIds?: Set<string>` to `AssembleBatchOptions`
- Filters `active` items through `excludeIds` before partitioning into foundational/vocabulary

### `packages/srs-engine-v2/src/__tests__/unit/assemble-batch-exclude.test.ts`
- **New file** — 6 tests covering: excluded word produces no questions, non-excluded word is unaffected, undefined/empty excludeIds is a no-op, ghost IDs are harmless

## Behavior Preserved / New Behavior

- Existing `assembleBatch` behavior fully preserved when `excludeIds` is absent or empty
- Shelved words excluded from question generation but remain in `active` array (slot held)
- 204 engine tests pass unchanged

## Next Steps

- EP26-ST03: Stagnation tracking schema + LearningStore extension
