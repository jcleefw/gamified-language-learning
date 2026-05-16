# EP24-ST08: Transformer — `AppDeck` → `QuizItem[]`

**Date**: 20260511T232605Z
**Epic**: EP24 — Vue SRS Demo App
**Story**: EP24-ST08
**Status**: Completed

## What changed

**Files created**:
- `apps/srs-demo/src/data/transformer.ts`

## Implementation

Two pure functions:

```ts
deckToQuizItems(deck: AppDeck): AppWord[]
// Walks deck.lines[].words, deduplicates by word.id (insertion order).

buildWordPool(decks: AppDeck[]): AppWord[]
// Walks all decks, deduplicates globally by word.id (insertion order).
```

Both use a `Set<string>` seen-tracker to collapse repeated word IDs — the same word can appear in multiple lines within a deck (e.g. `th::กิน` appears in three eatLines).

Return type is `AppWord[]` rather than `QuizItem[]` to keep `src/data/` free of engine imports. Callers cast with `as QuizItem[]` at the boundary.
