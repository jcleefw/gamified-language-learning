# EP05-ST01: Active Window Management

**Created**: 20260306T130000Z
**Epic**: [EP05 - SRS Engine: Active Window + Stuck Words](../../plans/epics/EP05-srs-engine-active-window-stuck-words.md)
**Status**: Complete ✅

## Summary

Implemented active window management module to enforce learning efficiency constraints. The 8-word active limit prevents cognitive overload, while the 4-new-per-batch cap ensures learners focus on core vocabulary before expanding. Words in the `srsM2_review` phase are identified as "active" — a natural entry point after mastery is demonstrated.

**Key Implementation**:
- Extended `WordState` type with `batchesSinceLastProgress?` and `shelvedUntil?` fields (for EP05-ST02 dependency)
- Created `getEligibleWords()` function: identifies active words, calculates available new-word slots, filters eligible candidates
- Comprehensive unit tests: 20 tests covering boundary cases (0–8 active, slot math, filtering, immutability, edge configs)

## Files Modified

### `packages/srs-engine/src/types.ts`
- Extended `WordState` interface with `batchesSinceLastProgress?: number` and `shelvedUntil?: Date | null`
- Rationale: These fields are required by EP05-ST02 (stuck word detection). Defining them here ensures type consistency across the epic.

### `packages/srs-engine/src/active-window.ts` (NEW)
- Defined `EligibleWordsResult` interface: `{ active: WordState[], newSlots: number, eligible: WordState[] }`
- Implemented `getEligibleWords(allWords, config): EligibleWordsResult`
  - Filters words where `phase === 'srsM2_review'` as active
  - Calculates `newSlots = Math.min(newWordsPerBatch, Math.max(0, activeWordLimit - active.length))`
  - Returns remaining words as eligible candidates
- Pure function, immutable, no side effects

### `packages/srs-engine/src/__tests__/active-window.test.ts` (NEW)
- 20 unit tests in 5 suites:
  - **Active window filtering**: returns review-phase words
  - **New slots calculation**: enforces 8-word ceiling + 4-per-batch cap
  - **Eligible filtering**: returns non-active candidates
  - **Immutability**: input state unchanged
  - **Edge cases**: empty input, single words, edge configs

### `packages/srs-engine/src/index.ts`
- Added exports: `EligibleWordsResult` type and `getEligibleWords` function

## Behavior Preserved / New Behavior

**New**:
- `getEligibleWords()` now available to batch composition layer (EP04/EP07)
- Active window limit enforced: max 8 concurrent words in learning pipeline
- New word introduction capped at 4 per batch, preventing overwhelming learners

**Preserved**:
- All existing tests pass (56/56 tests green)
- No changes to mastery logic, batch composition, or scheduling
- Backward compatible: new fields optional on `WordState`

## Test Results

```
 Test Files  5 passed (5)
      Tests  56 passed (56)
      Duration  477ms
```

- ✅ All boundary cases tested (0–8 active words, slot math)
- ✅ Immutability verified
- ✅ Edge configs handled (activeWordLimit=0, newWordsPerBatch=0)
- ✅ TypeScript type-check: no errors

## Next Steps

- **EP05-ST02**: Implement stuck word detection + shelving using the extended `WordState` fields
- **EP04/EP07**: Wire `getEligibleWords()` into batch composition logic
