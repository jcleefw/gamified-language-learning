-- Full schema for gamified language learning
-- D1-compatible: no AUTOINCREMENT, no PRAGMA, standard SQL only
-- All tables use CREATE TABLE IF NOT EXISTS (idempotent)

-- ---------------------------------------------------------------------------
-- User management
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS users (
  id         TEXT PRIMARY KEY,
  email      TEXT NOT NULL UNIQUE,
  role       TEXT NOT NULL DEFAULT 'learner',
  created_at TEXT NOT NULL
);

-- ---------------------------------------------------------------------------
-- Content — vocabulary
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS words (
  id       TEXT PRIMARY KEY,
  language TEXT NOT NULL,
  text     TEXT NOT NULL,
  senses   TEXT NOT NULL DEFAULT '[]',
  UNIQUE (language, text)
);

CREATE TABLE IF NOT EXISTS foundational_words (
  id           TEXT PRIMARY KEY,
  language     TEXT NOT NULL,
  text         TEXT NOT NULL,
  romanization TEXT,
  english      TEXT,
  UNIQUE (language, text)
);

-- ---------------------------------------------------------------------------
-- Content — curriculum
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS decks (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  language   TEXT NOT NULL,
  difficulty TEXT,
  register   TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sentences (
  id           TEXT PRIMARY KEY,
  deck_id      TEXT NOT NULL,
  language     TEXT NOT NULL,
  text         TEXT NOT NULL,
  english      TEXT,
  romanization TEXT,
  speaker      TEXT,
  position     INTEGER NOT NULL,
  UNIQUE (deck_id, text)
);

CREATE TABLE IF NOT EXISTS sentence_components (
  id           TEXT PRIMARY KEY,
  sentence_id  TEXT NOT NULL,
  word_id      TEXT NOT NULL,
  position     INTEGER NOT NULL,
  romanization TEXT,
  english      TEXT
);

CREATE TABLE IF NOT EXISTS deck_words (
  deck_id TEXT NOT NULL,
  word_id TEXT NOT NULL,
  PRIMARY KEY (deck_id, word_id)
);

-- ---------------------------------------------------------------------------
-- Learner state
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS user_word_states (
  user_id        TEXT NOT NULL,
  word_id        TEXT NOT NULL,
  seen           INTEGER NOT NULL DEFAULT 0,
  correct        INTEGER NOT NULL DEFAULT 0,
  mastery        INTEGER NOT NULL DEFAULT 0,
  correct_streak INTEGER NOT NULL DEFAULT 0,
  wrong_streak   INTEGER NOT NULL DEFAULT 0,
  lapses         INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, word_id)
);

CREATE TABLE IF NOT EXISTS user_sentence_states (
  user_id              TEXT NOT NULL,
  sentence_id          TEXT NOT NULL,
  sentence_streak      INTEGER NOT NULL DEFAULT 0,
  last_batch_seen      INTEGER NOT NULL DEFAULT -1,
  daily_count          INTEGER NOT NULL DEFAULT 0,
  session_wrong_streak INTEGER NOT NULL DEFAULT 0,
  active               INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, sentence_id)
);

-- ---------------------------------------------------------------------------
-- SRS scheduling
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS review_cards (
  user_id        TEXT NOT NULL,
  word_id        TEXT NOT NULL,
  due            TEXT NOT NULL,
  scheduler_data TEXT NOT NULL,
  PRIMARY KEY (user_id, word_id)
);
