CREATE TABLE IF NOT EXISTS user_shelved_words (
  user_id         TEXT NOT NULL,
  deck_id         TEXT NOT NULL,
  word_id         TEXT NOT NULL,
  shelved_at_batch INTEGER NOT NULL,
  PRIMARY KEY (user_id, deck_id, word_id)
);

CREATE TABLE IF NOT EXISTS user_deck_word_tracking (
  user_id               TEXT NOT NULL,
  deck_id               TEXT NOT NULL,
  word_id               TEXT NOT NULL,
  stagnation_count      INTEGER NOT NULL DEFAULT 0,
  last_boundary_mastery INTEGER,
  PRIMARY KEY (user_id, deck_id, word_id)
);
