---
name: ep30-schema-design-decisions
description: Schema design decisions resolved during EP30 planning discussion (2026-06-20)
metadata:
  type: project
---

## Resolved Decisions

**Multi-user from day one**: `user_id` on all learner state tables. CLI hardcodes `"cli-user"` constant. No migration needed when Hono/auth arrives.

**Words are global entities**: `words` table, single row per word regardless of how many decks it appears in. `(user_id, word_id)` PK on all learner state tables.

**Foundational words are separate**: `foundational_words` table — fixed, never grows, language-specific metadata. Not in `words` table.

**Single `words` table for all languages**: `language` text column (e.g. `'th'`, `'ja'`). No separate table per language.

**Deck owns sentences**: Sentences are not global. A sentence belongs to exactly one deck.

**Words derived from sentences**: Every word in a deck comes from its sentences. No word exists in a deck without belonging to a sentence. `deck_words` can be derived, not a separately maintained list — avoids drift.

**Write-on-answer semantics**: `user_word_states` and `user_sentence_states` updated after every answer, not batch end. If user quits mid-batch, all answered words are already persisted. Session state reconstructed from DB on resume — no need to snapshot `active[]`/`queue[]`.

**Session resume via reconstruction**: On resume, `active[]` and `queue[]` are reconstructed from `user_word_states` — unmastered words re-enter active window, mastered words don't. No explicit session snapshot table needed.

**ID strategy**: Deferred to later phase discussion (Q10).

**Schema ADR**: Standalone ADR in `product-documentation/architecture/` — not EP30-specific. Written before EP30 implementation begins.

**Write-on-answer performance**: D1 is single-writer. At Gate 1 (solo) and Gate 2 (200 users) write-on-answer is fine. At 1000+ concurrent users (~100 writes/sec) it becomes a concern. Mitigation: Hono layer can batch writes at batch-end for scale without changing the engine. Design the interface for write-on-answer; note in ADR that Hono may batch. Don't over-engineer before Gate 1.

**Recheck mechanic — needs redesign**: Current implementation uses `recheckPending` + `recheckReentered` sets with special-cased mastery suppression logic in `processRecheckResult`. This conflates two concerns: "serve word again soon" (scheduling) and "suppress mastery change on re-serve" (scoring). PRD §5.7 only says the word reappears in the same session — no mention of suppressing mastery. Implementation is messy.

**Recheck as DB concept**: Open — if recheck resets every batch it's pure in-memory (no DB column needed). If a word wronged in batch N must be rechecked before batch N+1 ends, it needs persisting. To be resolved.

**Recheck is not a DB concept**: Confirmed. Recheck is purely within-batch in-memory. No DB column or table needed. Recheck mechanic redesign is an engine concern, separate from schema.

## Open / Deferred

_(none — all decisions resolved)_

---

## Q10: ID Strategy (Resolved)

**PKs are UUIDs throughout**: `decks`, `words`, `sentences`, `foundational_words` all use UUID PKs.

**Dedup keys** (unique constraints, not PKs):
- `words`: `(language, text)` UNIQUE — same Thai string across decks resolves to the same row
- `sentences`: `(deck_id, text)` UNIQUE — sentences are deck-scoped
- `decks`: no dedup — each upload is a distinct deck; `name` is a human-readable text column

**Word sense disambiguation — Option A + forward path**:
- `words` has a `senses TEXT` column storing a JSON array (e.g. `["to eat"]`)
- On deck import, if the same `(language, text)` word appears with a different English definition, the importer appends the new sense to the array (if not already present)
- Learner mastery tracks against word UUID, not per-sense — senses are display/reference data only
- Forward path to Option B (sense-level mastery): add `word_senses` table, FK `sense_id` on `user_word_states`; nothing dropped from `words`

**Import flow for words**:
```
for each component in deck file:
  INSERT OR IGNORE INTO words (id, language, text, senses) VALUES (uuid(), 'th', thai_text, json_array(english))
  UPDATE words SET senses = json_insert(senses, ...) WHERE (language, text) = ... AND sense not already present
  resolve word UUID for FK use in deck_words / sentence_components
```
