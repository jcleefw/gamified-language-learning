# current-focus

**Branch**: feature/EP24--srs-demo-webapp
**Last updated**: 20260512T220218Z

## Status

EP24 Vue SRS demo webapp — queue filter bug fixed. EP25 was withdrawn; see decision record in `product-documentation/prds/20260512T165320Z-per-deck-word-state.md`.

## Completed Epics
- EP20-ST13 support for other foundational words (vowels, etc)
- EP21 srs-engine-v2 library boundary + revision phase
- EP22 auto-script SRS quiz runner
- EP24 Vue SRS demo app (stories complete, queue filter bug fixed)

## EP24 Bug — FIXED (20260512T220218Z)

**Bug**: `nextActivePool` pulled mastered words from queue blindly — mastered words re-entered active pool on deck switch.

**Fix**: filtered mastered words from queue before slicing in `nextActivePool` (`session.ts:72`). Two new tests added. Engine rebuilt. Commit: `ce2e3d7`.

## What's next (after bug fix)

1. Post-mastery scheduling — FSRS/ANKI (already in original product docs, planned)
2. Sentence/word-block question type — new EP, tests contextual usage

## Open product questions (captured 20260512T220218Z)

- Is "word block" the intended name for the sentence construction question type?
- Should post-mastery scheduling or sentence questions come first?
- Does `composeBatch` need to be aware of sentence-level question types, or is that a separate system outside the SRS engine?
