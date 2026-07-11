CREATE TABLE IF NOT EXISTS review_answer_events (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  correlation_id TEXT,
  user_id        TEXT NOT NULL,
  word_id        TEXT NOT NULL,
  correct        INTEGER NOT NULL,
  latency_ms     INTEGER NOT NULL,
  question_type  TEXT NOT NULL,
  rating         TEXT NOT NULL,
  created_at     TEXT NOT NULL
);
