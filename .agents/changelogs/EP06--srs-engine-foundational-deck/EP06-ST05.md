# EP06-ST05: Foundational Allocation Lifecycle Integration Tests

**Created**: 20260308T040300Z
**Epic**: [EP06 - SRS Engine: Foundational Deck](../../plans/epics/EP06-srs-engine-foundational-deck.md)
**Status**: Complete ✅

## Summary

Created `foundational-allocation-lifecycle.test.ts` — 4 cross-module integration tests validating `getFoundationalAllocation` and `composeBatch` with real `updateMastery`-driven word states. No hand-crafted `phase` or `masteryCount` values.

## Files Created

### `packages/srs-engine/__tests__/integration/foundational-allocation-lifecycle.test.ts`
- File-level doc comment listing all 4 scenarios
- Helpers: `makeLearningWord(wordId, category)`, `promoteToReview(word, cfg)`
- Config: `foundationalAllocation: { active: 0.2, postDepletion: 0.05 }` for meaningful slot math
- Test 1: Active pool (some below threshold) → `poolDepleted: false`, `slots: 2` (Math.round(10 × 0.2))
- Test 2: Depleted pool (all past threshold via `updateMastery`) → `poolDepleted: true`, `slots: 1` (Math.round(10 × 0.05))
- Test 3: `composeBatch` ordering — foundational srsM2_review after curated carry-over, before new learning words
- Test 4: Depletion transition — single test promoting remaining word past threshold, verifying 20% → 5% shift

## Behavior Preserved / New Behavior

- **New**: Cross-module lifecycle coverage for `getFoundationalAllocation` + `composeBatch` + `updateMastery`
- **Preserved**: All 136 pre-existing tests unchanged and passing
- **Total**: 140 tests passing across 11 test files

## Next Steps

- EP06 epic is complete — all 5 stories delivered (ST01–ST05)
- Ready for PR review and merge to main
