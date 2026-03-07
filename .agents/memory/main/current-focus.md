# Current Focus

**Branch**: main
**Updated**: 20260308T040300Z

## Active Work

- **Epic**: EP06 — SRS Engine: Foundational Deck
- **Status**: Impl-Complete — all 5 stories delivered, awaiting human PR review

## EP06 Completed Stories

- **EP06-ST01**: `foundational.ts` — `getActiveFoundationalWords`, `applyFoundationalWrongRule`; `WordState.consecutiveWrongCount` ✅
- **EP06-ST02**: `foundational.ts` — `getFoundationalAllocation`; exported via `index.ts`, CODEMAP updated ✅
- **EP06-ST03**: Demo script Scenarios I, J, K (active limit, wrong rule, batch allocation) ✅
- **EP06-ST04**: Integration test `foundational-lifecycle.test.ts` (5 tests) ✅
- **EP06-ST05**: Integration test `foundational-allocation-lifecycle.test.ts` (4 tests) ✅

## What Was Built

- `packages/srs-engine/src/foundational.ts` — 3 pure functions: `getActiveFoundationalWords`, `applyFoundationalWrongRule`, `getFoundationalAllocation`
- `packages/srs-engine/src/types.ts` — `WordState.consecutiveWrongCount`, `SrsConfig.foundationalAllocation`, `SrsConfig.continuousWrongThreshold`
- `packages/srs-engine/src/index.ts` — exports for all new functions + types
- `packages/srs-engine/__tests__/integration/foundational-lifecycle.test.ts` — 5 integration tests
- `packages/srs-engine/__tests__/integration/foundational-allocation-lifecycle.test.ts` — 4 integration tests
- `scripts/demo-srs.ts` — Scenarios I, J, K added

## Test State

140/140 tests passing across 11 test files.

## Recently Merged

- **EP04** — SRS Engine: Batch Composition — merged to main ✅
- **EP05** — SRS Engine: Active Window + Stuck Words — merged to main ✅

## Next Steps

- Raise PR: `feature/EP06--srs-engine-foundational-deck` → `main`
- EP07: Wire active-window + stuck-words into batch composition
