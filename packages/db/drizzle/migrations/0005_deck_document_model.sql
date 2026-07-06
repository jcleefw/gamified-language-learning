-- Migrates decks to a document model: collapses sentences + sentence_components
-- into a single `doc` JSON column. Existing deck content is disposable (ADR
-- decision #4) — decks are re-imported from source after this migration.
-- words stays global/relational and is untouched.

DROP TABLE IF EXISTS sentence_components;
DROP TABLE IF EXISTS sentences;
DELETE FROM deck_words;
DROP TABLE IF EXISTS decks;

CREATE TABLE decks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  language TEXT NOT NULL,
  difficulty TEXT,
  register TEXT,
  created_at TEXT NOT NULL,
  doc TEXT NOT NULL,
  CHECK (json_valid(doc) AND json_type(doc) = 'object')
);
