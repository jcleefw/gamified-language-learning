-- EP42-DS01: standalone `audio` asset table (replaces the removed decks.audio_key
-- column; that column and its migration never reach main). One row per binary
-- asset, content-addressed `key`; versioned via `is_current` (re-upload inserts a
-- new current row and demotes the prior — history retained). Nullable `vtt` holds
-- the WebVTT timing sidecar (authored/filled by EP43). Polymorphic owner:
-- `subject_type` is 'deck' only for now ('sentence'/'word' are reserved shape,
-- not honored). The index serves the current-row lookup on read.
CREATE TABLE audio (
  id TEXT PRIMARY KEY,
  subject_type TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  key TEXT NOT NULL,
  format TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  duration_seconds INTEGER,
  vtt TEXT,
  uploaded_by TEXT,
  is_current INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);
CREATE INDEX audio_subject_current_idx ON audio (subject_type, subject_id, is_current);
