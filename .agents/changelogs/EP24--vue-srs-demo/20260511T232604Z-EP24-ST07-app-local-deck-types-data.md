# EP24-ST07: App-Local Deck Types and Data

**Date**: 20260511T232604Z
**Epic**: EP24 — Vue SRS Demo App
**Story**: EP24-ST07
**Status**: Completed

## What changed

**Files created**:
- `apps/srs-demo/src/data/types.ts` — `AppWord`, `AppLine`, `AppDeck` interfaces
- `apps/srs-demo/src/data/decks.ts` — `eatDeck`, `weatherDeck`, exported as `appDecks: AppDeck[]`

## Implementation

`AppWord` is structurally identical to the engine's `MockWord` — same fields (`id`, `native`, `romanization`, `english`, `type`, `language: 'th'`). This allows a safe `as QuizItem[]` cast at the call site without any data transformation.

`AppDeck` replaces `MockDeck`: drops `wordIds` (redundant now that the transformer derives unique words from lines directly) and uses `AppLine` / `AppWord` instead of engine types.

Content source: `eatLines` and `weatherLines` from `packages/srs-engine-v2/data/mock/mock-decks.ts`, copied verbatim into `src/data/decks.ts`. No imports from the engine package in `src/data/`.
