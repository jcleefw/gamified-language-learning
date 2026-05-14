# current-focus

**Branch**: feature/EP23--srs-engine-scheduling
**Last updated**: 20260514T150000Z

## Status

EP23 DS01 + DS02 complete. 
Corpus ingestion ADR written and committed (`20260514T120000Z-engineering-sentence-corpus-ingestion.md`). OQ7 resolved: `wordId = th::native_form::type`.

Next: implement composer registry + `assembleBatchQuestions` per ADR `20260513T000000Z-engineering-batch-execution-mechanics.md` D5.



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
