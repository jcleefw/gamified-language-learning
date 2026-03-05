# EP02-ST04: FsrsScheduler adapter

**Created**: 2026-03-06
**Epic**: [EP02 - SRS Engine Core: Mastery + ANKI Scheduling](../../plans/epics/EP02-srs-engine-mastery.md)
**Status**: Complete ✅

## Summary

Implemented `FsrsScheduler` — a concrete `SpacedRepetitionScheduler` wrapping `ts-fsrs`. Handles ANKI review scheduling with `Rating.Good`/`Rating.Again` mapping, 90-day interval cap, and clean `FsrsCardState` ↔ ts-fsrs `Card` translation (no ts-fsrs types in public surface). Added `ts-fsrs@^5` as a runtime dependency.

## Files Modified

### `packages/srs-engine/package.json`
- Added `ts-fsrs: "^5"` as a runtime dependency

### `packages/srs-engine/src/scheduling/FsrsScheduler.ts` *(new)*
- `FsrsScheduler` class implementing `SpacedRepetitionScheduler`
- Constructor accepts `Pick<SrsConfig, 'desiredRetention' | 'maxIntervalDays'>`
- `scheduleReview`: correct → `Rating.Good`, wrong → `Rating.Again`; caps at `maxIntervalDays`; does not mutate input
- `getNextInterval`: returns 1 for no prior state; returns capped `scheduledDays` otherwise
- `enable_short_term: false` — required for day-based scheduling from first review (ts-fsrs default uses minutes)

### `packages/srs-engine/src/scheduling/__tests__/FsrsScheduler.test.ts` *(new)*
- 11 unit tests covering all spec paths: isLapse flags, increasing intervals, 90-day cap, fresh card, no-mutation, getNextInterval

### `packages/srs-engine/src/index.ts`
- Added `export { FsrsScheduler }` from scheduling module

### `CODEMAP.md`
- Added entries for `FsrsScheduler.ts` and `FsrsScheduler.test.ts`

## Behavior Preserved / New Behavior

- `FsrsScheduler` is the only ts-fsrs-coupled file — `FsrsCardState` remains the sole ts-fsrs-adjacent type in the public API
- `scheduleReview` never mutates the input `WordState`
- `nextIntervalDays` is always `≤ maxIntervalDays`
- First ANKI review of a word (no prior `fsrsState`) produces a valid interval (≥ 1 day)
- Lapse tracking (`isLapse`) is a direct flag — `mastery.ts` owns the 3-lapse reset rule (not this scheduler)

## Next Steps

- EP02-ST05: `scripts/demo-srs.ts` — exercise `updateMastery` + `FsrsScheduler` on one word; observable stdout output
