# EP20-ST02: Project scaffold + test harness

**Created**: 20260319T030145Z
**Epic**: [EP20 - SRS Engine v2: Rebuild from Scratch](../../plans/epics/EP20-srs-engine-v2-rebuild.md)
**Status**: Complete ✅

## Summary

Wired up `packages/srs-engine-v2` so it is runnable from root via `pnpm quizv2` and testable via vitest. Added a smoke test to confirm the mock data loads correctly.

## Files Modified

### package.json (root)

- Added `"quizv2": "tsx packages/srs-engine-v2/src/main.ts"` script

### packages/srs-engine-v2/src/main.ts

- Replaced TODO stub with a minimal runnable: loads first mock consonant and prints a quiz Q/A to stdout

### packages/srs-engine-v2/__tests__/setup.ts

- Created empty setup file required by `vitest.config.ts` `setupFiles` entry

### packages/srs-engine-v2/__tests__/integration/smoke.test.ts

- 2 tests: mock consonants array is non-empty, first card has all required fields with correct types

## Behavior Preserved / New Behavior

- `pnpm quizv2` runs from workspace root, prints first consonant card
- `pnpm --filter @gll/srs-engine-v2 test` runs vitest and passes 2 smoke tests
- No engine logic introduced — scaffold only

## Next Steps

- ST03 — Define `WordState` type and engine types
