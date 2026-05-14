# current-focus

**Branch**: feature/EP23--srs-engine-scheduling
**Last updated**: 20260514T150000Z

## Status

EP23 DS01 complete. DS02 ST03 + ST04 complete. ST05/ST06/ST07 pending.
Corpus ingestion ADR written and committed (`20260514T120000Z-engineering-sentence-corpus-ingestion.md`). OQ7 resolved: `wordId = th::native_form::type`.

Next: implement composer registry + `assembleBatchQuestions` per ADR `20260513T000000Z-engineering-batch-execution-mechanics.md` D5.

## Completed Epics
- EP20-ST13 support for other foundational words (vowels, etc)
- EP21 srs-engine-v2 library boundary + revision phase
- EP22 auto-script SRS quiz runner
- EP24 Vue SRS demo app (stories complete, queue filter bug fixed)

## EP23 DS01 — Complete ✅

ST01: `composeBatch` → `composeWordBatch` rename + `composeWordBatchItems` alias
ST02: `QuizQuestion` → `MCQQuestion` + `QuizQuestion` union type introduced
File rename: `compose-batch.ts` → `compose-word-batch.ts` (all import paths updated)

## EP23 DS02 — In Progress

### Complete ✅
- ST03: `SentenceContext` type + `LANGUAGE_CONFIG` + mock corpus fixture
- ST04: `composeSentenceBatch` `en→na` direction + runner wiring (`resolveEligibleContexts`, `runBatch`, `runInteractive`, `runAutoInteractive`)

### Pending
- ST05: add `romanization-to-native` direction
- ST06: add `native-to-romanization` direction
- ST07: integration test + typecheck gate

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
