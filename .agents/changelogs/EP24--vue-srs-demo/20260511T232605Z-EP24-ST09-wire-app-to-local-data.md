# EP24-ST09: Wire App to Local Data

**Date**: 20260511T232605Z
**Epic**: EP24 — Vue SRS Demo App
**Story**: EP24-ST09
**Status**: Completed

## What changed

**Files modified**:
- `apps/srs-demo/src/App.vue`
- `apps/srs-demo/src/components/DeckSelector.vue`

## Changes

### App.vue
- Removed: `import type { MockWord }`, `import { mockDecks }`, `import { mockWords }`, `import { wordPool }` from `@gll/srs-engine-v2/data/mock/*`
- Added: `import { appDecks }` and `import { deckToQuizItems, buildWordPool }` from local `src/data/`
- `wordPool` now built at module level: `buildWordPool(appDecks) as QuizItem[]`
- `getDeckWords` now calls `deckToQuizItems(deck) as QuizItem[]` instead of filtering `mockWords` by `wordIds`

### DeckSelector.vue
- Replaced `import { mockDecks } from '@gll/srs-engine-v2/data/mock/mock-decks'` with `import { appDecks }` and `import { deckToQuizItems }` from local `src/data/`
- Template iterates `appDecks` instead of `mockDecks`
- Word count uses `deckToQuizItems(deck).length` (replaces `deck.wordIds.length` — `AppDeck` has no `wordIds`)

## Result
No imports from `@gll/srs-engine-v2/data/mock/*` remain in `src/`. `vue-tsc --noEmit` passes with zero errors.
