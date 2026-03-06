# Current Focus

**Branch**: feature/EP05-srs-active-window-stuck-words
**Updated**: 20260307T160000Z

## Status: COMPLETE

Both ST01 and ST02 implemented, committed, changelogs written, CODEMAP updated.

## EP05 Story Status

| Story | Title | Status |
|---|---|---|
| EP05-ST01 | Active window management | Done |
| EP05-ST02 | Stuck word detection + shelving | Done |

## What Was Built

### ST01 — `packages/srs-engine/src/active-window.ts`
- `getEligibleWords(allWords, config): EligibleWordsResult`
- `active`: words with `phase === 'srsM2_review'`
- `newSlots`: `Math.min(newWordsPerBatch, Math.max(0, activeWordLimit - active.length))`
- `eligible`: all non-review words (shelved words NOT filtered — caller's responsibility)
- 20 unit tests, all pass

### ST02 — `packages/srs-engine/src/stuck-words.ts`
- `detectStuckWords(wordStates, config): StuckWordsResult`
- `shelveWord(word, durationMs): WordState` — immutable, sets `shelvedUntil`
- `unshelveWord(word): WordState` — clears to null
- `isShelved(word): boolean` — time-aware (checks future date)
- 40 unit tests, all pass

### Types (`types.ts`)
- `WordState.batchesSinceLastProgress?: number`
- `WordState.shelvedUntil?: Date | null`
- `SrsConfig.shelveAfterBatches: number`
- `SrsConfig.maxShelved: number`

## Key Design Decisions

- Active window marker = `srsM2_review` phase; no extra `isActive` flag
- When `shelveCapacity > 0`: shelve oldest stuck words up to capacity
- When `shelveCapacity === 0` and stuck words exist: `toShelve` returns newest stuck word; `canReShelve: false` — caller must check flag before acting
- `getEligibleWords` does not filter shelved words from `eligible`

## Known Gaps (Deferred to EP07)

- `batchesSinceLastProgress` increment/reset — handled in mastery update flow, not here
- Shelved word re-entry as carry-over — batch composition wiring
- Pre-existing integration test failure: `batch.js` missing from `index.ts` (unrelated to EP05)

## Next Steps

- Raise PR for EP05 → merge to main
- EP07: wire active-window + stuck-words into batch composition
