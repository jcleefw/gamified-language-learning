# current-focus

**Branch**: feature/EP24--srs-demo-webapp
**Last updated**: 20260515T232500Z

## Status

EP23 (SRS engine scheduling) is complete in main. 
EP24 Vue SRS demo webapp is the current focus. EP25 (per-deck word state) was withdrawn as global mastery is correct.

## Completed Epics
- EP20-ST13 support for other foundational words (vowels, etc)
- EP21 srs-engine-v2 library boundary + revision phase
- EP22 auto-script SRS quiz runner
- EP23 SRS engine scheduling (Sentence Quiz)
- EP24 Vue SRS demo app (stories complete, queue filter bug fixed)

## EP24 Bug — FIXED (20260512T220218Z)

**Bug**: `nextActivePool` pulled mastered words from queue blindly — mastered words re-entered active pool on deck switch.

**Fix**: filtered mastered words from queue before slicing in `nextActivePool` (`session.ts:72`). Two new tests added. Engine rebuilt. Commit: `ce2e3d7`.

## What's next

1. **Registry runner — Next focus**: implement composer registry + `assembleBatchQuestions` per ADR `20260513T000000Z-engineering-batch-execution-mechanics.md` D5.
2. **Post-mastery scheduling** — FSRS/ANKI (already in original product docs, planned)
3. **Sentence/word-block question type** — new EP, tests contextual usage

## Registry runner — Next focus

ADR `20260513T000000Z-engineering-batch-execution-mechanics.md` D5 specifies a composer registry pattern:

- Each composer registered as a pre-bound thunk `() => QuizQuestion[]`
- `assembleBatchQuestions(registry)` runs all thunks, returns flat `QuizQuestion[]`
- Session layer registers thunks before calling `assembleBatchQuestions`
- Registry lives in `srs-engine-v2`; current `runBatch` direct calls are the demo stand-in

This replaces the current direct calls to `composeWordBatchMulti` and `composeSentenceBatch` in `runBatch`. Needs a design story (DS03) before implementation.

## Corpus ingestion ADR — Written ✅

`product-documentation/architecture/20260514T120000Z-engineering-sentence-corpus-ingestion.md`

Key decisions:
- `wordId = th::native_form::type` (e.g. `th::หิว::adjective`) — type suffix disambiguates homographs
- Words global; sentences per conversation
- One `breakdown` entry → one `SentenceContext`
- Mock data layer mirrors DB schema: `mock-words.ts`, `mock-decks.ts`, `mock-sentence-corpus.ts`, `mock-db.ts` (new)
- `mock-db.ts` exposes `getWordsForDeck`, `getWordPool`, `getSentenceContexts` — same contract as future DB query layer

Open: OQ6 (ingestion script — separate library, deferred), OQ7 resolved.

## Open product questions (captured 20260512T220218Z)

- Is "word block" the intended name for the sentence construction question type?
- Should post-mastery scheduling or sentence questions come first?
- Does `composeBatch` need to be aware of sentence-level question types, or is that a separate system outside the SRS engine?
