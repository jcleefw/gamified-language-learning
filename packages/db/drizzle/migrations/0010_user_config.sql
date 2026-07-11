-- Per-user config overrides (EP41-DS01, T1) as a JSON blob on the identity row.
-- A NULL config (or an absent key inside it) means "no override", resolved to
-- the server's base/preset default at the read path (DS02). The blob holds a
-- preset NAME under difficultyPreset (never a raw threshold integer); the
-- name-only invariant is enforced by the write path, not by storage.
ALTER TABLE users ADD COLUMN config TEXT;
