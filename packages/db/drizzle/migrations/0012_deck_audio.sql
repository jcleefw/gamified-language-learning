-- Deck conversation audio key (EP42-DS01, ST04). Nullable; NULL = deck has no
-- audio. Resolved to a playable URL at read time via an injected resolver
-- (packages/db/src/sqlite-content-store.ts) — this column stores only the key.
ALTER TABLE decks ADD COLUMN audio_key TEXT;
