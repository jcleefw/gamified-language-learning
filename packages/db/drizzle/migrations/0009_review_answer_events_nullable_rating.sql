-- Make review_answer_events.rating nullable: an eager (not-due) review answer
-- produces no FSRS rating (ADR §3), so NULL becomes the durable marker of a
-- read-only answer. SQLite can't DROP NOT NULL in place → rebuild the table
-- (new in 0008, minimal data).
ALTER TABLE review_answer_events RENAME TO review_answer_events_old;
CREATE TABLE review_answer_events (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  correlation_id TEXT,
  user_id        TEXT    NOT NULL,
  word_id        TEXT    NOT NULL,
  correct        INTEGER NOT NULL,
  latency_ms     INTEGER NOT NULL,
  question_type  TEXT    NOT NULL,
  rating         TEXT,
  created_at     TEXT    NOT NULL
);
INSERT INTO review_answer_events
  SELECT id, correlation_id, user_id, word_id, correct, latency_ms, question_type, rating, created_at
  FROM review_answer_events_old;
DROP TABLE review_answer_events_old;
