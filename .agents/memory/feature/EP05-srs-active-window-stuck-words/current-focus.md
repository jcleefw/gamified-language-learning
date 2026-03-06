# Current Focus

**Branch**: feature/EP05-srs-active-window-stuck-words
**Updated**: 20260306T130000Z

## Active Work

- **Epic**: EP05 — SRS Engine: Active Window + Stuck Words
- **Story**: EP05-ST01 ✅ → **EP05-ST02 next**
- **Status**: ST01 done, committed, changelog written, CODEMAP updated

## Last Session Outcome

EP05-ST01 — Active window management implemented.
- Created `packages/srs-engine/src/active-window.ts` — `getEligibleWords()` with 8-word limit + 4-new-per-batch cap
- Added `batchesSinceLastProgress?: number` and `shelvedUntil?: Date | null` to `WordState` (needed by ST02)
- 20 unit tests in `src/__tests__/active-window.test.ts` — all pass
- Exported from `index.ts`
- **Next**: EP05-ST02 — stuck word detection + shelving (`stuck-words.ts`)

## EP05 Story Status

| Story | Title | Status |
|---|---|---|
| EP05-ST01 | Active window management | ✅ Done |
| EP05-ST02 | Stuck word detection + shelving | 🔲 Not started |

## Key Design Decisions

- **Active window marker**: `phase === 'srsM2_review'` = active in the window. No extra `isActive` flag needed. Words enter the active window when masteryCount reaches threshold and phase transitions to `srsM2_review`.
- **newSlots formula**: `Math.min(newWordsPerBatch, Math.max(0, activeWordLimit - active.length))`
- **ST02 fields pre-added to WordState**: `batchesSinceLastProgress` and `shelvedUntil` — optional, not used by ST01 logic

## ST02 Starting Point

Build `packages/srs-engine/src/stuck-words.ts`:
- `detectStuckWords(wordStates, config)` — flags words with no mastery progress after 3 consecutive batches
- `shelveWord` / `unshelveWord` — sets `shelvedUntil` to `now + 1 day`
- Max 2 shelved at a time; when cap reached, newest stuck word is shelved (3rd waits)
- Shelved words re-enter as carry-over on next eligible batch

File ownership for ST02:
- `src/stuck-words.ts` ← new file
- `src/__tests__/stuck-words.test.ts` ← new test file
- `src/index.ts` ← add exports
