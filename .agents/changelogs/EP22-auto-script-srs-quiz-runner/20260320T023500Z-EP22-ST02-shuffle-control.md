# EP22-ST02: Modify composeBatchMulti — Add Shuffle Control

**Created**: 2026-03-20T02:35:00Z
**Status**: Complete ✅

## Summary

Added `shuffle?: boolean` parameter to `composeBatchMulti()` enabling deterministic question ordering in auto mode. Default behavior (`shuffle: true`) preserved for backward compatibility.

## Files Modified

### `packages/srs-engine-v2/src/engine/compose-batch.ts`
- Added `shuffle?: boolean` to options parameter (default: `true`)
- Conditional shuffling of questions within each word
- Conditional shuffling of filler selection
- Conditional final batch shuffle
- When `shuffle: false`: returns coverage first, then filler in deterministic order

### `packages/srs-engine-v2/src/__tests__/unit/compose-batch.test.ts`
- Added 4 new tests for shuffle parameter behavior:
  - `with shuffle: false, returns deterministic question order`
  - `with shuffle: true, may return different order`
  - `defaults to shuffle: true for backward compatibility`
- All 23 existing tests still pass (backward compatible)

## Acceptance Criteria Met

- ✅ `composeBatchMulti(..., { questionLimit: 4 })` returns shuffled (default behavior)
- ✅ `composeBatchMulti(..., { questionLimit: 4, shuffle: true })` returns shuffled
- ✅ `composeBatchMulti(..., { questionLimit: 4, shuffle: false })` returns deterministic order
- ✅ Same input with `shuffle: false` produces identical output across runs
- ✅ Existing tests still pass (backward compatible)

## Test Results

```
✓ src/__tests__/unit/compose-batch.test.ts (23 tests)
  - 19 existing tests: PASS
  - 4 new tests: PASS
```

## Dependencies

- Requires ST01 (no direct dependency, but architecture-aligned)

## Next Step

→ ST03: Create `runAutoInteractive()` runner function
