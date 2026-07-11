# EP41-DS01: Identity Seam & Preference Storage Foundation Specification

**Date**: 20260711T011809Z
**Status**: Accepted
**Epic**: [EP41 - Per-User Config Preference Tier (T1)](../../plans/EP41-config-preference-tier.md)

**Architecture**:
[Config Ownership — Two-Tier Model](../../../product-documentation/architecture/20260711T004050Z-engineering-config-ownership-two-tier.md) — **D4**, Accepted. This DS delivers the **foundation half** of EP41: the single current-user resolver (ST01), the per-user config store (ST02), and the server-owned difficulty-preset map (ST03). It builds the storage and policy substrate but changes **no HTTP behaviour** — the `GET`/`PUT /api/config` surface and the T3 tier-reclassification are deferred to **DS02**. It consumes the tier classification (T1 vs T3) from the ADR as-is; it does not re-decide which knob lives where.

> **Amendment (20260711, as-built).** Per-user config is stored as a **JSON blob on the identity row (`users.config`)**, not a standalone `user_config` table. Rationale: the field set is tiny and closed (3 prefs) and this keeps the change minimal; the trade-off accepted is that storage can no longer *enforce* the preset-name-only invariant — that guard **moves entirely to DS02's `PUT` write path (zod)**. The `IUserConfigStore` port (`get`/`put`) is unchanged; only the physical storage differs. Two consequences carried into DS02: (a) `put` targets an existing `users` row (writing config for a non-existent user is a silent no-op); (b) `put` is a whole-blob read-modify-write (lost-update risk under concurrent writers — moot while single-user). See §3 and the Consequences note below.

---

## 1. Feature Overview

Today every server route that needs the learner's identity declares its own `const USER_ID = 'demo-user'` — five production copies ([`answer.ts:17`](../../../apps/server/src/routes/answer.ts#L17), [`shelving.ts:17`](../../../apps/server/src/routes/shelving.ts#L17), [`state.ts:6`](../../../apps/server/src/routes/state.ts#L6), [`reviews.ts:21`](../../../apps/server/src/routes/reviews.ts#L21), [`seed/cli.ts:8`](../../../apps/server/src/seed/cli.ts#L8), plus the test-only [`routes/test-seed.ts:15`](../../../apps/server/src/routes/test-seed.ts#L15)). The `users` row already exists — [`seedDemoUser`](../../../apps/server/src/seed/seed-db.ts#L19) inserts `demo-user` — so identity is *persisted* but not *resolved through one place*. There is also no per-user config: `LEARNING_CONFIG` / `USER_PRESENTATION` in [`config/learning.ts`](../../../apps/server/src/config/learning.ts) are module constants, identical for everyone, with no override storage.

This DS lays the substrate the T1 tier stands on, in three independent layers:

- **Identity seam (ST01)** — one `getCurrentUserId()` resolver, imported everywhere the constant was inlined. Behaviour-preserving (it returns `'demo-user'` today); it is the single seam real auth replaces later. No route changes what it does — only where the id comes from.
- **Preference store (ST02)** — a `config` JSON blob column on the existing `users` row, behind an `IUserConfigStore` port (`get`/`put`) with a `SqliteUserConfigStore` implementation. Stores the **selected preset name** + standalone T1 prefs. A user whose `config` is `NULL` (or lacks a given key) resolves to "no overrides". `put` is a read-modify-write merge over the blob.
- **Difficulty-preset map (ST03)** — a server-only, in-code map from preset name (`gentle`/`normal`/`intense`) to a validated `StreakThresholds` bundle. The name is the unit of persistence and API exchange; the bundle never leaves the server. This is the T1 "difficulty" knob, expressed as forgiveness/pacing, not as a raw integer the user types.

**The invariant this DS supports (enforced downstream).** Difficulty is exchanged and stored as a **preset name**, never a `correctStreakThreshold` value; an unknown name has no bundle (`resolvePreset` throws, `isDifficultyPreset` is false). With the as-built blob storage this is *supported* but not *enforced at rest* — a raw write to the blob is physically possible — so the name-only guard lives at **DS02's `PUT` write path** (zod: `.strict()` + preset enum derived from `DIFFICULTY_PRESETS`). ST03's guards (`isDifficultyPreset`/`resolvePreset`) are the substrate that guard consumes.

**What is reused, not built:**

- **`users` table + `seedDemoUser`** — identity is already seeded ([`seed-db.ts:19`](../../../apps/server/src/seed/seed-db.ts#L19)); ST01 consolidates *readers*, it does not add the seed.
- **`@gll/db` store pattern** — `types/I*Store.ts` port → `Sqlite*Store` impl → barrel export, exactly as `SqliteLearningStore` etc. `SqliteUserConfigStore` is a new instance of this shape (over a `users` column rather than its own table), not a new pattern. **`users` table + `seedDemoUser`** are reused — the blob is a new nullable column on the existing row.
- **`StreakThresholds`** from `@gll/srs-engine-v2` — the preset bundle *is* this existing type; no new engine type.

**Not in this DS**: `GET /api/config` override resolution, `PUT /api/config` + zod validation, dropping the `pedagogy` key, the read-only `system` section, and moving T3 knobs to fixed constants — all **DS02**. No route reads the `users.config` blob yet; this DS only makes it exist and be writable through the store.

---

## 2. Core Requirements

| Requirement | Decision | Rationale |
| --- | --- | --- |
| Current-user resolution | One `getCurrentUserId()` helper; all five production sites import it | Single seam for real auth later; removes drift risk across duplicated constants |
| Resolver behaviour now | Returns the seeded `'demo-user'` id (no request/session lookup yet) | Behaviour-preserving; identity is single-user by ADR scope, auth is out of scope |
| Preference storage shape | `config` JSON blob column on the `users` row (as-built); `IUserConfigStore` port over it | Tiny, closed pref set (3 fields); avoids a separate table. Trade-off: name-only guard moves to the DS02 write path |
| Difficulty persistence unit | **Preset name string**, never raw streak integers | Bounded/validated choice; raw values stay server-side and stay comparable |
| Standalone prefs stored | `wordsPerBatch` (int), `sentenceDirections` (string[]) — all inside the blob | The two genuine T1 prefs that are not part of the difficulty bundle |
| Missing config | `NULL` blob (or a missing key inside it) ⟺ "no overrides"; `get` returns `null`, never fabricates defaults | Defaults are the server's T3/base concern (DS02 resolve step), not the store's |
| Preset → bundle map location | Server-only module in `apps/server`; not in `@gll/api-contract`, not in `@gll/db` | Config *policy* is server-owned (ADR D2/D4); the name is the only shared token |
| Preset map contents | `gentle` / `normal` / `intense` → `StreakThresholds` (`correctStreakThreshold`, `wrongStreakThreshold`, `maxMastery`) | Difficulty = streak forgiveness + pacing; `maxMastery` stays the fixed T3 value in every preset |
| `maxMastery` across presets | Identical in all three presets (the fixed T3 scale) | ADR: mastery bar is fixed & comparable; presets tune forgiveness, never the finish line |

## 3. Data Structures

```typescript
// --- ST01: identity seam (apps/server/src/identity/current-user.ts) ---
/** The single current-user resolver. Returns the seeded demo user today;
 *  the seam real auth (request/session lookup) replaces later. */
export function getCurrentUserId(/* future: ctx */): string {
  return DEMO_USER_ID; // 'demo-user'
}

// --- ST03: difficulty presets (apps/server/src/config/difficulty-presets.ts) ---
import type { StreakThresholds } from '@gll/srs-engine-v2';

// The full three names are RESERVED now; only `normal` ships a bundle this epic.
// `gentle`/`intense` are named but their threshold values are DEFERRED to a
// later story — the type carries them so the shape is stable, the map does not.
export type DifficultyPreset = 'gentle' | 'normal' | 'intense';

/** Server-only. The name is the persisted/exchanged token; the bundle never
 *  leaves the server. `maxMastery` is the fixed T3 scale. Only `normal` is
 *  populated (== today's config); `gentle`/`intense` land in a follow-up. */
export const DIFFICULTY_PRESETS: Partial<Record<DifficultyPreset, StreakThresholds>> = {
  normal: { correctStreakThreshold: 2, wrongStreakThreshold: 2, maxMastery: 2 }, // == today's LEARNING_CONFIG
  // gentle:  DEFERRED — values TBD (more correct-in-a-row to graduate, forgiving on misses)
  // intense: DEFERRED — values TBD (graduate fast, punish misses)
};

export const DEFAULT_PRESET: DifficultyPreset = 'normal';
/** True only for a preset that currently HAS a bundle (⟺ selectable). Drives the
 *  write-path enum so `gentle`/`intense` are rejected until their bundles land. */
export function isDifficultyPreset(x: unknown): x is DifficultyPreset; // ⟺ x in DIFFICULTY_PRESETS
export function resolvePreset(name: DifficultyPreset): StreakThresholds; // throws if deferred/unknown

// --- ST02: user config store (as-built) ---
// schema (packages/db/src/schema.ts) — a nullable JSON blob on the identity row.
// Migration 0011: `ALTER TABLE users ADD COLUMN config TEXT`.
export interface UserConfigJson {
  difficultyPreset?: string | null;   // preset NAME (validated by the DS02 write path, not here)
  wordsPerBatch?: number | null;
  sentenceDirections?: string[] | null;
}
export const users = sqliteTable('users', {
  // ...existing id/email/role/created_at...
  config: text('config', { mode: 'json' }).$type<UserConfigJson>(), // NULL ⟺ no overrides
});

// port (packages/db/src/types/user-config-store.ts)
// NOTE: difficultyPreset is typed `string | null` here, NOT `DifficultyPreset`.
// @gll/db must not depend on apps/server (ADR D2/D4: the name is the only shared
// token; the preset map never enters @gll/db). The server narrows the string via
// `isDifficultyPreset` at the read path.
export interface UserConfigRecord {
  difficultyPreset: string | null;
  wordsPerBatch: number | null;
  sentenceDirections: string[] | null;
}
export interface IUserConfigStore {
  /** null ⟺ user's `config` blob is NULL / user absent (⟺ no overrides). */
  get(userId: string): Promise<UserConfigRecord | null>;
  /** Read-modify-write merge over `users.config`; only provided keys change.
   *  Targets an existing user row — a no-op if the user does not exist. */
  put(userId: string, patch: Partial<UserConfigRecord>): Promise<void>;
}
```

> **Only `normal` ships this epic** — pinned to today's `LEARNING_CONFIG.streakThresholds`, so the default user sees zero behaviour change. `gentle`/`intense` are reserved names with **deferred values**: a later story fills their bundles and flips them selectable. Until then only `normal` validates on the write path. The *shape* (name→`StreakThresholds`, fixed `maxMastery`) is fixed by the ADR.

## 4. User Workflows

```
# ST01 — identity resolution (internal, no user-visible change)
route handler → getCurrentUserId() → 'demo-user' → (existing store calls, unchanged)

# ST02/ST03 — preference lifecycle (store-level only in this DS; wired in DS02)
store.get(userId) → null (no row)            → caller treats as "no overrides"
store.put(userId, { difficultyPreset:'intense' }) → upsert row
store.get(userId) → { difficultyPreset:'intense', wordsPerBatch:null, ... }
resolvePreset('intense') → { correctStreakThreshold:1, wrongStreakThreshold:3, maxMastery:2 }
```

## 5. Stories

### Phase 1: Identity foundation (EP41-PH01)

### EP41-ST01: Current-user resolver seam

**Scope**: One server-side identity helper; consolidate five inlined constants onto it. No behaviour change.
**Read List**: `apps/server/src/routes/answer.ts`, `apps/server/src/routes/shelving.ts`, `apps/server/src/routes/state.ts`, `apps/server/src/routes/reviews.ts`, `apps/server/src/routes/test-seed.ts`, `apps/server/src/seed/cli.ts`, `apps/server/src/seed/seed-db.ts`
**Tasks**:

- [ ] Add `apps/server/src/identity/current-user.ts` exporting `DEMO_USER_ID` and `getCurrentUserId()`.
- [ ] Replace each `const USER_ID = 'demo-user'` with an import of `getCurrentUserId()` (or `DEMO_USER_ID` where a literal seed value is needed, e.g. `seed-db.ts`/`cli.ts`).
- [ ] Leave `__tests__` literals as-is (they assert against the seeded id).

**Acceptance Criteria**:

- [ ] No production file under `apps/server/src` declares `const USER_ID = 'demo-user'`; all resolve via the helper.
- [ ] `getCurrentUserId()` returns `'demo-user'`; existing route/seed behaviour is byte-identical (existing tests pass unchanged).

### Phase 2: Preference storage (EP41-PH02)

### EP41-ST02: `users.config` blob & store

**Scope**: `@gll/db` — a nullable `config` JSON column on `users`, plus port and Sqlite implementation; barrel-exported. No route wiring. *(As-built: blob-on-`users`, not a standalone table — see the Amendment.)*
**Read List**: `packages/db/src/schema.ts`, `packages/db/src/index.ts`, `packages/db/src/sqlite-learning-store.ts`, `packages/db/src/types/learning-store.ts`, `packages/db/src/init-db.ts`
**Tasks**:

- [x] Add the `config` JSON column to the `users` table in `schema.ts` (nullable; `UserConfigJson` `$type`); hand-write migration `0011_user_config.sql` (`ALTER TABLE users ADD COLUMN config TEXT`).
- [x] Add `types/user-config-store.ts` (`UserConfigRecord` with `difficultyPreset: string | null`, `IUserConfigStore`).
- [x] Add `SqliteUserConfigStore` (`get` → `null` when `config` NULL / user absent; `put` read-modify-write merge over the blob).
- [x] Export port / impl from `index.ts`; ensure `initDb` applies the migration.

**Acceptance Criteria**:

- [x] `get` returns `null` for a user with no config (and for an absent user), and the persisted record after a `put`.
- [x] `put` is a partial merge — writing only `difficultyPreset` leaves other fields in the blob untouched.
- [x] `sentenceDirections` round-trips as a JSON array; unit tests cover get/put/partial-merge/null-field.

### EP41-ST03: Difficulty-preset map

**Scope**: `apps/server` — server-only name→`StreakThresholds` map + guards. No persistence, no routes.
**Read List**: `apps/server/src/config/learning.ts`, `packages/srs-engine-v2/src/types/word-state.ts` (for `StreakThresholds`)
**Tasks**:

- [ ] Add `apps/server/src/config/difficulty-presets.ts` (`DifficultyPreset` type with all three names; `DIFFICULTY_PRESETS` populated with `normal` only; `DEFAULT_PRESET`; `isDifficultyPreset`; `resolvePreset`).
- [ ] Set `normal` equal to today's `LEARNING_CONFIG.streakThresholds`. Leave `gentle`/`intense` unpopulated (deferred) — do not invent values.

**Acceptance Criteria**:

- [ ] `resolvePreset('normal')` deep-equals the current `LEARNING_CONFIG.streakThresholds` (no behaviour change for the default user).
- [ ] `isDifficultyPreset` is true for `normal` only (⟺ present in `DIFFICULTY_PRESETS`); `gentle`/`intense`/unknown all return false until their bundles land; `resolvePreset` on a deferred/unknown name throws.
- [ ] The map/type never appears in `@gll/api-contract` or `@gll/db`.

## 6. Success Criteria

1. Identity resolves through one seam; the five duplicated constants are gone; all existing tests pass unchanged.
2. The `users.config` blob exists, round-trips preset-name + standalone prefs via the store, and returns `null` for users with no overrides.
3. The preset map lives server-side, keeps `normal` == today's config, and holds `maxMastery` fixed across presets.
4. No config policy leaks into `@gll/api-contract`; no route behaviour changes (deferred to DS02).
5. No type errors.

## 7. Consequences of the blob-on-`users` storage (carry into DS02)

The as-built decision to store config as a JSON blob on `users.config` (rather than a dedicated `user_config` table) has three downstream consequences DS02 must account for:

1. **Name-only invariant is enforced only at the write path.** Storage cannot reject a raw `correctStreakThreshold` written into the blob. DS02's `PUT /api/config` zod schema (`.strict()` + preset enum from `DIFFICULTY_PRESETS`, no T3 keys) is therefore the **sole** guard — it is not a defence-in-depth layer over a storage constraint, it is *the* constraint. Treat it as load-bearing.
2. **`put` requires an existing `users` row.** Config lives on the identity row, so `put` is an `UPDATE ... WHERE id = userId` — a **silent no-op** for a non-existent user. Fine today (the demo user is always seeded via `seedDemoUser`); revisit when real signup/auth lands so a config write for a not-yet-persisted user can't be silently dropped.
3. **`put` is a whole-blob read-modify-write.** Concurrent writers to *different* fields can lose-update (last writer wins the whole blob). Not a live risk while single-user; note it for the multi-user path (a per-field `UPDATE ... json_set`, row lock, or a return to a columnar table would remove it).

**Verification (as-built):** `@gll/db` typecheck clean, 70 tests pass; `apps/server` typecheck clean, 142 tests pass unchanged.
