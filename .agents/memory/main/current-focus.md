# current-focus

**Branch**: feature/EP24--srs-demo-webapp
**Last updated**: 20260515T232300Z

## Status

EP23 (SRS engine scheduling) is complete in main. 
EP24 Vue SRS demo webapp is in progress. EP25 per-deck word state is being branched from main.

## Completed Epics
- EP20-ST13 support for other foundational words (vowels, etc)
- EP21 srs-engine-v2 library boundary + revision phase
- EP22 auto-script SRS quiz runner
- EP23 SRS engine scheduling (Sentence Quiz)
- EP24 Vue SRS demo app (in progress — most stories complete, open issues below)

## EP24 Open Bug — STOP POINT

**Bug**: `nextActivePool` pulls mastered words from queue blindly — mastered words re-enter active pool when switching decks.

**Root cause**: `queue.slice(0, freeSlots)` in `session.ts:72` has no mastery check, unlike the `active` filter on line 65.

**Decision**: Do NOT fix this in the engine yet. Option D (EP25) will rewrite `nextActivePool` to use per-deck mastery — fixing it now creates conflicting logic that EP25 will delete.

**App-side workaround (not yet applied)**: pre-filter mastered words in `initSession` before passing to `nextActivePool`. Apply this temporarily if unblocking EP24 testing is needed.

**Return here after EP25 ships** — revisit whether the bug still exists or is resolved by Option D.

## What's next

- **EP25** (branch from main): per-deck word state — `WordState.decks: Record<deckId, DeckWordState>` (Option D)
  - Breaking change to `WordState` shape
  - Rewrites `updateRunState`, `nextActivePool`, `isMastered` to be deck-aware
  - Covers cross-deck mastery re-test behaviour
  - See conversation on feature/EP24--srs-demo-webapp (2026-05-12) for full design discussion

- **EP24** (resume after EP25): return to fix remaining open bug, verify full quiz loop with new per-deck mastery

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
