# EP02-ST03: SpacedRepetitionScheduler interface + ReviewResult type

**Created**: 2026-03-06T00:00:00Z
**Epic**: [EP02 - SRS Engine Core: Mastery + ANKI Scheduling](../../plans/epics/EP02-srs-engine-mastery.md)
**Status**: Complete ✅

## Summary

Defined the scheduling domain interface and result type. Pure type definitions — no runtime logic. Establishes the contract that `FsrsScheduler` (EP02-ST04) must implement.

## Files Modified

### `packages/srs-engine/src/scheduling/types.ts` (new)
- `ReviewResult` interface: `nextIntervalDays`, `updatedFsrsState`, `isLapse`

### `packages/srs-engine/src/scheduling/scheduler.interface.ts` (new)
- `SpacedRepetitionScheduler` interface: `scheduleReview` + `getNextInterval`

### `packages/srs-engine/src/index.ts`
- Added exports: `SpacedRepetitionScheduler`, `ReviewResult`

## Behavior Preserved / New Behavior

- `SpacedRepetitionScheduler` and `ReviewResult` now exported from `@gll/srs-engine`
- `pnpm build` exits 0 with no TypeScript errors
- No `any` types; no ts-fsrs types leak into public surface

## Next Steps

- EP02-ST04: FsrsScheduler adapter — implement `SpacedRepetitionScheduler` wrapping `ts-fsrs`
