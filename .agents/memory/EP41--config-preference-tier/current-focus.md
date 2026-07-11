# Current Focus — EP41 Config Preference Tier (per-user T1)

**Status**: Completed. All 7 stories (DS01 + DS02) implemented; epic plan's Overall Acceptance
Criteria all checked off (BDD criterion satisfied via vitest — `config.test.ts` / `answer.test.ts` —
not Gherkin `.feature` files; none authored for this epic).
**Branch**: `feat/EP41--user-config-reference` (off `main`), not yet merged to `main`.
**Last updated**: 20260711T014500Z

---

## What this epic is

EP41 realizes the **T1 user-preference tier**, DB-backed, on a seeded single-user identity. It is the
child epic of the config two-tier ADR. The epic plan is drafted at
[`.agents/plans/EP41-config-preference-tier.md`](../../plans/EP41-config-preference-tier.md); the two
design specs (DS01 identity/storage, DS02 resolve/write/tier) are implemented on this branch.

## Reference point — the two parent ADRs

Treat these as the source of truth; do not re-derive scope.

1. **Config Ownership — Two-Tier Model** —
   [`product-documentation/architecture/20260711T004050Z-engineering-config-ownership-two-tier.md`](../../../product-documentation/architecture/20260711T004050Z-engineering-config-ownership-two-tier.md).
   Supersedes the original config-ownership & layering ADR (now `Status: Superseded`). EP41 is its D4.
2. **Question-Direction Recording** (deferred) —
   [`product-documentation/architecture/20260711T004916Z-engineering-question-direction-recording.md`](../../../product-documentation/architecture/20260711T004916Z-engineering-question-direction-recording.md).

## Resolved decisions (do not re-open)

- **Two tiers only: T1 (user) / T3 (system). T2/pedagogy eliminated** (it was empty).
- **`masteryThreshold` + `maxMastery` → T3, fixed.** They define the "mastered" bar and trigger
  graduation + FSRS review-card seeding ([answer.ts:119](../../../apps/server/src/routes/answer.ts#L119)).
  Per-user tuning would break cross-user/content/time analytics and desync the review subsystem.
  Difficulty is tuned via **streak forgiveness + pacing**, keeping the finish line fixed & comparable.
- **Sentence scheduler** (`sentenceScheduling.*`, `sentenceGraduation.*`) **and retries**
  (`maxRetryPerWord/Session`) **→ T3, fixed.** They are engine mechanics, not course design / not taste.
- **Scoring is permanently direction-blind** (config ADR D3). `WordState` keyed by `wordId`;
  direction never in scoring. Direction-awareness is reserved for difficulty/frequency population (→ ADR #2).
- **Config storage stores the difficulty preset NAME only** (+ standalone prefs), not raw values.
- **Forward-only retroactivity; NO recalibrate** — moot now that the mastery bar is fixed.

## EP41 in-scope stories (7)

1. **Identity foundation** — seed one `demo-user` row (a `users` row); collapse the duplicated
   `USER_ID = 'demo-user'` constants ([state.ts:6](../../../apps/server/src/routes/state.ts#L6),
   [reviews.ts:21](../../../apps/server/src/routes/reviews.ts#L21), `seed/cli.ts:8`, `answer.ts`) into one
   current-user resolver — the seam real auth replaces later.
2. **Per-user config table** — keyed by `user_id`; stores selected **difficulty preset name** +
   standalone prefs (`wordsPerBatch`, `sentenceDirections`).
3. **Difficulty presets** — Gentle/Normal/Intense → validated bundle of streak thresholds
   (`correctStreakThreshold`, `wrongStreakThreshold`). Server owns the name→bundle map.
4. **`GET /api/user/config` resolves** `defaults ← user overrides` for current user; drop the `pedagogy`
   key; add a read-only "system" section for served T3 the client applies. Current assembly:
   [config.ts](../../../apps/server/src/routes/config.ts) + [learning.ts](../../../apps/server/src/config/learning.ts).
5. **`PUT /api/user/config` write path** — **zod** validation, **server-side** (schema never in
   `@gll/api-contract`); reject unknown presets / out-of-range prefs. Note: server routes currently
   hand-roll validation (no zod yet); this adds zod as an `apps/server` dep.
6. **Forward-only retroactivity; no recalibrate.**
7. **Tier reclassification in code** — move T3 knobs to fixed constants; served read-only where the
   client applies them (`maxMastery` progress bar, sentence scheduler, `masteryThreshold`
   completed-deck detection); never served for FSRS/seed/recheck internals.

## Out of scope

Real auth/login; `wordDirections` pref + direction recording (→ direction ADR, later); per-deck
pedagogy; raw-knob tuning; opt-in recalibrate.

## Next steps

Epic complete on this branch. Remaining before merge to `main`:

1. Merge `feat/EP41--user-config-reference` to `main`.
2. `gentle`/`intense` presets remain wired but unselectable (reserved names, no bundle) until a later
   epic opens them via the difficulty ADR.
