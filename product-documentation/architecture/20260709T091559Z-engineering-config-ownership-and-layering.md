# ADR: Config Ownership & Layering (System vs Pedagogy vs User Preference)

**Date**: 20260709T091559Z
**Status**: Accepted

<!-- Status: Accepted | Superseded | Deprecated -->

**Superseded by**: N/A
**Epic**: Realised incrementally. EP37 (Learning Authority) lands the server-owned learning-policy source (DS05); a future per-user-config epic lands the preference tier. This ADR does not fix epic numbers.
**RFC**: N/A

---

## Context

Configuration in this system has accreted without a ratified ownership model, and the cost is a recurring design loop: every spec that touches a threshold re-litigates *"why does this value live here, and who is allowed to change it?"*

Three concrete pressures forced the question:

1. **Duplication held together by convention.** The four learning-policy values (`masteryThreshold` + `streakThresholds.{correctStreakThreshold, wrongStreakThreshold, maxMastery}`) were declared in **two** places — server [`LEARNING_CONFIG`](../../apps/server/src/config/learning.ts) and the client [`CONFIG`](../../apps/srs-demo/src/App.vue) ref — and kept in sync by a manual parity check (EP37-DS04). That is latent drift: a second UI (a future mobile/CLI client) would carry its own copy and diverge per client, corrupting the shared per-user `WordState` it writes to.

2. **The authority principle already decided *state*, but not *config*.** The [Learning Authority ADR](20260708T125551Z-engineering-srs-demo-learning-authority-and-debug-trace.md) moved the state *transition* to the server (`POST /api/answer`) and set the rule "behavioural config is server-owned, never in `@gll/api-contract`; clients render UI and send raw answers." But it never enumerated *which* config that covers, where non-policy config lives, or how config would extend to per-user tuning.

3. **A live product question: per-user tunability.** Product wants users to tune difficulty on a per-account basis. Without a classification model, "let users change config" is ambiguous — some knobs are safe preferences, some are pedagogical design, and some are algorithm internals that would be meaningless or dangerous to expose.

This ADR governs configuration for `srs-demo` and the server it talks to. `cli-demo-db` (full local authority) inherits only the classification model, not the server-distribution mechanics.

---

## Decision

Four ratified decisions: a **classification model** (D1), an **ownership & distribution rule** (D2), the **per-user extension** (D3), and a **never-expose boundary** (D4).

### D1 — Every config value belongs to exactly one of three tiers

| Tier | Definition | Who may change it | Where it lives |
| --- | --- | --- | --- |
| **T1 — User preference** | A personal-taste knob whose change does not violate a system invariant | End user (via UI, as a **preset**) | Server, per-user store (policy) or per-user prefs (presentation) |
| **T2 — Pedagogy / content** | Course-design tuning shared by all learners of that content | Content author / admin | Server config (global or per-deck), not end-user |
| **T3 — System invariant / algorithm internal** | Defines a scale, an invariant, or an algorithm's internals | Engineering only (code) | Code / server constants; never exposed |

**Rule for a new knob:** default it to **T3**. Promote to T2 only if it is genuine course-design; promote to T1 only if (a) a user would meaningfully want it, (b) it can be expressed as a bounded preset, and (c) no reachable value breaks a system invariant. When in doubt, it stays lower.

**The current surface, classified:**

| Config | Tier | Notes |
| --- | --- | --- |
| `masteryThreshold` | **T1** | Core difficulty. Policy → server-applied, validated, preset-driven. |
| `streakThresholds.correctStreakThreshold` / `wrongStreakThreshold` | **T1** | "How forgiving." Expose via difficulty preset, not raw. |
| `wordsPerBatch` | **T1** | Session length. Safest knob — pure pacing, no `WordState` impact. |
| `sentenceDirections` | **T1** | Practice-mode preference (e.g. hide romanization). Presentation only. |
| `maxRetryPerWord` / `maxRetryPerSession` | **T1 (advanced)** | Retry patience. Real but subtle; bury under "advanced," don't surface by default. |
| `streakThresholds.maxMastery` | **T3** | Defines the mastery **scale** and the progress-bar `max-mastery` prop. Coupled to `masteryThreshold`. **Derived/locked, never user-set** (see D3). |
| `sentenceScheduling.*`, `sentenceGraduation.*` | **T2** | Pedagogical unlock/graduation timing. Content design, not personal taste. |
| `stagnationBatchWindow` (shelving) | **T2** | Adaptive auto-shelving trigger; meaningless number to end users. |
| FSRS `request_retention`, `enable_short_term`, weight vector | **T3** | Spaced-repetition internals. |
| Seed heuristics `EASY_STREAK`, `GOOD_RATIO`; recheck mechanics | **T3** | Engine internals. |

### D2 — Ownership & distribution: policy is server-owned, served read-only, never carried by clients

- **Learning policy (T1-policy + all T2/T3 that affect `WordState`) is server-owned.** It is declared server-side and applied server-side on the `/api/answer` transition. This extends the Learning Authority ADR from *state* to *config*.
- **Clients consume policy read-only** via `GET /api/config`; they hold **no** copy and cannot pin or version it. Neither the policy **values** nor a policy **type** appear in `@gll/api-contract` — the response shape is declared server-side and the client types its result with a local shape. (This is EP37-DS05.)
- **Presentation/orchestration config that never touches `WordState`** (`wordsPerBatch`, retries, `sentenceScheduling`, `sentenceGraduation`, `sentenceDirections`) is **client-owned** and legitimately per-UI. A different UI may set different values or omit a knob entirely.
- **Fail-closed:** if a client cannot fetch policy, it does not start a session and surfaces an error. It must never fall back to a hardcoded policy — a fallback constant is a second source.

### D3 — Per-user extension: overrides are server-side, validated, and preset-shaped

When a T1 knob becomes per-user:

1. **Storage & application stay server-side.** A per-user override is stored in the DB and merged over system defaults **on the server**; `/api/answer` applies the resolved value. `GET /api/config` returns *this user's resolved policy* (defaults ← overrides). The endpoint contract is unchanged — only its source moves from a constant to a per-user resolver.
2. **Presets, not raw integers.** Expose bounded presets (e.g. *Difficulty: Gentle / Normal / Intense*) that map to a **validated bundle** of thresholds. Raw knobs let users create non-graduating combos (`correctStreakThreshold > maxMastery`).
3. **Server validates every override.** Bounds-checked on write; an out-of-range or invariant-violating value is rejected. The server never trusts a client-supplied threshold — otherwise a spoofed value fakes mastery.
4. **`maxMastery` is derived, not user-set.** It is a T3 scale constant constrained to `maxMastery ≥ masteryThreshold`. If `masteryThreshold` becomes user-tunable, `maxMastery` tracks it (or is clamped ≥ it); it is never an independent user knob.
5. **Retroactivity is forward-only by default.** Changing a policy value applies to **subsequent** answers only; existing `WordState` is **not** recomputed. `mastery` is a monotonic record of what happened under the policy in effect at answer time; silently "un-mastering" a word on a settings change is user-hostile. *(Full recomputation is technically possible by replaying the EP37 transition-channel `answer_events` under new thresholds — offered only as an explicit, user-initiated "recalibrate," never as an implicit side effect of a settings change.)*

### D4 — The never-expose boundary

T3 values are never surfaced to end users under any UI: the FSRS parameter/weight vector, `request_retention`, `enable_short_term`, the seed heuristics, the recheck mechanics, and any scale-defining constant (`maxMastery`). Exposing them yields meaningless knobs, an unbounded support surface, and invariant-violation risk with no user benefit.

---

## Consequences

**Positive**:

- Ends the per-spec "why is this config here" loop: every knob has a tier, an owner, and a home, cited from one ADR.
- DS05 gains a ratified parent; the future per-user epic inherits the validation/preset/retroactivity rules instead of re-deriving them.
- The per-user model is a clean extension of server authority — no new authority model, just a per-user source behind an existing endpoint.
- The forward-only retroactivity rule reuses the EP37 transition channel for the *opt-in* recompute path, so the harder semantics are available without being imposed.

**Negative**:

- Preset-mapping and server-side validation are real added surface versus a raw settings form; the simplest "let users type a number" UX is deliberately disallowed.
- Per-user difficulty makes cross-user analytics/leaderboards apples-to-oranges. Accepted for a learning app; flagged so it is a conscious call, not a surprise.
- Two homes for config persist by design (server policy vs. client presentation). Intentional, but must be documented so it is not mistaken for the very duplication this ADR removes.

**Neutral**:

- **DS05 is correct and unconditional under every decision here.** No tiering or per-user outcome reverts "learning policy is server-owned and served read-only" — per-user policy is *still* server-owned (D3.1). DS05 is a strict prerequisite this ADR builds on, not a bet it could invalidate; it should ship independent of this ADR's ratification.
- `maxMastery`'s coupling to `masteryThreshold` (D3.4) may warrant deriving one from the other in the engine; noted, not mandated here.
- Presentation config staying client-side (D2) leaves cross-device sync of preferences (e.g. `sentenceDirections`) as a later, optional move to a per-user prefs store — out of scope here.
