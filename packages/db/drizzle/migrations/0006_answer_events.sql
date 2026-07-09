CREATE TABLE IF NOT EXISTS answer_events (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  correlation_id TEXT,
  user_id        TEXT NOT NULL,
  word_id        TEXT NOT NULL,
  correct        INTEGER NOT NULL,
  latency_ms     INTEGER NOT NULL,
  before_state   TEXT,
  after_state    TEXT NOT NULL,
  graduated      INTEGER NOT NULL,
  created_at     TEXT NOT NULL
);
