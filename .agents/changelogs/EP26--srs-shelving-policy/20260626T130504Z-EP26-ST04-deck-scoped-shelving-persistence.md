# EP26-ST04: Deck-Scoped Shelving Persistence

**Created**: 20260626T130504Z
**Epic**: [EP26 - SRS Shelving Policy](../../plans/epics/EP26-srs-shelving-policy.md)
**Status**: Complete ✅

## Summary

DS01 `user_shelved_words` table lacked `deck_id` — shelving was user-scoped only. All four shelving methods updated to accept `deckId: string`. Migration SQL updated to include `deck_id` in PK. Deck isolation verified via tests.

## Files Modified

### `packages/db/src/schema.ts`
- Added `deck_id: text` column to `user_shelved_words`
- Updated PK from `(user_id, word_id)` → `(user_id, deck_id, word_id)`

### `packages/db/drizzle/migrations/0002_shelved_words.sql`
- Updated `user_shelved_words` DDL to include `deck_id` in both column list and PRIMARY KEY

### `packages/db/src/learning-store.ts`
- `getShelvedWords(userId, deckId)` — added `deckId`
- `shelveWord(userId, deckId, wordId, batchNum)` — added `deckId`
- `unshelveWord(userId, deckId, wordId)` — added `deckId`
- `unshelveAllWords(userId, deckId)` — added `deckId`

### `packages/db/src/sqlite-learning-store.ts`
- All shelving queries now filter by `(user_id, deck_id)` compound predicate
- `shelveWord` upsert target updated to 3-column PK

### `packages/db/src/__tests__/sqlite-learning-store.test.ts`
- Rewrote `shelving` describe block → `shelving (deck-scoped)` with `deckId` threaded through all calls
- Added: `unshelveAllWords does not affect other decks for same user`

## Behavior Preserved / New Behavior

- Shelving a word already shelved is idempotent (upsert)
- `unshelveAllWords` clears only the target deck — other decks unaffected
- `clearUserState` clears both `user_shelved_words` and `user_deck_word_tracking`
- 20 DB tests pass

## Next Steps

- EP26-ST05: Host wiring (CLI + srs-demo + server)
