# EP41 - Per-User Config Preference Tier (T1)

**Created**: 20260711T010304Z

**Status**: Completed

<!-- Status: Draft | Accepted | In Progress | Impl-Complete | BDD Pending | Completed | Shelved | Withdrawn -->

**Type**: Epic Plan
**Depends on**: N/A (ADRs authored; no code dependency on another open epic)
**Parallel with**: N/A
**Predecessor**: N/A

---

## Problem Statement

The [Config Ownership — Two-Tier Model ADR](../../product-documentation/architecture/20260711T004050Z-engineering-config-ownership-two-tier.md)
ratified a two-tier config model: **T1 (user preference)** and **T3 (system)**. Today the whole
config surface is effectively T3 — served read-only from `apps/server/src/config/learning.ts`, identical
for everyone, with no per-user override storage or write path. There is no way for a learner to tune the
things that are legitimately theirs to tune (difficulty pacing, batch size, which sentence directions to
practise), and there is no user identity to hang those preferences on beyond a duplicated
`USER_ID = 'demo-user'` string constant scattered across routes.

EP41 realizes **D4 of that ADR**: a DB-backed T1 preference tier on a single seeded user identity. It
draws the tier boundary in code (T3 knobs become fixed constants; T1 knobs become per-user overrides),
introduces the identity seam that real auth will later replace, and adds a validated write path — while
holding every guarantee the ADR fixed: scoring stays direction-blind, the mastery bar stays fixed and
comparable, and config policy never leaks into `@gll/api-contract`.

## Scope

**In scope**:

- A single seeded `demo-user` identity and one current-user resolver replacing the duplicated `USER_ID` constants.
- A per-user config table storing a **difficulty preset name** plus standalone T1 prefs.
- Named **difficulty presets** (Gentle / Normal / Intense) → server-owned bundle of streak thresholds.
- `GET /api/user/config` resolving `system defaults ← user overrides`, dropping the `pedagogy` key, and exposing a read-only `system` section for the T3 values the client legitimately applies.
- `PUT /api/user/config` write path with **server-side zod validation** (schema never in `@gll/api-contract`).
- Forward-only application of preference changes (no recalibrate / no retro-rewrite).
- Tier reclassification in code: T3 knobs become fixed constants; served read-only only where the client applies them.

**Out of scope**:

- Real auth / login / multi-user (the resolver is a seam, not a login system).
- `wordDirections` preference and question-direction recording → [Question-Direction Recording ADR](../../product-documentation/architecture/20260711T004916Z-engineering-question-direction-recording.md), a later epic.
- Per-deck / curator-facing pedagogy configuration.
- Exposing raw engine knobs (streak integers, scheduler gaps, FSRS params) directly to the user.
- Opt-in recalibrate / retroactive re-scoring (moot — the mastery bar is fixed).

---

## Stories

<!-- Phases group the epic into: identity seam → storage → presets/resolve → write path → tier cleanup. -->

### Phase 1: Identity foundation (EP41-PH01)

### EP41-ST01: Single-user identity seam

**Scope**: Seed one `demo-user` row (the `id: 'demo-user'` in `seed/seed-db.ts` becomes the canonical identity) and collapse the five duplicated `USER_ID = 'demo-user'` route/source declarations — `routes/answer.ts`, `routes/shelving.ts`, `routes/state.ts`, `routes/reviews.ts`, `seed/cli.ts` (plus the test-only `routes/test-seed.ts` seam) — into one `getCurrentUserId()` resolver, the seam real auth replaces later. Test fixtures that hardcode `'demo-user'` are left as-is (they assert against the seeded id). No behaviour change; pure consolidation onto a persisted identity.

### Phase 2: Preference storage (EP41-PH02)

### EP41-ST02: Per-user config storage

**Scope**: `@gll/db` — store per-user config (selected difficulty **preset name** plus standalone T1 prefs `wordsPerBatch`, `sentenceDirections`) behind an `IUserConfigStore` port; store + migration only, no route wiring. *(As-built: a `config` JSON blob column on `users`, not a standalone `user_config` table — see DS01's Amendment. Trade-off: the name-only invariant is enforced at the ST05 write path, not by storage.)*

### EP41-ST03: Difficulty presets map

**Scope**: `apps/server` — define the server-owned Gentle / Normal / Intense → `{correctStreakThreshold, wrongStreakThreshold}` bundle map; a preset name resolves to a validated streak-threshold bundle. Names are the only thing persisted; raw values never leave the server. **This epic ships `normal` only** (pinned to today's config, zero behaviour change); `gentle`/`intense` are reserved names with **deferred values** — a later story fills their bundles and makes them selectable.

### Phase 3: Config resolution & write (EP41-PH03)

### EP41-ST04: `GET /api/user/config` resolves user overrides

**Scope**: Assemble the response as `system defaults ← current-user overrides`; drop the `pedagogy` key; add a read-only `system` section carrying the T3 values the client applies (progress-bar `maxMastery`, sentence scheduler, `masteryThreshold` for completed-deck detection). Fail-closed shape unchanged for the FE.

### EP41-ST05: `PUT /api/user/config` write path

**Scope**: New write route with **server-side zod** validation (adds zod as an `apps/server` dep; schema stays out of `@gll/api-contract`). Reject unknown preset names and out-of-range standalone prefs; persist via `IUserConfigStore.put` for the current user; forward-only (no recalibrate). *(Sole enforcement of the name-only invariant, given blob storage.)*

### Phase 4: Tier boundary cleanup (EP41-PH04)

### EP41-ST06: Tier reclassification in code

**Scope**: Move T3 knobs (`masteryThreshold`, `maxMastery`, `sentenceScheduling.*`, `sentenceGraduation.*`, `maxRetryPerWord/Session`) to fixed constants; serve read-only only where the client applies them; never serve FSRS / seed / recheck internals. Confirms scoring path stays direction-blind and the mastery bar stays fixed.

---

## Overall Acceptance Criteria

- [x] A single seeded `demo-user` exists; no route reads a hard-coded `USER_ID` constant — all go through one resolver.
- [x] Per-user config (`users.config` blob) persists a difficulty preset name + standalone prefs; a fresh user (NULL blob) resolves to system defaults.
- [x] `GET /api/user/config` returns `defaults ← overrides` with no `pedagogy` key and a read-only `system` section; FE remains fail-closed.
- [x] `PUT /api/user/config` validates server-side with zod, rejects unknown presets / out-of-range prefs, and persists forward-only.
- [x] Difficulty presets change streak pacing only; `masteryThreshold` / `maxMastery` remain fixed for every user.
- [x] No config policy type or value appears in `@gll/api-contract`; scoring remains direction-blind.
- [x] Coverage for: preset selection changes pacing, invalid write rejected, fresh user gets defaults. *(Satisfied via vitest integration tests — `apps/server/src/__tests__/config.test.ts`, `answer.test.ts` — not Gherkin `.feature` files; no `apps/srs-demo/e2e/features/*.feature` was authored for this epic.)*

---

## Dependencies

- [Config Ownership — Two-Tier Model ADR](../../product-documentation/architecture/20260711T004050Z-engineering-config-ownership-two-tier.md) (D4) — parent decision.
- `@gll/db` (Drizzle/SQLite) for the `users.config` blob column (as-built) and `users` seed.
- zod (new `apps/server` dependency; currently routes hand-roll validation).

## Next Steps

Complete. Implemented across [DS01](../../changelogs/EP41--config-preference-tier/20260711T011809Z-EP41-DS01-identity-and-preference-storage.md) (identity + storage) and [DS02](../../changelogs/EP41--config-preference-tier/20260711T012341Z-EP41-DS02-config-resolve-write-and-tier-application.md) (resolve + write + tier cleanup) on `feat/EP41--user-config-reference`. Only `normal` ships a difficulty bundle; `gentle`/`intense` remain reserved, unselectable names for a later epic.
