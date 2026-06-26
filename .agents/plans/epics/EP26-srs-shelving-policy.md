# EP26 - SRS Shelving Policy

**Created**: 20260626T002530Z
**Updated**: 20260626T
**Status**: Impl-Complete

<!-- Status: Draft | Accepted | In Progress | Impl-Complete | BDD Pending | Completed | Shelved | Withdrawn -->

**Type**: Epic Plan
**Depends on**: EP20 (srs-engine-v2 core), EP30 (persistent storage)
**Parallel with**: N/A
**Predecessor**: N/A
**Design Spec**: [DS02](../../changelogs/EP26--srs-shelving-policy/20260626T-EP26-DS02-shelving-policy-design-v2.md) (DS01 superseded)
**ADR**: [Shelving & Stagnation Policy](../../../product-documentation/architecture/20260626T000000Z-engineering-shelving-stagnation-policy.md)

---

## Problem Statement

During learning sessions (stage 1, mastery 0→5), some words stagnate — the learner gets them right sometimes but never consistently enough to climb mastery. The current engine has no mechanism to detect or handle this. Stuck words occupy active slots indefinitely, blocking new words from entering and frustrating the learner with repeated exposure to words they can't progress on.

PRD §5.9 specifies shelving: words that haven't progressed toward mastery after N batches should be temporarily removed from the active pool, freeing the learner to focus on words they can actually absorb. Shelved words return in the next session.

## Key Design Decisions

Resolved during DS02 planning. See [ADR](../../../product-documentation/architecture/20260626T000000Z-engineering-shelving-stagnation-policy.md) for full rationale.

| Decision | Choice | Rationale |
| --- | --- | --- |
| Stagnation tracking | Persistent counters (`stagnation_count` + `last_boundary_mastery`) on `user_deck_word_tracking` table | Leaner than snapshot history; same detection accuracy; BDD-seedable; survives mid-session refresh |
| Shelving scope | Per-user-per-deck | Mastery is global but stagnation context is deck-local |
| `@gll/srs-shelving` surface | Types + `evaluateShelving` + `unshelveAll` only | Detection responsibility moves to DB layer (counter logic); package stays minimal |
| Engine change | `assembleBatch` accepts `excludeIds?: Set<string>` | Minimal invasion; shelved words excluded from questions but hold active slot |

## Scope

**In scope**:

- New `@gll/srs-shelving` package — policy types and cap-enforcement function
- Stagnation detection via persistent counters in `@gll/db`
- Shelving decision: apply configurable `maxShelved` cap, return shelve/unshelve instructions
- Unshelving policy: session-scoped (shelved words return on next session start, per deck)
- Shelved words hold their active slot (not released to queue)
- `LearningStore` interface extension in `@gll/db` for stagnation tracking and shelved state persistence
- Schema migration: `user_deck_word_tracking` and `user_shelved_words` tables (deck-scoped)
- BDD scenarios for srs-demo

**Out of scope**:

- Revision-stage shelving (FSRS suspend/leech handles this natively — separate EP if needed)
- Time-based unshelving (1-day clock) — session-scoped unshelving preserves engine purity
- UI/UX for shelving (host/app concern beyond wiring)
- Changes to srs-engine-v2 core beyond accepting an `excludeIds` filter
- Mastery trajectory analysis / analytics (counters don't store trajectory; accepted trade-off)

---

## Stories

### Phase 1: Policy Package (EP26-PH01)

### EP26-ST01: Package scaffold + policy types + cap enforcement

**Scope**: Create `packages/srs-shelving` with policy types (`ShelvingConfig`, `DEFAULT_SHELVING_CONFIG`, `ShelvedWord`, `ShelvingDecision`), `evaluateShelving` (cap enforcement), and `unshelveAll`.

**Note**: DS01 included stagnation detection functions (`recordMasterySnapshot`, `detectStagnantWords`) and types (`MasterySnapshot`, `MasteryHistory`) in this package. DS02 removes them — detection is now the DB layer's responsibility via counters.

---

### Phase 2: Engine Integration (EP26-PH02)

### EP26-ST02: `excludeIds` filter in srs-engine-v2

**Scope**: Minimal engine change — `assembleBatch` accepts optional `excludeIds: Set<string>` to skip shelved words during batch composition while preserving their active slot.

---

### Phase 3: Persistence (EP26-PH03)

### EP26-ST03: Stagnation tracking schema + LearningStore extension

**Scope**: New `user_deck_word_tracking` table with `stagnation_count` and `last_boundary_mastery` columns. `LearningStore` methods: `updateStagnationCounters`, `getStagnantWords`, `resetStagnationCounters`. Migration SQL.

### EP26-ST04: Shelving persistence (deck-scoped)

**Scope**: `user_shelved_words` table with `deck_id` column. Deck-scoped `getShelvedWords`, `shelveWord`, `unshelveWord`, `unshelveAllWords`. Update `clearUserState`.

---

### Phase 4: Host Integration (EP26-PH04)

### EP26-ST05: Host integration wiring

**Scope**: Wire shelving pipeline into session flow (srs-demo + CLI demo). Initialize shelved set on resume, unshelve + reset counters on new session, run stagnation→shelving pipeline after each `advanceAdaptiveSession`, pass `excludeIds` to `assembleBatch`. Add shelving API routes to Hono server.

### EP26-ST06: BDD scenarios for srs-demo

**Scope**: Playwright + Cucumber feature files. Scenarios: word shelved after N stagnant batches, shelved word holds slot, new session unshelves, maxShelved cap enforced. BDD seeding via test API endpoints.

---

## Overall Acceptance Criteria

- [ ] Stagnant words detected via persistent counters and shelved within a session
- [ ] Shelving respects `maxShelved` cap per deck — excess stagnant words remain active
- [ ] Shelved words hold their active slot (queue does not fill freed slots)
- [ ] Shelved words are excluded from batch composition
- [ ] Shelved words unshelve on new session start (per deck)
- [ ] Shelving is deck-scoped — no cross-deck leakage
- [ ] Stagnation state survives mid-session refresh
- [ ] Shelving state persists across app restarts
- [ ] srs-engine-v2 remains pure — no shelving logic in the engine package
- [ ] BDD scenarios pass for all shelving acceptance criteria
- [ ] `pnpm typecheck` clean across monorepo; all tests green

---

## Dependencies

- EP20 (srs-engine-v2 core — `RunState`, `assembleBatch`, `nextActivePool`)
- EP30 (persistent storage — `@gll/db`, `LearningStore`)

## Related

- [ADR: Shelving & Stagnation Policy](../../../product-documentation/architecture/20260626T000000Z-engineering-shelving-stagnation-policy.md)
- [ADR: Database Schema](../../../product-documentation/architecture/20260620T000000Z-engineering-database-schema.md) — updated with new tables
- [ADR: Mastery Is Global](../../../product-documentation/architecture/20260512T220218Z-engineering-mastery-is-global-not-per-deck.md) — mastery stays global; stagnation tracking is the deck-scoped exception
- DS01 (superseded): `changelogs/EP26--srs-shelving-policy/20260626T004213Z-EP26-DS01-shelving-policy-design.md`
- DS02 (current): `changelogs/EP26--srs-shelving-policy/20260626T-EP26-DS02-shelving-policy-design-v2.md`
