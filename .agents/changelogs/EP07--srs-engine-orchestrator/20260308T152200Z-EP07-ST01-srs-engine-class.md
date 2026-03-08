# EP07-ST01: SrsEngine Class + Config Validation + composeBatch

**Created**: 20260308T152200Z
**Epic**: [EP07 - SRS Engine: Answer Processing + SrsEngine Class](../../plans/epics/EP07-srs-engine-orchestrator.md)
**Status**: Complete ✅

## Summary

Implemented the `SrsEngine` orchestrator class with config validation on construction and a `composeBatch` method that filters shelved words, applies active-window slot limits, and delegates to the existing `batch.ts` module.

## Files Modified

### `packages/srs-engine/src/srs-engine.ts` (new)
- `SrsEngine` class with `private readonly config` and `private readonly scheduler` (FsrsScheduler)
- `constructor(config)` — calls `validateConfig` (throws descriptive errors on invalid values); constructs `FsrsScheduler`
- `composeBatch(wordStates, options?)` — filters shelved words via `isShelved`; applies `getEligibleWords` to limit learning words to `newSlots`; delegates to `composeBatch` from `batch.ts`
- `validateConfig(config)` — validates: `batchSize`, `masteryThreshold.curated`, `masteryThreshold.foundational`, `lapseThreshold`, `activeWordLimit`, `newWordsPerBatch`, `shelveAfterBatches`, `maxShelved`, `continuousWrongThreshold`, `desiredRetention`, `maxIntervalDays`

### `packages/srs-engine/src/index.ts`
- Added `export { SrsEngine } from './srs-engine.js'`

### `packages/srs-engine/src/CODEMAP.md`
- Added `SrsEngine` to Public API exports list
- Added `srs-engine.ts` row to Domain Modules table

## Behavior

- **New**: `new SrsEngine(config)` throws with a field-prefixed message (e.g. `SrsConfig: batchSize must be > 0`) on any invalid config value
- **New**: `engine.composeBatch(wordStates)` excludes shelved words and respects `newWordsPerBatch` before delegating to `batch.ts`

## Next Steps

- EP07-ST02: `processAnswers` + integration tests
