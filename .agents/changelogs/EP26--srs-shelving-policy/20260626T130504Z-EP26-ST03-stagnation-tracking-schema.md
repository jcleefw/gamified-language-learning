# EP26-ST03: Stagnation Tracking Schema + LearningStore Extension

**Created**: 20260626T130504Z
**Epic**: [EP26 - SRS Shelving Policy](../../plans/epics/EP26-srs-shelving-policy.md)
**Status**: Complete ✅

## Summary

New `user_deck_word_tracking` table with persistent stagnation counters (`stagnation_count`, `last_boundary_mastery`). Three new `LearningStore` methods: `updateStagnationCounters`, `getStagnantWords`, `resetStagnationCounters`. Schema and migration updated alongside ST04 deck-scoping changes (consolidated in one migration file).

## Files Modified

### `packages/db/src/schema.ts`
- Added `user_deck_word_tracking` table with PK `(user_id, deck_id, word_id)`

### `packages/db/drizzle/migrations/0002_shelved_words.sql`
- Updated to include `user_deck_word_tracking` CREATE statement (alongside ST04 `deck_id` addition)

### `packages/db/src/learning-store.ts`
- Added `updateStagnationCounters(userId, deckId, activeWordIds): void`
- Added `getStagnantWords(userId, deckId, threshold): string[]`
- Added `resetStagnationCounters(userId, deckId): void`

### `packages/db/src/sqlite-learning-store.ts`
- Implemented all three stagnation methods
- `updateStagnationCounters` logic: first call creates row (count=1); unchanged mastery increments; changed mastery resets to 1 and updates baseline

### `packages/db/src/__tests__/sqlite-learning-store.test.ts`
- Added `stagnation counters` describe block with 6 tests covering: increment on unchanged mastery, reset on mastery change, threshold filtering, deck isolation, clearUserState cleanup

## Behavior Preserved / New Behavior

- Counter starts at 1 on first batch boundary (not 0), reaching threshold after N calls
- Stagnation is strictly deck-scoped — `deck-2` is unaffected by `deck-1` counters
- `clearUserState` now also deletes `user_deck_word_tracking` rows
- 20 DB tests pass

## Next Steps

- EP26-ST04: Deck-scoped shelving persistence
