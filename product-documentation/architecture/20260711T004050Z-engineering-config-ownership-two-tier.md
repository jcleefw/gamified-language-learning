# ADR: Config Ownership — Two-Tier Model (User Preference vs System)

**Date**: 20260711T004050Z
**Status**: Accepted

<!-- Status: Accepted | Superseded | Deprecated -->

**Supersedes**: [Config Ownership & Layering](20260709T091559Z-engineering-config-ownership-and-layering.md)
**Superseded by**: N/A
**Epic**: The user-preference tier (D4) is realised by EP41. This ADR does not fix epic numbers for later work.
**RFC**: N/A

---

## Context

This supersedes the [Config Ownership & Layering ADR](20260709T091559Z-engineering-config-ownership-and-layering.md). That ADR's **Amendment 1 still holds and is largely shipped**: all config is server-sourced, the FE is a pure consumer that declares no config and holds no defaults, and `GET /api/config` serves the surface the FE applies (fail-closed). What this ADR replaces is that ADR's **classification model (its D1)** — the three-tier split of _user (T1) / pedagogy (T2) / system (T3)_ — which proved wrong on two counts once we tested each knob against the question _"who may actually change this, and what breaks if a user does?"_

Three findings forced the rewrite:

1. **`masteryThreshold` was mis-promoted to T1.** It is not personal taste — it **defines the core progress metric** (`mastery ≥ masteryThreshold` = "mastered") and triggers **persistent side effects**: graduation (retirement from the active pool) and **FSRS review-card seeding** (`apps/server/src/routes/answer.ts`, level-triggered on each answer). Making it per-user-tunable would (a) break cross-user comparison — "mastered" would mean a different bar per user; (b) break **content-difficulty analysis** — "which words are hard" becomes uncomputable across users; (c) break a single user's longitudinal history — lowering it retroactively re-classifies past words as mastered (it is a live comparison, never stored); and (d) **desync the review subsystem** — lowering it leaves newly-"mastered" words unseeded until their next answer, raising it leaves already-seeded review cards live for now-"unmastered" words. The classification model's own rule ("default to T3; when in doubt, stays lower") had been violated.

2. **The pedagogy tier (T2) had no genuine members.** Its only occupants — `sentenceScheduling` (`minSeenForSentence`, `sentenceBatchGap`) and `sentenceGraduation` (`sentenceCorrectStreakThreshold`, `sentenceWrongStreakThreshold`) — are **numeric tuning of the sentence-exercise scheduler** (`packages/srs-engine-v2/src/engine/sentence-scheduling.ts`): when a sentence unlocks, how it is spaced, when it retires. That is engine mechanics, not authored course design. A content author defines _content_ (which words, which sentences, translations, ordering), not "unlock after seen ≥ 1 vs 2." By the "when in doubt, stays lower" rule these are **system config**, and T2 collapses to empty.

3. **Retries are system, not preference.** `maxRetryPerWord` / `maxRetryPerSession` are a **learning-only** patience knob (Review has no retry — it re-spaces via FSRS instead). Recheck already freezes mastery/streak on a retry, so retries never touch the headline metric; they only affect raw `seen`/`correct`, i.e. they **confound raw-accuracy analytics** for no headline benefit. They belong in the fixed learning design (T3).

The net simplification: **there are only two tiers that matter — who-may-change-it is either _the user_ or _engineering_.** The middle "curator" tier was aspirational and empty. This ADR ratifies the two-tier model and the reclassifications, and records the scoring/direction boundary that the (separate, forthcoming) word-direction recording ADR builds on.

This ADR governs configuration for `srs-demo` and the server it talks to. `cli-demo-db` (full local authority) inherits only the classification model, not the server-distribution mechanics.

---

## Decision

Six ratified decisions: the **two-tier classification** (D1), the **server-sourced distribution rule carried forward from Amendment 1** (D2), the **scoring authority & direction-blindness boundary** (D3), the **per-user preference tier** (D4), the **T3 application split** (served-vs-never-served) (D5), and the **fixed-scale reclassification of `masteryThreshold`/`maxMastery`** (D6).

### D1 — Every config value is either T1 (user preference) or T3 (system). There is no middle tier.

| Tier                      | Definition                                                                             | Who may change it                     | Where it lives                                   |
| ------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------- | ------------------------------------------------ |
| **T1 — User preference**  | A personal-taste knob whose change does not violate a system invariant or redefine a shared metric | End user, via a bounded **preset** or explicit toggle | Server, per-user store; served resolved          |
| **T3 — System**           | Defines a scale/metric/invariant, an algorithm's internals, or fixed learning design    | Engineering only (code)               | Server code constants; served read-only _only_ when a client must apply it (D5), else never served |

**Rule for a new knob:** default it to **T3**. Promote to **T1** only if (a) a user would meaningfully want it, (b) it can be expressed as a bounded preset or a safe toggle, (c) no reachable value breaks a system invariant, and (d) changing it does not redefine a metric that is compared across users, content, or time. When in doubt, it stays T3.

**The current surface, classified:**

| Config                                                             | Tier   | Notes                                                                                                       |
| ------------------------------------------------------------------ | ------ | ----------------------------------------------------------------------------------------------------------- |
| `correctStreakThreshold` / `wrongStreakThreshold`                  | **T1** | The difficulty lever. Exposed via a **difficulty preset** (Gentle / Normal / Intense) → validated bundle.   |
| `wordsPerBatch`                                                    | **T1** | Session length. Standalone pref; pure pacing, no `WordState` impact. **Not** part of the difficulty preset. |
| `sentenceDirections`                                               | **T1** | Practice-mode preference — skip/enable specific sentence directions. Standalone pref. Scoring-blind (D3).   |
| `masteryThreshold`                                                 | **T3** | **Defines "mastered"** and triggers graduation + review seeding. Fixed → the bar is comparable (D6).        |
| `maxMastery`                                                       | **T3** | Mastery **scale** + progress-bar `max`. Coupled to `masteryThreshold`. Fixed (D6).                          |
| `sentenceScheduling.*`, `sentenceGraduation.*`                     | **T3** | Sentence-scheduler mechanics (unlock / spacing / retirement). Not authored course design.                   |
| `maxRetryPerWord` / `maxRetryPerSession`                           | **T3** | Learning-only retry patience. Recheck freezes mastery/streak; only affects raw accuracy. Fixed.             |
| FSRS `request_retention`, `enable_short_term`, weight vector       | **T3** | Spaced-repetition internals. Never served (D5).                                                             |
| Seed heuristics `EASY_STREAK`, `GOOD_RATIO`; recheck mechanics     | **T3** | Engine internals. Never served (D5).                                                                        |

_(Forthcoming: a `wordDirections` T1 pref — enable/disable word-question directions — is deferred to the word-direction recording ADR and a later epic, not ratified here.)_

### D2 — All config is server-sourced; the FE is a pure consumer (carried forward from Amendment 1)

Unchanged and still in force:

- **Every knob lives on the server and is changed through the API.** No config is declared or defaulted in the FE.
- **The FE fetches config at boot and applies what is relevant to it.** A client that ignores a knob simply does not consume it; it never re-declares it.
- **Fail-closed:** a client that cannot fetch config does not start a session and surfaces an error. It never falls back to a hardcoded value — a fallback constant is a second source of truth.
- **No config value or config type appears in `@gll/api-contract`.** The response shape is declared server-side; the client types its result with a local shape. This includes any validation schema for writes (D4): it is server-side, never in the shared contract.

The `GET /api/config` response drops the `pedagogy` key (T2 is gone). It now distinguishes **user-writable** config from **read-only system config the client must apply** (D5); the exact wire shape is a Design-Spec detail.

### D3 — Scoring is authoritative and direction-blind; direction-awareness is for selection, never scoring

- **Learning policy is applied server-side** on the `/api/answer` transition; `WordState` is the authoritative record. Clients render UI and send raw answers.
- **`WordState` is keyed by `wordId` and is direction-blind.** All directions of a word fold into one state. The `/api/answer` payload does not carry direction, and `answer_events` does not record it. Mastery/streak/accuracy therefore accumulate per word regardless of which direction prompted the answer.
- **Scoring must never become direction-aware.** Making mastery per-direction would fragment the comparable bar D6 protects.
- **Direction-awareness has a different, future job:** it feeds **difficulty and frequency population** — adaptive _selection_ of what gets served (e.g. show weaker directions more often) — never the score. Recording direction for that purpose is deferred to a separate **word-direction recording ADR**; note it requires extending `answer_events` (today word-only; sentence answers do not hit it).

### D4 — Per-user preference tier: DB-backed, preset-shaped, server-validated, forward-only

The T1 surface becomes per-user (realised by EP41):

1. **Storage & application stay server-side.** A per-user row stores the selected **difficulty preset name** plus standalone prefs (`wordsPerBatch`, `sentenceDirections`). `GET /api/config` returns _this user's resolved_ config (system defaults ← user overrides). The endpoint contract is unchanged — only its source moves from a constant to a per-user resolver.
2. **Presets, not raw integers.** Difficulty is a bounded preset (Gentle / Normal / Intense) mapping to a **validated bundle** of streak thresholds. Raw streak knobs are not exposed (they permit non-graduating combos).
3. **The server validates every write** (bounds + invariants), server-side (via `zod`), rejecting unknown presets or out-of-range prefs. The server never trusts a client-supplied threshold.
4. **Forward-only retroactivity.** A preference change applies to _subsequent_ answers only; existing `WordState` is never recomputed. Because `masteryThreshold`/`maxMastery` are now fixed (D6), the only user-tunable policy is streak forgiveness, so the retroactivity surface is minimal and **no opt-in "recalibrate" path is provided.**
5. **Identity now, auth later.** A single seeded user (`demo-user`) behind one current-user resolver replaces today's duplicated `USER_ID` constants. Real accounts/login are out of scope; the resolver is the seam they slot into.

### D5 — T3 application split: served read-only vs never served

T3 is never **writable** by anyone but engineering. Whether it is **served** depends solely on whether a client must _apply_ it:

- **Served read-only** (the client legitimately applies it): `masteryThreshold` and `maxMastery` (completed-deck detection, progress-bar scale), `sentenceScheduling.*` and `sentenceGraduation.*` (the sentence scheduler runs client-side). Served so the client and server apply the same value; never surfaced as a knob.
- **Never served** (the server/engine applies it): FSRS parameters/weights, `request_retention`, `enable_short_term`, seed heuristics, recheck mechanics. Exposing them yields meaningless knobs and invariant-violation risk with no user benefit.

"Served read-only for the client to apply" and "never a user knob" coexist: the axis is _who may change it_ (engineering), not _where it is applied_.

### D6 — `masteryThreshold` and `maxMastery` are a fixed scale, keeping "mastered" comparable

`masteryThreshold` defines the finish line and `maxMastery` the scale. Both are **fixed T3 constants**, never user-set. Difficulty is tuned by _how much effort it takes to advance_ (streak thresholds, T1) — not by _moving the finish line_. This keeps "% mastered" comparable across users, across content (per-word difficulty stays measurable), and across a single user's history, and it keeps the review-seeding trigger stable. If `masteryThreshold` were ever to change, `maxMastery` tracks/clamps to it (`maxMastery ≥ masteryThreshold`); neither is an independent knob.

---

## Consequences

**Positive**:

- Two tiers instead of three: no empty "pedagogy" tier to reason about; every knob is owned by either the user or engineering.
- Fixing `masteryThreshold`/`maxMastery` keeps "mastered" comparable across users, content, and time, keeps content-difficulty analysis valid, and prevents the review subsystem from desyncing on a threshold change.
- Difficulty is still genuinely tunable (streak forgiveness + session length + practice direction) without touching the comparable bar.
- Direction preferences carry **zero analytics cost** because scoring is direction-blind (D3).
- The per-user tier (D4) is a clean extension of server authority — a per-user source behind an existing endpoint, with validation/presets/forward-only inherited from this ADR rather than re-derived.

**Negative**:

- Difficulty presets are a narrower lever (effort-to-advance + pacing, not the finish line). Users cannot redefine "mastered" — deliberate.
- Preset-mapping and server-side validation are real added surface versus a raw settings form. The simplest "let users type a number" UX is disallowed on purpose.
- A user who skips the hardest direction can reach mastery via recognition only — the _path_ eases while the _bar_ is unchanged (D6). A conscious trade-off, flagged so it is not a surprise; a stricter direction-aware mastery is a possible future built on the word-direction ADR.

**Neutral**:

- Amendment 1 of the superseded ADR ("all config server-sourced; FE pure consumer; served via `GET /api/config`; fail-closed") carries forward unchanged and is largely shipped.
- Direction recording for difficulty/frequency population is deferred to a separate word-direction recording ADR; it requires extending `answer_events` (today word-only; sentence answers do not hit it).
- Per-deck pedagogy is moot now that the former T2 knobs are T3. If genuine per-deck _course-design_ config ever appears, a curator tier can be reintroduced then, on evidence, rather than pre-emptively.
