# EP02-ST05: SRS core demo script

**Created**: 2026-03-06
**Epic**: [EP02 - SRS Engine Core: Mastery + ANKI Scheduling](../../plans/epics/EP02-srs-engine-mastery.md)
**Status**: Complete ✅

## Summary

Created `scripts/demo-srs.ts` — a runnable checkpoint that exercises `updateMastery` + `FsrsScheduler` directly on one word. Prints mastery count incrementing, phase flipping to `srsM2_review`, and the first ANKI interval to stdout. Added `tsx` and `@gll/srs-engine` as root devDeps, `"demo"` script, and `"type": "module"` to root `package.json` (required for tsx to resolve ESM-only package exports).

EP02 is now Impl-Complete.

## Files Modified

### `package.json` (root)
- Added `"type": "module"` — required for tsx ESM resolution of `@gll/srs-engine` exports
- Added `"@gll/srs-engine": "workspace:*"` and `"tsx": "^4"` to devDeps
- Added `"demo": "tsx scripts/demo-srs.ts"` script

### `scripts/demo-srs.ts` *(new)*
- Hardcoded `SrsConfig` (curated threshold=10, desiredRetention=0.9, maxIntervalDays=90)
- Hardcoded `WordState` (wordId='hello', category='curated', phase='learning', masteryCount=0)
- Loop calling `updateMastery(word, true, config)` until phase flips; prints masteryCount each iteration
- Calls `FsrsScheduler.scheduleReview` once in ANKI phase; prints `nextIntervalDays`
- Imports only from `@gll/srs-engine`

### `CODEMAP.md`
- Added entry for `scripts/demo-srs.ts`

### `.agents/plans/epics/EP02-srs-engine-mastery.md`
- Status updated: `Accepted` → `Impl-Complete`

## Behavior Preserved / New Behavior

- `pnpm demo` runs without errors
- Stdout shows mastery: 1→10, phase flip at 10, nextIntervalDays: 3
- All 24 engine unit tests still pass (`pnpm test`)
- No new engine code — demo script only

## Next Steps

- EP02 → Impl-Complete; human PR to merge epic branch into main
- Next epic: EP03 (batch composition) or EP06 (SrsEngine class orchestration) per build sequence
