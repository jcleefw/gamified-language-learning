-- Rebuilds user_shelved_words to add deck_id to the primary key.
-- Existing rows (if any) are preserved with deck_id = 'legacy'.

CREATE TABLE IF NOT EXISTS user_shelved_words_new (
  user_id         TEXT NOT NULL,
  deck_id         TEXT NOT NULL,
  word_id         TEXT NOT NULL,
  shelved_at_batch INTEGER NOT NULL,
  PRIMARY KEY (user_id, deck_id, word_id)
);

INSERT OR IGNORE INTO user_shelved_words_new (user_id, deck_id, word_id, shelved_at_batch)
SELECT user_id, 'legacy', word_id, shelved_at_batch FROM user_shelved_words
WHERE NOT EXISTS (
  SELECT 1 FROM pragma_table_info('user_shelved_words') WHERE name = 'deck_id'
);

DROP TABLE user_shelved_words;

ALTER TABLE user_shelved_words_new RENAME TO user_shelved_words;
