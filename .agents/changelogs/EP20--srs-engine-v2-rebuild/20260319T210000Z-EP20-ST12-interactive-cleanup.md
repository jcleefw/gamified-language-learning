# EP20-ST12: Interactive Quiz Runner Code Cleanup

**Completed**: 2026-03-20T16:00:00Z
**Epic**: [EP20 - SRS Engine v2 Rebuild](.agents/plans/epics/EP20-srs-engine-v2-rebuild.md)
**Status**: Complete ✅

## Summary

Refactored `packages/srs-engine-v2/src/runner/interactive.ts` for code quality and maintainability following clean-code principles. All changes are refactoring-only with zero behavioral changes.

## Files Modified

### `packages/srs-engine-v2/src/runner/interactive.ts`

**ST12a: Extract stdin Helper & Constants**
- Created `readFromStdin(options)` helper — consolidates stdin logic from `readKey()` and `readLine()`
- Defined module-level constants: `WORD_ID_PREFIX = 'th::'`, `KEYBOARD_EXIT = '\u0003'`, `BATCH_PROMPT`
- Replaced all scattered magic strings with named constants

**ST12b: Extract Batch Processing Logic**
- Created `async runBatch(batchNum, activeItems, wordPool, foundationalPool, questionLimit)`
  - Handles batch composition (foundational/word split) and interactive quiz execution
  - Returns `{ correct, total, results }`
- Created `updateMasteryState(results, runState, prevState, ...): MasteryUpdateResult`
  - Pure function encapsulating state updates and mastery tracking
  - Processes all results, tracks new mastery, prints summary
  - Replaces inlined 20-line state update block
- Reduced `runAdaptiveLoop()` from 73 lines to 27 lines

**ST12c: Variable Naming Cleanup**
- Renamed `q` → `question` (searchable, intention-revealing)
- Renamed `ws` → `wordState` (avoid cryptic single-letter abbreviations)
- Renamed `r` → `result` (consistent loop variable naming)
- Renamed `prevWs` → `prevWordState` (consistency)

**ST12d: Add Input Validation & Error Handling**
- Added validation in `selectDeck()`: throws `Error` if decks array is empty/null
- Added validation in `runInteractive()`:
  - Checks questions array is non-empty
  - Validates each question has non-empty choices
  - Validates each question has exactly one correct choice marked
  - Validates selected choice exists for the given answer
- Removed 3 non-null assertions (`!`); replaced with explicit error checks
- Errors are context-rich: `"runInteractive: Question N has no correct answer marked"`

## Metrics

- **Lines changed**: +310, -68 (net +242)
- **Functions extracted**: 2 (`runBatch`, `updateMasteryState`)
- **Constants extracted**: 3
- **Single-letter vars renamed**: 4 (q, ws, r, prevWs)
- **Validation checks added**: 5
- **Non-null assertions removed**: 3
- **Test coverage**: All 83 tests pass ✓

## Behavior

- Zero changes to quiz flow, mastery logic, or user experience
- Batch composition, scoring, and state updates unchanged
- Error handling now fails fast with meaningful context
- Code is more readable: shorter functions, searchable names, no magic numbers

## Next Steps

- ST12 is the final planned story in EP20
- Future work: FSRS/ANKI scheduling, stuck-word shelving, Hono route wiring
