# ADR: Shelving & Stagnation Policy — Deck-Scoped Counters

**Status:** Accepted

**Date:** 2026-06-26

**Deciders:** JC Lee

**Epic:** EP26 — SRS Shelving Policy

---

## Context

During learning sessions (stage 1, mastery 0→5), some words stagnate — the learner gets them right sometimes but never consistently enough to climb mastery. The engine has no mechanism to detect or handle this. Stuck words occupy active slots indefinitely, blocking new words and frustrating the learner with repeated exposure to words they cannot progress on.

PRD §5.9 specifies shelving: words that haven't progressed toward mastery after N batches should be temporarily removed from the active pool, freeing the learner to focus on words they can actually absorb. Shelved words return in the next session.

Two scoping questions needed resolution:

1. **How to track stagnation** — full mastery snapshot history (per-batch-boundary snapshots stored in a separate table) vs. summary counters (stagnation count + last boundary mastery, updated in place)
2. **At what scope** — per-user globally, or per-user-per-deck

---

## Decision

### Stagnation tracking: persistent counters (not snapshot history)

Stagnation is tracked via two columns on a new `user_deck_word_tracking` table: `stagnation_count` (incremented at each batch boundary when mastery is unchanged; reset to 0 when mastery changes) and `last_boundary_mastery` (the mastery value at the previous batch boundary).

Detection is a simple query: `SELECT word_id WHERE stagnation_count >= :threshold`.

### Shelving scope: per-user-per-deck

Mastery remains global per [mastery-is-global ADR](20260512T220218Z-engineering-mastery-is-global-not-per-deck.md) — a word mastered in any deck is mastered everywhere. But stagnation context is deck-local: a learner stuck on "กิน" in a food deck may not be stuck on it in a greetings deck where it appears in different sentences. Shelving in deck A must not affect deck B.

Both `user_deck_word_tracking` and `user_shelved_words` are keyed on `(user_id, deck_id, word_id)`.

### Shelving package scope: policy types + cap enforcement only

`@gll/srs-shelving` contains `ShelvingConfig`, `DEFAULT_SHELVING_CONFIG`, `ShelvedWord`, `ShelvingDecision` types, plus `evaluateShelving` (cap enforcement) and `unshelveAll`. It does not contain stagnation detection logic — that is the DB layer's responsibility (counter comparison on write).

### Engine change: `excludeIds` filter

`assembleBatch` accepts an optional `excludeIds: Set<string>`. Shelved words are filtered from question generation but remain in the `active` array (slot held). No other engine changes.

---

## Rationale

### Why counters over snapshot history

| Dimension | Snapshots | Counters (chosen) |
|---|---|---|
| Storage | N rows per word per session, cleared on session start | 1 row per word per deck, updated in place |
| Detection | Pure function over in-memory map | DB query: `stagnation_count >= threshold` |
| Accuracy | Identical for detection; superior for post-hoc trajectory analysis | Identical for detection; no trajectory visibility |
| BDD seeding | Insert rows simulating a mastery trajectory | `UPDATE stagnation_count = 3` — direct |
| Mid-session refresh | Must persist snapshot table to survive | Survives by design (persisted counters) |
| Cleanup | Bulk DELETE on session start | UPDATE to reset in place — no row churn |

Both approaches achieve identical detection accuracy. The goal is to track which words the user struggles with and optimise session engagement — not to preserve mastery trajectory for analysis. Counters are leaner for the same result.

The snapshot approach kept stagnation detection as a pure function in `@gll/srs-shelving` (`detectStagnantWords` over a `MasteryHistory` map). This was architecturally clean but required either: (a) ephemeral in-memory history that was lost on refresh and could not be seeded for BDD tests, or (b) a `mastery_snapshots` table with bounded-but-accumulating rows and bulk-delete cleanup. Counters eliminate this trade-off.

### Why deck-scoped

Mastery is global (per [mastery-is-global ADR](20260512T220218Z-engineering-mastery-is-global-not-per-deck.md)): a word mastered anywhere is mastered everywhere. This is correct — mastery measures recognition ability, which is context-free.

Stagnation is different. A learner may struggle with a word in one deck's difficulty context but not another's. Shelving is a session-engagement mechanism, not a mastery judgement — it should be scoped to where the struggle is observed.

Counters cannot live on `user_word_states` (which is `(user_id, word_id)`, no deck scope). A new deck-scoped table is required regardless of the counter-vs-snapshot choice.

---

## Alternatives Considered

| Option | Pros | Cons | Why Not Chosen |
|---|---|---|---|
| In-memory `MasteryHistory` (DS01 original) | Pure-function detection in shelving package; no DB change | Lost on refresh; cannot seed BDD tests; ephemeral state creates UX gap | Requires persistence to be useful, which negates the "no DB" benefit |
| Snapshot table (`mastery_snapshots`) | Full trajectory visible; pure-function detection preserved | Row accumulation (bounded but non-zero); bulk-delete cleanup on session start; more complex queries for detection | Same detection accuracy as counters but more storage, more cleanup, more code — over-engineered for the goal |
| Counters on `user_word_states` (no new table) | No new table; minimal schema change | `user_word_states` is `(user_id, word_id)` — no deck scope; adding `deck_id` would break the global mastery model | Violates mastery-is-global invariant; conflates global mastery state with deck-local stagnation tracking |
| Per-user shelving (no deck scope) | Simpler — no `deck_id` threading | Shelving in deck A leaks to deck B; stagnation in one context penalises another | Wrong granularity — stagnation is contextual |

---

## Consequences

**Positive:**

- Stagnation state survives mid-session refresh — no data loss on page reload
- BDD test seeding is trivial: seed `stagnation_count` directly, no need to drive N batches through the UI
- `@gll/srs-shelving` package is minimal — types and cap enforcement only; no detection logic to maintain
- Deck isolation prevents cross-deck interference; consistent with mastery-is-global (mastery stays on `user_word_states`, stagnation tracking on a separate deck-scoped table)
- Counter pattern is consistent with existing learning counters on `user_word_states` (`correct_streak`, `wrong_streak`, `lapses`)

**Negative / Risks:**

- No mastery trajectory visibility — if debugging requires "what was mastery at batch 3?", counters don't answer that. Accepted: the goal is engagement optimisation, not analytics. If trajectory analysis becomes a product need, a separate analytics event log is the right solution, not the stagnation tracking table
- Two fields (`stagnation_count` + `last_boundary_mastery`) must stay in sync — a bug in update logic could cause one to drift. Mitigated by encapsulating the update in a single `updateStagnationCounters` method
- New dependency edge: `@gll/db` imports `ShelvedWord` type from `@gll/srs-shelving`. Lightweight (type-only) but creates a coupling. Accepted: the type is stable and shared

**Neutral:**

- `user_deck_word_tracking` is a new table, but its lifecycle is simple: rows are created lazily on first batch boundary, reset on session start, deleted on `clearUserState`
- The shelving cap (`maxShelved: 2`) may need tuning — with 5 active words, 2 shelved = 40% reduction in effective pool. This is a product tuning concern, not an architecture issue

---

## Schema

### New table: `user_deck_word_tracking`

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

### Modified table: `user_shelved_words`

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

## Related

- [Mastery-is-global ADR](20260512T220218Z-engineering-mastery-is-global-not-per-deck.md) — mastery stays global; stagnation tracking is the deck-scoped exception
- [Database schema ADR](20260620T000000Z-engineering-database-schema.md) — canonical schema reference; needs update for new tables
- [Adaptive session orchestrator ADR](20260516T113156Z-engineering-adaptive-session-orchestrator.md) — `advanceAdaptiveSession` is the batch-boundary hook where stagnation counters are updated
- EP26-DS02: design spec with full story breakdown and implementation details
