# ADR: Database Schema — Full System

**Date**: 2026-06-20

**Status**: Accepted

<!-- Status: Accepted | Superseded | Deprecated -->

**Superseded by**: N/A
**Epic**: Pre-EP30 (prerequisite)
**RFC**: N/A

---

## Context

The system requires a persistent data layer covering all domains: content (decks, sentences, words), learner state (word mastery, sentence history), and SRS scheduling (review cards). Prior ADRs have settled the storage technology and some table shapes in isolation:

- [Cloudflare platform ADR](20260301T161844Z-infra-cloudflare-platform.md) — D1 (SQLite dialect) locally and remotely; hybrid relational + JSON approach
- [Review phase ADR](20260321T145300Z-engineering-srs-engine-v2-review-phase.md) — `review_cards` table shape; write-on-answer semantics; SQLite locally / D1 remotely

This ADR defines the **complete schema** for all domains in a single authoritative document. It is technology-neutral within the SQLite/D1 constraint — no `AUTOINCREMENT`, no `PRAGMA foreign_keys`, no SQLite-only syntax that does not exist in D1.

EP30 (persistent storage implementation) and EP21 (FSRS review phase) both depend on this ADR being resolved before implementation begins.

---

## Decision

### Data Domains

| Domain | Tables | Notes |
|---|---|---|
| Content — vocabulary | `words`, `foundational_words` | Global entities |
| Content — curriculum | `decks`, `deck_words`, `sentences`, `sentence_components` | Deck-scoped |
| Learner state | `user_word_states`, `user_sentence_states` | Per-user, per-word/sentence |
| SRS scheduling | `review_cards` | Per-user, per-word |
| Shelving & stagnation | `user_deck_word_tracking`, `user_shelved_words` | Per-user, per-deck, per-word. See [shelving ADR](20260626T000000Z-engineering-shelving-stagnation-policy.md) |
| User management | `users` | Defined here for FK reference; auth detail in app layer |

---

### 1. User Management

```sql
CREATE TABLE IF NOT EXISTS users (
  id         TEXT PRIMARY KEY,           -- UUID
  email      TEXT NOT NULL UNIQUE,
  role       TEXT NOT NULL DEFAULT 'learner', -- 'admin' | 'curator' | 'learner'
  created_at TEXT NOT NULL               -- ISO 8601
);
```

The CLI demo hardcodes `user_id = 'cli-user'` — a sentinel row is seeded at startup. No auth logic is introduced in EP30.

---

### 2. Content — Vocabulary

#### `words`

Words are **global entities**: a word exists once regardless of how many decks reference it. Two decks teaching `กิน` share a single row.

```sql
CREATE TABLE IF NOT EXISTS words (
  id       TEXT PRIMARY KEY,             -- UUID, generated on first insert
  language TEXT NOT NULL,               -- BCP 47 code: 'th', 'ja', etc.
  text     TEXT NOT NULL,               -- Native script: 'กิน'
  senses   TEXT NOT NULL DEFAULT '[]',  -- JSON array of English sense strings
  UNIQUE (language, text)
);
```

**Word deduplication on deck import**: the `(language, text)` UNIQUE constraint is the dedup key. The importer does `INSERT OR IGNORE` on `(language, text)`, then reads back the UUID for FK use. If the same word appears in a second deck with a new English definition, the importer appends the sense to the `senses` array (if not already present).

**Word senses**: `senses` stores all meanings accumulated across deck imports (e.g. `["to eat"]`, `["truly; immediately (particle)", "so; therefore (conjunction)"]`). Learner mastery tracks against the word UUID — not per-sense. Senses are display/reference data only.

**Forward path**: a future `word_senses` table can promote senses to first-class rows and add `sense_id` FK on `user_word_states` without dropping or modifying `words`. This ADR intentionally leaves that path open.

#### `foundational_words`

Foundational words are a fixed, language-specific vocabulary that never grows. They are kept separate from `words` — they are not deck-derived and are not subject to the same import flow.

```sql
CREATE TABLE IF NOT EXISTS foundational_words (
  id           TEXT PRIMARY KEY,         -- UUID or fixed slug
  language     TEXT NOT NULL,
  text         TEXT NOT NULL,
  romanization TEXT,
  english      TEXT,
  UNIQUE (language, text)
);
```

---

### 3. Content — Curriculum

#### `decks`

A deck corresponds to one uploaded source file (e.g. a conversations JSON). Each upload is a distinct deck — no deduplication. `name` is a human-readable label.

```sql
CREATE TABLE IF NOT EXISTS decks (
  id         TEXT PRIMARY KEY,           -- UUID
  name       TEXT NOT NULL,
  language   TEXT NOT NULL,
  difficulty TEXT,                       -- 'beginner' | 'intermediate' | 'advanced'
  register   TEXT,                       -- 'formal' | 'informal'
  created_at TEXT NOT NULL               -- ISO 8601
);
```

#### `sentences`

Sentences are **owned by a deck** — they are not global. A sentence belongs to exactly one deck. The full native-script text is the dedup key within a deck.

```sql
CREATE TABLE IF NOT EXISTS sentences (
  id         TEXT PRIMARY KEY,           -- UUID
  deck_id    TEXT NOT NULL,
  language   TEXT NOT NULL,             -- redundant with deck but avoids a join for queries
  text       TEXT NOT NULL,             -- Full native-script sentence
  english    TEXT,
  romanization TEXT,
  speaker    TEXT,                      -- 'A' | 'B' | null for non-dialogue
  position   INTEGER NOT NULL,          -- Ordering within the deck
  UNIQUE (deck_id, text)
);
```

#### `sentence_components`

Each sentence breaks down into word tokens. This table captures the breakdown from the source file — one row per word-in-sentence occurrence (same word can appear multiple times).

```sql
CREATE TABLE IF NOT EXISTS sentence_components (
  id           TEXT PRIMARY KEY,         -- UUID
  sentence_id  TEXT NOT NULL,
  word_id      TEXT NOT NULL,            -- FK → words.id
  position     INTEGER NOT NULL,         -- Ordering within the sentence
  romanization TEXT,
  english      TEXT                      -- Sense as used in this sentence context
);
```

#### `deck_words`

Derived view of which words belong to a deck, via sentence components. This table is materialised for query efficiency — it is owned by the import process and never manually maintained.

```sql
CREATE TABLE IF NOT EXISTS deck_words (
  deck_id  TEXT NOT NULL,
  word_id  TEXT NOT NULL,
  PRIMARY KEY (deck_id, word_id)
);
```

> **No drift risk**: `deck_words` is rebuilt from `sentence_components` on import. A word cannot appear in `deck_words` without belonging to a sentence in the deck.

---

### 4. Learner State

All learner state tables carry `user_id`. The CLI hardcodes `'cli-user'`; no migration is needed when Hono/auth arrives — the schema is already multi-user.

#### `user_word_states`

One row per `(user_id, word_id)`. Fields map 1:1 to `WordState` in `srs-engine-v2`.

```sql
CREATE TABLE IF NOT EXISTS user_word_states (
  user_id        TEXT NOT NULL,
  word_id        TEXT NOT NULL,
  seen           INTEGER NOT NULL DEFAULT 0,
  correct        INTEGER NOT NULL DEFAULT 0,
  mastery        INTEGER NOT NULL DEFAULT 0,
  correct_streak INTEGER NOT NULL DEFAULT 0,
  wrong_streak   INTEGER NOT NULL DEFAULT 0,
  lapses         INTEGER NOT NULL DEFAULT 0,  -- mastery decrements; used by FSRS seeding (EP21)
  PRIMARY KEY (user_id, word_id)
);
```

**Write-on-answer**: updated after every answered question, not at session end. If the user quits mid-session, all answered words are already persisted.

**Session resume via reconstruction**: on next session start, `active[]` and `queue[]` are reconstructed from `user_word_states` — unmastered words re-enter the active window; mastered words do not. No explicit session snapshot table is needed.

#### `user_sentence_states`

One row per `(user_id, sentence_id)`. Fields map 1:1 to `SentenceState` in `srs-engine-v2`.

```sql
CREATE TABLE IF NOT EXISTS user_sentence_states (
  user_id              TEXT NOT NULL,
  sentence_id          TEXT NOT NULL,
  sentence_streak      INTEGER NOT NULL DEFAULT 0,
  last_batch_seen      INTEGER NOT NULL DEFAULT -1, -- -1 sentinel = never seen
  daily_count          INTEGER NOT NULL DEFAULT 0,
  session_wrong_streak INTEGER NOT NULL DEFAULT 0,
  active               INTEGER NOT NULL DEFAULT 1,  -- 0 | 1 (SQLite has no BOOLEAN)
  PRIMARY KEY (user_id, sentence_id)
);
```

**Write-on-answer**: same semantics as `user_word_states`.

---

### 5. SRS Scheduling

#### `review_cards`

Defined in [Review Phase ADR §9](20260321T145300Z-engineering-srs-engine-v2-review-phase.md). Reproduced here for completeness.

```sql
CREATE TABLE IF NOT EXISTS review_cards (
  user_id        TEXT NOT NULL,
  word_id        TEXT NOT NULL,
  due            TEXT NOT NULL,           -- ISO 8601 date string
  scheduler_data TEXT NOT NULL,           -- JSON blob, opaque to persistence layer
  PRIMARY KEY (user_id, word_id)
);
```

`scheduler_data` is the full `ts-fsrs` `Card` object serialised as JSON. The persistence layer never inspects or mutates it — the scheduler owns this field entirely. A future scheduler swap changes only `scheduler_data` contents, not the schema.

---

### 6. Shelving & Stagnation

Added by [shelving ADR](20260626T000000Z-engineering-shelving-stagnation-policy.md) (EP26).

#### `user_deck_word_tracking`

Deck-scoped stagnation counters. Updated at each batch boundary — `stagnation_count` increments when mastery is unchanged, resets to 0 when mastery changes. Reset on session start.

```sql
CREATE TABLE IF NOT EXISTS user_deck_word_tracking (
  user_id               TEXT NOT NULL,
  deck_id               TEXT NOT NULL,
  word_id               TEXT NOT NULL,
  stagnation_count      INTEGER NOT NULL DEFAULT 0,
  last_boundary_mastery INTEGER,
  PRIMARY KEY (user_id, deck_id, word_id)
);
```

#### `user_shelved_words`

Deck-scoped shelving state. A word shelved in one deck does not affect other decks. Cleared on session start (`unshelveAllWords`).

```sql
CREATE TABLE IF NOT EXISTS user_shelved_words (
  user_id          TEXT NOT NULL,
  deck_id          TEXT NOT NULL,
  word_id          TEXT NOT NULL,
  shelved_at_batch INTEGER NOT NULL,
  PRIMARY KEY (user_id, deck_id, word_id)
);
```

---

### 7. ID Strategy

| Entity | PK | Human-readable field | Dedup constraint |
|---|---|---|---|
| `users` | UUID | `email` | `UNIQUE (email)` |
| `decks` | UUID | `name` | none — each upload is distinct |
| `words` | UUID | `text` (native script) | `UNIQUE (language, text)` |
| `foundational_words` | UUID or fixed slug | `text` | `UNIQUE (language, text)` |
| `sentences` | UUID | `text` | `UNIQUE (deck_id, text)` |
| `sentence_components` | UUID | — | — |
| `deck_words` | composite `(deck_id, word_id)` | — | — |
| `user_deck_word_tracking` | composite `(user_id, deck_id, word_id)` | — | — |
| `user_shelved_words` | composite `(user_id, deck_id, word_id)` | — | — |

No `AUTOINCREMENT`. No integer sequences. UUIDs are generated by the importer / application layer, not by the database.

---

### 8. Write-on-answer Semantics and Scale

**Current behaviour (Gate 1 — solo CLI)**: `user_word_states` and `user_sentence_states` are upserted after every answered question. D1 is a single-writer SQLite database; at solo usage this is no concern.

**Gate 2 (≤ 200 users)**: write-on-answer remains correct and performant. D1's write throughput is sufficient.

**At scale (1000+ concurrent users)**: D1 approaches its single-writer limits at ~100 writes/sec sustained. **Mitigation**: the Hono API layer can batch `user_word_states` writes at batch-end rather than per-answer, without changing the engine interface. The interface is designed for write-on-answer; the transport layer decides when to flush.

Do not over-engineer before Gate 1. Note this in implementation when Hono wiring is designed.

---

### 9. Recheck Mechanic — Not a DB Concept

The `recheckPending` and `recheckReentered` sets in `AdaptiveSessionState` are purely within-batch in-memory mechanics. They reset every batch by design. No DB column or table is needed for recheck state.

---

## Consequences

**Positive**:

- Multi-user from day one — no migration when auth arrives
- Words are global — a word learned in one deck is credited across all decks; `(language, text)` UNIQUE prevents duplicates
- `deck_words` derived from `sentence_components` — no drift between word list and sentence vocabulary
- Write-on-answer — partial sessions are always safe; no snapshot table needed
- `review_cards.scheduler_data` opaque JSON — scheduler can be swapped with no schema change
- D1-compatible SQL throughout — local SQLite and remote D1 share identical schema

**Negative / Risks**:

- Word senses are a JSON array, not indexed — queries filtering by sense require `json_each`. Acceptable for Gate 1 counts; revisit if sense-filtering becomes a product requirement
- `deck_words` is materialised, not a view — must be kept in sync by the importer; a bug in the import flow could cause drift (mitigated by rebuilding from `sentence_components` on re-import)
- Session resume via reconstruction assumes unmastered = not yet mastered globally. A word mastered in Deck A is not re-served in Deck B — by design (mastery is global per [mastery ADR](20260512T220218Z-engineering-mastery-is-global-not-per-deck.md)), but the product consequence should be understood

**Neutral**:

- `foundational_words` schema is defined but its import flow is out of scope for EP30
- `users` table is defined here; auth detail (OAuth, sessions, RBAC) remains in the app layer
- `review_cards` schema previously defined in the Review Phase ADR — this ADR is now the canonical reference

---

## Alternatives Considered

| Option | Why Not Chosen |
|---|---|
| Words per-deck (no global `words` table) | Breaks mastery-is-global invariant; same word relearned from scratch in each deck |
| Sense-level mastery from day one (`word_senses` table) | Requires import tooling that doesn't exist; over-engineers before Gate 1 |
| Session snapshot table (`user_sessions`) | Adds complexity with no benefit — reconstruction from `user_word_states` is sufficient and more robust |
| Recheck sets in DB | Recheck is within-batch mechanics only; persisting it adds a column that is reset every batch |
| Integer PKs with `AUTOINCREMENT` | Not supported in D1; UUIDs are portable across environments |
| Separate `words` table per language | Unnecessary; `language` column + UNIQUE constraint achieves the same isolation |

---

## Open Questions

| # | Question | Owner | Target |
|---|---|---|---|
| OQ1 | Sense-level mastery (`word_senses` table, `sense_id` FK on `user_word_states`) — when does this become a product requirement? | Product | Post Gate 2 review |
| OQ2 | `foundational_words` import flow — who authors them, what is the source of truth? | Product | Before EP21 |
| OQ3 | `deck_words` — rebuild on every re-import, or diff-and-patch? | Engineering | EP30 import story |
| OQ4 | `sentences.language` redundant column — keep for query ergonomics or remove and always join to `decks`? | Engineering | EP30 |

---

_Related ADRs:_

- [20260301T161844Z-infra-cloudflare-platform.md](20260301T161844Z-infra-cloudflare-platform.md) — D1 decision and hybrid relational + JSON approach
- [20260321T145300Z-engineering-srs-engine-v2-review-phase.md](20260321T145300Z-engineering-srs-engine-v2-review-phase.md) — `review_cards` origin; write-on-answer; FSRS interface
- [20260512T220218Z-engineering-mastery-is-global-not-per-deck.md](20260512T220218Z-engineering-mastery-is-global-not-per-deck.md) — mastery-is-global invariant
- [20260319T000000Z-engineering-srs-engine-v2-learning-phase.md](20260319T000000Z-engineering-srs-engine-v2-learning-phase.md) — Learning phase engine
- [20260626T000000Z-engineering-shelving-stagnation-policy.md](20260626T000000Z-engineering-shelving-stagnation-policy.md) — Shelving & stagnation policy; rationale for deck-scoped counters over snapshot history
