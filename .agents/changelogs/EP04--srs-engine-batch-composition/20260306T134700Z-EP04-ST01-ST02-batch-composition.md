# EP04-ST01 & EP04-ST02: Batch Composition

**Created**: 20260306T134700Z
**Epic**: [EP04 - SRS Engine: Batch Composition](../../plans/epics/EP04-srs-engine-batch-composition.md)
**Status**: Complete ✅

## Summary

Completed both batch composition stories: implemented priority ordering algorithm and question type distribution with audio redistribution.

**ST01**: Defined batch types and implemented priority ordering (carry-over → foundational revision → new words → foundational learning)

**ST02**: Implemented 70/20/10 question type distribution with audio redistribution to MC when unavailable

## Files Modified

### `packages/srs-engine/src/types.ts`
- Added `QuestionType = 'mc' | 'wordBlock' | 'audio'` type
- Added `Question` interface with `wordId: string` and `type: QuestionType`
- Added `Batch` interface with `questions`, `batchSize`, and `distributionBreakdown`

### `packages/srs-engine/src/batch.ts` (new file)
- Implemented `composeBatch(wordStates, config, options?)` function
- Priority ordering: filters words by category + phase, concatenates in order, slices to `batchSize`
- Question type distribution: calculates slots (70% MC, 20% word-block, 10% audio)
- Audio redistribution: when `audioAvailable: false`, shifts audio slots to MC
- Exports `ComposeBatchOptions` interface for optional parameters

### `packages/srs-engine/src/__tests__/batch.test.ts` (new file)
- 8 tests for priority ordering (all four categories, batchSize limit, edge cases)
- 7 tests for distribution and audio redistribution (ratios, breakdown accuracy, fallback behavior)
- Total: 15 tests, all passing

### `packages/srs-engine/src/index.ts`
- Exported new types: `QuestionType`, `Question`, `Batch`
- Exported new function: `composeBatch`

### `CODEMAP.md`
- Updated entries for `src/batch.ts` and `src/__tests__/batch.test.ts`
- Updated `src/index.ts` entry to reflect new exports

## Behavior Preserved / New Behavior

**Priority Ordering** (ST01):
- Carry-over words (curated, srsM2_review) selected first
- Foundational revision (foundational, srsM2_review) selected second
- New words (curated, learning) selected third
- Foundational learning (foundational, learning) selected last
- Batch size respects `config.batchSize`; returns fewer if pool exhausted

**Question Type Distribution** (ST02):
- Default: 70% MC, 20% word-block, 10% audio (with integer rounding)
- When `audioAvailable: false`: audio slots redistribute to MC, maintaining total = batchSize
- `Batch.distributionBreakdown` accurately reflects allocation counts

## Test Results

| Metric | Value |
|--------|-------|
| Total tests | 43/43 pass |
| Batch tests | 15/15 pass (8 ST01 + 7 ST02) |
| TypeScript | No errors |
| Coverage | All priority categories, distribution paths, audio fallback |

## Next Steps

- Create PR: `feature/EP04-srs-batch-composition` → `main` (human-approved)
- Parallel epics: EP05 (active window) and EP06 (foundational deck) may begin after merge
- EP07 (SRS engine orchestrator) depends on EP04 completion
