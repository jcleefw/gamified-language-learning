# EP06-ST01: Foundational Active Limit + Continuous Wrong Rule

**Created**: 20260308T033100Z
**Epic**: [EP06 - SRS Engine: Foundational Deck](../../plans/epics/EP06-srs-engine-foundational-deck.md)
**Status**: Complete ✅

## Summary

Implemented foundational deck active limit (3-word cap) and continuous wrong rule (mastery reset on 3rd consecutive wrong answer) as pure functions in a new `foundational.ts` module.

## Files Modified

### `packages/srs-engine/src/types.ts`
- Added `consecutiveWrongCount?: number` to `WordState` interface

### `packages/srs-engine/src/foundational.ts` (new)
- `FoundationalActiveResult` interface
- `getActiveFoundationalWords(words, config)` — filters foundational words in learning phase, calculates available slots (max 3), identifies eligible candidates
- `applyFoundationalWrongRule(wordState, config)` — increments consecutive wrong counter; resets mastery to 0 on 3rd consecutive wrong; guards against non-foundational words

### `packages/srs-engine/src/index.ts`
- Added exports for `FoundationalActiveResult`, `getActiveFoundationalWords`, `applyFoundationalWrongRule`

### `packages/srs-engine/src/__tests__/foundational.test.ts` (new)
- 11 unit tests: 6 for active limit (0/2/3/4 active, mixed categories, eligible filtering) + 5 for wrong rule (1st/2nd/3rd wrong, non-foundational guard, undefined counter)

## Behavior Preserved / New Behavior

- **New**: Max 3 foundational words active simultaneously (separate from curated 8-word window)
- **New**: 3 consecutive wrong answers resets `masteryCount` to 0, stays in `learning` phase
- **New**: `consecutiveWrongCount` resets on threshold hit; non-foundational words pass through unchanged
- **Preserved**: All existing 111 tests unchanged and passing

## Next Steps

- EP06-ST02: Foundational batch allocation (`getFoundationalAllocation`)
