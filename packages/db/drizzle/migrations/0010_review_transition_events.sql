-- Revision transition channel (EP40-ST05) — a pure per-answer card-state
-- transition log for the Revision authority path, separate from the
-- review_answer_events answer log (OQ1). A row is written ONLY on the due
-- (advance) branch; joined to the answer inputs by correlation_id. Brings
-- review replay to answer_events' before/after fidelity.
CREATE TABLE IF NOT EXISTS review_transition_events (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  correlation_id TEXT,
  user_id        TEXT NOT NULL,
  word_id        TEXT NOT NULL,
  before_card    TEXT NOT NULL,
  after_card     TEXT NOT NULL,
  created_at     TEXT NOT NULL
);
