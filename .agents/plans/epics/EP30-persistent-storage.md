# EP30 — Persistent Storage Layer

**Created**: 2026-06-20
**Status**: Draft

<!-- Status: Draft | Accepted | In Progress | Impl-Complete | BDD Pending | Completed | Shelved | Withdrawn -->

**Type**: Epic Plan
**Depends on**: EP25 (ST01–ST12 complete)
**Parallel with**: N/A
**Predecessor**: N/A

---

## Problem Statement

The srs-engine-v2 is currently stateless between sessions. Learning history (`RunState`, `SentenceRunState`) is lost when the process exits. The demo CLI has a hand-rolled JSON shim that doesn't persist sentence state at all. EP30 establishes persistent storage for learner state and defines the complete DB schema for future domains (content, SRS scheduling).

EP21 (Review Phase / FSRS) is blocked on this: scheduling decisions require historical data.

---

## Scope

**In scope**:

- Drizzle ORM schema for all 11 tables (users, content, learner state, SRS scheduling)
- Migration infrastructure in `@gll/db` package
- `LearningStore` interface + `SqliteLearningStore` implementation
- Persist `user_word_states` and `user_sentence_states` with write-on-answer semantics
- DB management utilities (clear, reset, seed fixtures for testing)
- `SentenceRunState` returned from `runAdaptiveLoop` (currently local-only)
- Graduation hook for EP21 to attach FSRS logic

**Out of scope**:

- Content tables (decks, sentences, words) — import tooling is a separate epic
- `review_cards` table — EP21
- Remote D1 persistence — EP21 or later
- Hono API wiring — separate epic

---

## Stories

### EP30-ST01: Return `SentenceRunState` from `runAdaptiveLoop`

**Scope**: Pure engine change — expose `SentenceRunState` that is currently a local variable discarded at function exit.

### EP30-ST02: Drizzle Schema Definition

**Scope**: Define all 11 database tables in TypeScript using Drizzle ORM. Lives in `@gll/db` package (DB setup is application-layer concern, not library-layer).

### EP30-ST02b: Migration Infrastructure + Init DB Helper

**Scope**: Set up Drizzle migrations and `initDb` helper in `@gll/db` that applies pending migrations idempotently.

### EP30-ST03: Serialisation Helpers for `Map` and `Set`

**Scope**: Pure serialisation/deserialisation for `RunState`, `SentenceRunState`, `Set<string>`. Lives in srs-engine-v2 (engine concern, not DB concern).

### EP30-ST04: `LearningStore` Interface Implementation

**Scope**: Define `LearningStore` interface + `SqliteLearningStore` implementation using Drizzle ORM. Test with integration tests using temp DB.

### EP30-ST05: New `learning-runner-db.ts` and DB Management Scripts

**Scope**: Create second CLI runner that uses real DB. Add utilities (clear, reset, seed) for test isolation. Keep original `learning-runner.ts` unchanged with `ENABLE_MOCK_DB` for pure unit testing.

### EP30-ST06: `LearningStore` + Write-on-Answer Callbacks

**Scope**: Add `onWordAnswer` / `onSentenceAnswer` callbacks to `runAdaptiveLoop`. Wire them in `learning-runner-db.ts` to call `store.upsertWordState` / `store.upsertSentenceState` after each answer.

### EP30-ST07: Graduation Hook Stub

**Scope**: Add `onGraduation` callback to `runAdaptiveLoop` that identifies newly mastered words each session. Seam for EP21 to attach FSRS logic.

---

## Overall Acceptance Criteria

- [ ] `pnpm engine:real-db` persists and restores `RunState` + `SentenceRunState` between sessions
- [ ] Mid-session quit does not lose answered progress (write-on-answer)
- [ ] DB and migrations owned by `@gll/db`; engine is DB-agnostic
- [ ] `LearningStore`, `SqliteLearningStore`, `GraduationHook` exported from `@gll/srs-engine-v2`
- [ ] Schema is D1-compatible (no `AUTOINCREMENT`, standard SQL only)
- [ ] All existing tests pass

---

## Dependencies

- EP25 complete — `SentenceRunState`, sentence scheduling logic must be ready

## References

- [Design Spec (DS01)](../../.agents/changelogs/EP30--persistent-storage/20260620T000000Z-EP30-DS01-persistent-storage-layer.md) — detailed technical design and task lists
- [Schema ADR](../../product-documentation/architecture/20260620T000000Z-engineering-database-schema.md) — canonical DDL
