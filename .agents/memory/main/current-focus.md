# Current Focus

**Branch**: main
**Updated**: 20260307T183000Z

## Active Work

- **Epic**: EP05 — SRS Engine: Active Window + Stuck Words
- **Status**: Impl-Complete — all 4 stories done, awaiting human PR review

## EP05 Completed Stories

- **EP05-ST01**: `active-window.ts` — `getEligibleWords` with sliding window + slot cap ✅
- **EP05-ST02**: `stuck-words.ts` — `detectStuckWords`, `shelveWord`, `unshelveWord`, `isShelved` ✅
- **EP05-ST03**: Demo script Scenarios G + H (active window slots, stuck word detection) ✅
- **EP05-ST04**: Integration test `active-window-lifecycle.test.ts` (4 tests) ✅

## What Was Built

- `packages/srs-engine/src/active-window.ts` — `getEligibleWords(allWords, config): EligibleWordsResult`
- `packages/srs-engine/src/stuck-words.ts` — detection, shelving, unshelving, isShelved
- `packages/srs-engine/src/types.ts` — `WordState.batchesSinceLastProgress`, `WordState.shelvedUntil`, `SrsConfig.shelveAfterBatches`, `SrsConfig.maxShelved`
- `packages/srs-engine/src/index.ts` — exports for all new functions + types
- `packages/srs-engine/__tests__/integration/active-window-lifecycle.test.ts` — 4 integration tests
- `scripts/demo-srs.ts` — Scenarios G + H added

## Test State

111/111 tests passing. `pnpm tsx scripts/demo-srs.ts` runs clean.

## Recently Merged

- **EP04** — SRS Engine: Batch Composition — merged to main ✅

## Next Steps

- Raise PR: `feature/EP05-srs-active-window-stuck-words` → `main`
- EP06: Foundational deck (in progress on separate branch)
- EP07: Wire active-window + stuck-words into batch composition
