# EP04-ST03 & EP04-ST04: Demo Extension & Batch Lifecycle Integration Test

**Created**: 20260307T054200Z
**Epic**: [EP04 - SRS Engine: Batch Composition](../../plans/epics/EP04-srs-engine-batch-composition.md)
**Status**: Complete ✅

## Summary

Added observable end-to-end coverage for `composeBatch`: a terminal demo (ST03) and an integration test suite (ST04) that both drive words through `updateMastery` before calling `composeBatch` — no hand-crafted phase values.

**ST03**: Extended `scripts/demo-srs.ts` with Scenario E (priority ordering with bucket labels) and Scenario F (audio redistribution side-by-side).

**ST04**: Created `__tests__/integration/batch-lifecycle.test.ts` with 4 tests asserting that real mastery-engine output is correctly classified and ordered by `composeBatch`.

## Files Modified

### `scripts/demo-srs.ts`

- Added `composeBatch` to import from `@gll/srs-engine`
- Added `makeWord` and `promoteToReview` helpers to build pool via `updateMastery`
- **Scenario E**: 10-word mixed pool (2 carry-over, 1 found.revision, 5 new, 2 found.learning); prints each question with bucket label and question type; confirms priority order visually
- **Scenario F**: same pool passed to `composeBatch` twice (`audioAvailable: true` vs `false`); prints distribution breakdown side-by-side showing `audio: 1 → 0`, `mc: 7 → 8`

### `packages/srs-engine/__tests__/integration/batch-lifecycle.test.ts` (new file)

- 4 integration tests, all using `promoteToReview()` via real `updateMastery` calls
- Test 1: promoted words appear before learning words regardless of input order
- Test 2: curated `srsM2_review` precedes foundational `srsM2_review` precedes new words
- Test 3: `distributionBreakdown` sums to `batchSize` with a real 10-word pool
- Test 4: `audioAvailable: false` produces `audio=0` and MC absorbs the redistributed slot

## Behavior Preserved / New Behavior

- All existing 43 tests continue to pass — no source code changes
- Demo now exercises `composeBatch` end-to-end alongside the existing mastery/FSRS scenarios
- Integration test fills the cross-component coverage gap: unit tests mock phases; integration tests derive phases from real `updateMastery` output

## Test Results

| Metric                | Value                                       |
| --------------------- | ------------------------------------------- |
| Total tests           | 47/47 pass                                  |
| New integration tests | 4/4 pass                                    |
| TypeScript            | No errors                                   |
| Demo                  | Runs clean (`pnpm tsx scripts/demo-srs.ts`) |

## Next Steps

- Create PR: `feature/EP04-srs-batch-composition` → `main` (human-approved)
