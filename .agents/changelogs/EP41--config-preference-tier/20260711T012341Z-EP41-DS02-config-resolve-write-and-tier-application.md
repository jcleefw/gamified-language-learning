# EP41-DS02: Config Resolution, Write Path & Tier Application Specification

**Date**: 20260711T012341Z
**Status**: Accepted
**Epic**: [EP41 - Per-User Config Preference Tier (T1)](../../plans/EP41-config-preference-tier.md)

**Architecture**:
[Config Ownership — Two-Tier Model](../../../product-documentation/architecture/20260711T004050Z-engineering-config-ownership-two-tier.md) — **D4/D5**, Accepted. This DS delivers the **surface half** of EP41 on top of [DS01](20260711T011809Z-EP41-DS01-identity-and-preference-storage.md)'s foundation: `GET /api/user/config` resolving base ← per-user overrides with the new two-section wire shape (ST04), the `PUT /api/user/config` write path with server-side zod validation (ST05), and the tier reclassification in code — including the point where T1 difficulty **takes effect** on the authoritative `/api/answer` transition (ST06). It **requires DS01 to be merged** (`getCurrentUserId`, `IUserConfigStore`, `DIFFICULTY_PRESETS`).

> **Note (depends on DS01 as-built).** DS01 stores config as a JSON blob on `users.config` (not a `user_config` table). Two implications for this DS: (1) the ST05 zod schema is the **sole** enforcement of the preset-name-only invariant — storage cannot reject a raw threshold, so `.strict()` + the `DIFFICULTY_PRESETS`-derived enum are load-bearing, not defence-in-depth; (2) `IUserConfigStore.put` is a read-modify-write over an **existing** `users` row (no-op for an absent user). The port surface (`get`/`put`) is unchanged, so ST04/ST05/ST06 consume DS01 exactly as written below.

---

## 1. Feature Overview

DS01 made the substrate exist — an identity seam, a per-user config store (a `users.config` JSON blob behind `IUserConfigStore`), and a server-only preset map — but nothing reads or writes it yet. `GET /api/user/config` still returns flat module constants ([`config.ts:14`](../../../apps/server/src/routes/config.ts#L14) → [`getAppConfig()`](../../../apps/server/src/config/learning.ts#L87)), and the `/api/answer` transition still applies the global `LEARNING_CONFIG.streakThresholds` for every user ([`answer.ts:86`](../../../apps/server/src/routes/answer.ts#L86)). This DS turns the substrate into behaviour.

Three changes, each building on DS01:

- **Read resolution (ST04)** — `GET /api/user/config` becomes `base ← current-user overrides`: read the difficulty preset name + standalone prefs from `IUserConfigStore` for `getCurrentUserId()`, fall back to `DEFAULT_PRESET`/base for any absent field, resolve the preset name to its `StreakThresholds`, and return the **new two-section shape** — `user` (T1, resolved, writable) and `system` (T3, served read-only because the client applies it). The `pedagogy` key is **dropped**. The client's boot merge changes from `{...cfg.user, ...cfg.pedagogy}` to `{...cfg.user, ...cfg.system}`; its flat `ConfigType` is otherwise unchanged.
- **Write path (ST05)** — a new `PUT /api/user/config` route validated **server-side with zod** (schema never in `@gll/api-contract`). It accepts a partial T1 patch (`difficultyPreset?`, `wordsPerBatch?`, `sentenceDirections?`), rejects unknown preset names and out-of-range prefs with a 400, and on success upserts via `IUserConfigStore.put(getCurrentUserId(), patch)`. **T3 fields are not accepted** — the schema has no key for them, so an attempt to set `masteryThreshold` is an unknown-key rejection, not a silent no-op. Forward-only: the write changes future sessions; it never rewrites past `WordState`/events.
- **Tier application (ST06)** — reclassify the config constants in code to match the ADR, and wire the T1 difficulty to the place it takes effect. `masteryThreshold` and `maxMastery` become **fixed T3 constants**; `sentenceScheduling`/`sentenceGraduation`/`maxRetryPerWord`/`maxRetryPerSession` are **fixed T3 served read-only** under `system`; and the `/api/answer` transition resolves the **per-user `streakThresholds`** (from the user's preset) instead of the global constant.

**The moment T1 takes effect (the crux, testable).** Difficulty is applied on the authoritative scoring path, not cosmetically. [`answer.ts`](../../../apps/server/src/routes/answer.ts) currently calls `updateRunState(..., LEARNING_CONFIG.masteryThreshold, LEARNING_CONFIG.streakThresholds)`. After ST06 it uses the **fixed** `masteryThreshold` and the **per-user resolved** `streakThresholds` — sourced from the user's stored preset via `IUserConfigStore`, not a module constant. This DS moves the *application point*; since only `normal` ships a bundle (DS01), every user still resolves to today's values, so behaviour is unchanged now — but the wiring is complete, so when `gentle`/`intense` land they take effect with **no further change to the transition**. The guarantee that survives regardless of preset: **everyone graduates at the same fixed bar** (`masteryThreshold`/`maxMastery` identical for all), so presets can only ever tune forgiveness/pacing, never the finish line.

**The invariant this DS locks (testable).** The wire is **tier-shaped and asymmetric**: `system` is read-only (there is no route that writes it) and `user` is the only writable surface. `PUT` cannot reach a T3 field because the zod schema has no key for one. Scoring stays direction-blind and the mastery bar stays fixed regardless of preset.

**What is reused, not built:**

- **DS01 primitives** — `getCurrentUserId()`, `IUserConfigStore`/`SqliteUserConfigStore`, `DIFFICULTY_PRESETS`/`resolvePreset`/`isDifficultyPreset`. This DS consumes them; it does not redefine them.
- **zod** — already in the monorepo (`^4.4.3`, used by `@gll/api-contract`); ST05 adds it to `apps/server`'s deps at the same version. No new external dependency decision.
- **Client fail-closed boot** — `configReady` gating already exists ([`App.vue:159`](../../../apps/srs-demo/src/App.vue#L159), [`242`](../../../apps/srs-demo/src/App.vue#L242)); ST04 only changes which sections merge into `CONFIG`.
- **Config wire types stay server-side** — `AppConfigResponse` already lives in [`config/learning.ts`](../../../apps/server/src/config/learning.ts), not `@gll/api-contract`; the new request/response types follow that precedent.

**Not in this DS**: a preferences UI in `srs-demo` (out of EP41 scope — the write path is validated via API/tests); `wordDirections` preference and direction recording (deferred ADR); any recalibrate/retro path (moot — the mastery bar is fixed).

---

## 2. Core Requirements

| Requirement | Decision | Rationale |
| --- | --- | --- |
| `GET /api/user/config` resolution | `base ← user overrides`: read the config blob (`IUserConfigStore.get`) for `getCurrentUserId()`, fall back to `DEFAULT_PRESET`/base per absent field | The user only overrides what they set; everything else stays on the server base |
| Wire shape | Two sections: `user` (T1, resolved) + `system` (T3, read-only). `pedagogy` key dropped | Matches the ADR's two-tier model; `system` exists only because the client legitimately applies those T3 values |
| `streakThresholds` on the wire | The **resolved** bundle (preset's correct/wrong + fixed `maxMastery`) under `user` | The engine's `SessionConfig` consumes it as a unit; the progress bar reads `streakThresholds.maxMastery` |
| Client merge change | `CONFIG.value = { ...cfg.user, ...cfg.system }` (was `...cfg.pedagogy`) | Flat `ConfigType` unchanged; only the source sections change — minimal FE churn |
| `PUT /api/user/config` validation | Server-side zod; schema in `apps/server`, never `@gll/api-contract` | Config *policy/validation* is server-owned (ADR); only the name token is exchanged |
| `PUT` accepted fields | Partial `{ difficultyPreset?, wordsPerBatch?, sentenceDirections? }` only | T1 is the only writable tier; T3 has no key, so writing it is an unknown-key 400 |
| Unknown preset / bad pref | 400 with a field error; nothing persisted | Preset-name-only invariant enforced at the edge; bounded, validated choice |
| Persistence of a write | `IUserConfigStore.put(getCurrentUserId(), patch)` — partial upsert | Reuses DS01 store; only provided fields change |
| Retroactivity | Forward-only; no recalibrate, no event/`WordState` rewrite | ADR: forward-only, and moot since the mastery bar is fixed |
| Difficulty application point | `/api/answer` applies **per-user** `streakThresholds`, **fixed** `masteryThreshold` | The one place difficulty takes effect on the authoritative transition |
| `masteryThreshold` / `maxMastery` | Fixed T3 constants, identical for every user/preset | Comparable mastery bar; per-user tuning would desync analytics + review seeding |
| Sentence scheduler / retries | Fixed T3, served read-only under `system` | Engine mechanics, not user taste; client still needs the values to compose sessions |
| Test-only sentence override | `/api/test/config/sentence` seam left intact | It overrides `system.sentenceScheduling/Graduation` for BDD; unrelated to T1 |

## 3. Data Structures

```typescript
// --- ST04: new GET /api/user/config wire shape (apps/server/src/config/learning.ts) ---
// Declared server-side (NOT in @gll/api-contract), replacing today's { user, pedagogy }.
export interface AppConfigResponse {
  user: {                                    // T1 — resolved defaults ← overrides, writable
    difficultyPreset: DifficultyPreset;      // the selected NAME (echoed back for the UI)
    streakThresholds: StreakThresholds;      // RESOLVED from the preset (correct/wrong + fixed maxMastery)
    wordsPerBatch: number;
    sentenceDirections: SentenceQuestion['direction'][];
  };
  system: {                                  // T3 — served read-only; client applies, cannot write
    masteryThreshold: number;                // fixed
    maxRetryPerSession: number;              // fixed
    maxRetryPerWord: number;                 // fixed
    sentenceScheduling: { minSeenForSentence: number; sentenceBatchGap: number };
    sentenceGraduation: {
      sentenceCorrectStreakThreshold: number;
      sentenceWrongStreakThreshold: number;
    };
  };
}

export async function getAppConfig(userId: string): Promise<AppConfigResponse>;

// --- ST05: PUT /api/user/config request (apps/server/src/config/config-schema.ts) ---
import { z } from 'zod';
// The preset enum is DERIVED from the presets that currently ship a bundle
// (DS01: only `normal`), NOT hard-coded to the three names. So `gentle`/`intense`
// are rejected as invalid until their bundles land, with no schema edit needed then.
const selectablePresets = Object.keys(DIFFICULTY_PRESETS) as [DifficultyPreset, ...DifficultyPreset[]];
export const putConfigSchema = z.object({
  difficultyPreset: z.enum(selectablePresets).optional(),   // currently ⟺ 'normal' only
  wordsPerBatch: z.number().int().min(1).max(10).optional(),
  sentenceDirections: z.array(z.string()).optional(),       // membership checked against known directions
}).strict();                                                // unknown keys (e.g. masteryThreshold) → 400
export type PutConfigRequest = z.infer<typeof putConfigSchema>;
// Response: the freshly-resolved AppConfigResponse (so the client re-syncs in one round trip).

// --- ST06: reclassified constants (apps/server/src/config/learning.ts) ---
// masteryThreshold + maxMastery become fixed T3 constants; USER_PRESENTATION splits
// (wordsPerBatch/sentenceDirections → T1 base; retries → T3 system); PEDAGOGY_CONFIG
// (sentenceScheduling/Graduation) → T3 system. streakThresholds no longer a served
// global — it is resolved per user from the preset.
export const FIXED_SYSTEM = {
  masteryThreshold: 2,          // fixed bar
  maxMastery: 2,                // fixed scale (also inside every preset bundle)
  maxRetryPerSession: 5,
  maxRetryPerWord: 2,
  sentenceScheduling: { minSeenForSentence: 1, sentenceBatchGap: 2 },
  sentenceGraduation: { sentenceCorrectStreakThreshold: 2, sentenceWrongStreakThreshold: 3 },
} as const;
```

## 4. User Workflows

```
# ST04 — read (per current user)
GET /api/user/config
  → userId = getCurrentUserId()
  → cfg = userConfigStore.get(userId)            // null ⟺ no overrides
  → preset = cfg?.difficultyPreset ?? DEFAULT_PRESET
  → { user: { difficultyPreset:preset, streakThresholds:resolvePreset(preset),
              wordsPerBatch: cfg?.wordsPerBatch ?? base, sentenceDirections: cfg?... ?? base },
      system: FIXED_SYSTEM }

# ST05 — write (forward-only)
PUT /api/user/config  { difficultyPreset:'normal' }   // 'gentle'/'intense' deferred → 400 for now
  → putConfigSchema.safeParse(body)
      fail → 400 { field errors }                // deferred/unknown preset / bad pref / unknown key
      ok   → userConfigStore.put(getCurrentUserId(), patch) → 200 { resolved AppConfigResponse }

# ST06 — application (the crux)
POST /api/answer
  → thresholds = resolvePreset(userConfigStore.get(userId)?.difficultyPreset ?? DEFAULT_PRESET)
  → updateRunState(..., FIXED_SYSTEM.masteryThreshold, thresholds)   // fixed bar, per-user forgiveness
  → isMastered(after, FIXED_SYSTEM.masteryThreshold)                 // same finish line for everyone
```

## 5. Stories

### Phase 3: Config resolution & write (EP41-PH03)

### EP41-ST04: `GET /api/user/config` resolves user overrides

**Scope**: Rework `getAppConfig` + the route to resolve per-user overrides and return `{ user, system }`; update the client boot merge. Depends on DS01 (ST01/ST02/ST03).
**Read List**: `apps/server/src/routes/config.ts`, `apps/server/src/config/learning.ts`, `apps/srs-demo/src/App.vue` (boot merge ~L242), `apps/srs-demo/src/types.ts`, DS01's `user-config-store` + `difficulty-presets`
**Tasks**:

- [x] Make `getAppConfig(userId)` async; read `IUserConfigStore`, fall back per field, resolve the preset, return `{ user, system }` (drop `pedagogy`). *(As-built: `getAppConfig(store, userId)` — the store is passed in, matching how routes construct stores and keeping it unit-testable.)*
- [x] Update the route to `getCurrentUserId()` and `await getAppConfig(userId)`.
- [x] Change the client merge to `{ ...cfg.user, ...cfg.system }`; confirm `ConfigType` still satisfied.

**Acceptance Criteria**:

- [x] A user with no config (NULL blob) gets `difficultyPreset:'normal'` and values byte-identical to today's response (minus `pedagogy`, plus `system`).
- [x] After a preset override exists, `user.streakThresholds` equals `resolvePreset(that preset)`.
- [x] The client renders with no missing `CONFIG` field; `configReady` gating unchanged; progress bar (`streakThresholds.maxMastery`) and completed-deck detection (`masteryThreshold`) still resolve.

### EP41-ST05: `PUT /api/user/config` write path (zod)

**Scope**: New validated write route; add zod to `apps/server`. No UI.
**Read List**: `apps/server/src/routes/config.ts`, `apps/server/src/index.ts` (route mount), `apps/server/package.json`, DS01's `user-config-store` + `difficulty-presets`
**Tasks**:

- [x] Add `zod` to `apps/server` deps (`^4.4.3`); add `config/config-schema.ts` (`putConfigSchema` `.strict()`, `sentenceDirections` membership check via `z.enum(KNOWN_DIRECTIONS)`).
- [x] Add `PUT /api/user/config`: `safeParse` → 400 on failure (field errors folded into the `ApiError.message`, since the shared `ApiError` has no `details` field); on success `userConfigStore.put(getCurrentUserId(), patch)` then return the freshly-resolved `AppConfigResponse`.
- [x] Ensure unknown keys (e.g. `masteryThreshold`) and unknown preset names are rejected, nothing persisted.

**Acceptance Criteria**:

- [x] Valid `{ difficultyPreset:'normal' }` and `{ wordsPerBatch: 4 }` persist; the response reflects the resolved config.
- [x] `{ masteryThreshold: 5 }` (unknown key), `{ difficultyPreset:'intense' }` / `{ difficultyPreset:'gentle' }` (deferred), `{ difficultyPreset:'turbo' }` (unknown), `{ wordsPerBatch: 0 }` (out of range) each 400 with nothing written.
- [x] The zod schema/types appear only under `apps/server` — never in `@gll/api-contract`.

### Phase 4: Tier boundary application (EP41-PH04)

### EP41-ST06: Tier reclassification & per-user difficulty application

**Scope**: Split config constants into fixed T3 vs T1-base; apply per-user `streakThresholds` on `/api/answer`. This is where T1 difficulty takes effect.
**Read List**: `apps/server/src/config/learning.ts`, `apps/server/src/routes/answer.ts`, `packages/srs-engine-v2/src/types/word-state.ts` (`updateRunState`, `isMastered`), DS01's `difficulty-presets`
**Tasks**:

- [x] Introduce `FIXED_SYSTEM` (T3 constants) + `T1_BASE` (T1 non-difficulty fallbacks); retire `LEARNING_CONFIG`/`USER_PRESENTATION`/`PEDAGOGY_CONFIG` into that split. *(`scenario-builder` reads the fixed mastery bar from `FIXED_SYSTEM.masteryThreshold`; the per-user difficulty bundle is resolved on the live `/api/answer` transition, not from a module constant.)*
- [x] In `answer.ts`, resolve per-user `streakThresholds` from the user's preset (via `resolveUserThresholds(store, userId)`); pass the **fixed** `masteryThreshold` and the **per-user** thresholds to `updateRunState`/`isMastered`.
- [x] Confirm no T3 value is served under `user` and no T1 value is hard-coded on the transition.

**Acceptance Criteria**:

- [x] `answer.ts` resolves `streakThresholds` from the current user's stored preset via `IUserConfigStore` (not from a module constant); a test with an **injected** second bundle (`DIFFICULTY_PRESETS.intense`, `correctStreakThreshold:1`) shows the transition uses per-user thresholds (masters in one correct) while `masteryThreshold`/`maxMastery` stay fixed.
- [x] A default user's `/api/answer` transition is byte-identical to today (`normal` == old `LEARNING_CONFIG`); existing `answer` tests pass unchanged.
- [x] `masteryThreshold`/`maxMastery` are single fixed constants; scoring remains direction-blind; existing `answer` tests pass (default user).

---

**Verification (as-built):** `@gll/db` 70 tests pass (rebuilt so `IUserConfigStore`/`SqliteUserConfigStore` surface in `dist`). `apps/server` typecheck clean, **150 tests pass** (142 prior + 6 new GET/PUT config tests + 1 injected-bundle ST06 test + 1 partial-merge). `apps/srs-demo` `vue-tsc` clean, 49 tests pass. `LEARNING_CONFIG`/`USER_PRESENTATION`/`PEDAGOGY_CONFIG` fully retired from `apps/server` (the remaining hits are separate local constants in `apps/cli-demo-db` and `srs-engine-v2/demo`, out of scope).

## 6. Success Criteria

1. `GET /api/user/config` returns `{ user, system }` resolved per current user; `pedagogy` is gone; the client boots unchanged in behaviour.
2. `PUT /api/user/config` validates server-side with zod, rejects T3/unknown/out-of-range writes with 400, and persists valid T1 patches forward-only.
3. The `/api/answer` transition applies per-user `streakThresholds` with a fixed mastery bar — difficulty changes pacing, never the finish line.
4. No config policy or zod schema appears in `@gll/api-contract`; scoring stays direction-blind.
5. No type errors; existing server + client tests pass for the default (`normal`) user.
