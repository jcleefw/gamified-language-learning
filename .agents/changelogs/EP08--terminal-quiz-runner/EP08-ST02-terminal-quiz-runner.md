# EP08-ST02: Terminal Quiz Runner

**Created**: 20260310T002305Z
**Epic**: [EP08 - Terminal Quiz Runner + Seed Data](../../plans/epics/EP08-terminal-quiz-runner.md)
**Status**: Complete ✅

## Summary

Implemented an interactive terminal script that wires the SRS engine end-to-end with real Thai
content. The runner loads 5 foundational consonants and curated conversation words, then loops
`composeBatch → stdin answers (c/w/q) → processAnswers → mastery summary` until the user quits
or all words are mastered. Consumer-layer `thai → native` adaptation keeps the sample JSON
unchanged while satisfying the language-agnostic mapper API.

## Files Modified

### `scripts/quiz-runner.ts` _(created)_

- Loads first 5 consonants from `foundations-consonants.ts` via `characterToWordState()`
- Reads `conversations-2026-03-08.json`, adapts `raw.thai → native`, converts via `conversationWordsToWordStates()`
- Builds a `wordDetails` lookup map (wordId → native/romanization/english) for display
- Instantiates `SrsEngine` with production-like config: `batchSize=15`, `masteryThreshold curated=10 / foundational=5`, `activeWordLimit=20`
- Quiz loop: `composeBatch → display questions → readline stdin (c/w/q) → processAnswers → mastery summary`
- `formatQuestion()` renders question text per category (foundational/curated) and question type (mc/wordBlock/audio)
- `printMasterySummary()` shows phase + masteryCount + lapseCount for all words in the batch
- Exits cleanly on `q` or when no eligible words remain; closes readline in `finally` block

### `package.json` _(modified)_

- Added `"quiz": "tsx scripts/quiz-runner.ts"` to root scripts

## Behavior Preserved / New Behavior

- All data is in-memory — no files written, no network calls
- `pnpm run quiz` launches the interactive runner without errors
- First batch contains a mix of foundational and curated words
- Answering `c` (or `y`) marks correct; `w` marks wrong; `q` exits cleanly
- Mastery summary printed after each full batch showing phase transitions and carry-over
- At least one foundational word can reach mastery threshold (5 correct) within a session

## Next Steps

- EP08 complete — ready for PR
