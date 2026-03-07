# Current Focus

**Branch**: feature/EP06--srs-engine-foundational-deck
**Updated**: 20260308T040300Z

## Active Work

- **Epic**: EP06 — SRS Engine: Foundational Deck
- **Status**: Impl-Complete — all 5 stories delivered
- **ST01**: ✅ Active limit + continuous wrong rule
- **ST02**: ✅ Batch allocation
- **ST03**: ✅ Demo script scenarios (I, J, K)
- **ST04**: ✅ Foundational lifecycle integration tests (5 tests)
- **ST05**: ✅ Foundational allocation lifecycle integration tests (4 tests)

## What Was Delivered

- `foundational.ts` with 3 pure functions: `getActiveFoundationalWords`, `applyFoundationalWrongRule`, `getFoundationalAllocation`
- `WordState.consecutiveWrongCount` field
- 20 unit tests, all passing
- Exported via `index.ts`, CODEMAP updated
- Demo scenarios I, J, K in `scripts/demo-srs.ts`
- 9 integration tests across 2 new files (`foundational-lifecycle.test.ts`, `foundational-allocation-lifecycle.test.ts`)
- 140 total tests passing across 11 test files

## Next Steps

- Epic is complete. Ready for PR and merge to main.
