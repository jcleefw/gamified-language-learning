# EP37-DS05: Learning-Policy Single Source (server-served config) Specification

**Date**: 20260709T085655Z
**Status**: Accepted — implemented (ST10 + ST11), **amended 20260709 (see Amendment 1)**
**Epic**: [EP37 - Refactor: Learning Authority](../../plans/epics/EP37-refactor-learning-authority.md)

---

## Amendment 1 (20260709) — Scope is the **whole** config surface, categorized user vs system

**Decision (supersedes the "learning-policy only" scope below).** The single-source rule applies to **all** config, not just learning policy. This was **missed scope of ST10 and ST11**, corrected here in line with the [Config Ownership & Layering ADR, Amendment 1](../../../product-documentation/architecture/20260709T091559Z-engineering-config-ownership-and-layering.md) (framing is **system vs user**, not server vs client; **all config is server-sourced**; the FE declares none). What this changes vs the body:

- **ST10 serves the FE surface, categorized by who may change it.** `GET /api/config` returns `{ user, pedagogy }`, not just `{ masteryThreshold, streakThresholds }`. `user` (T1, eventually user-writable): `masteryThreshold`, `streakThresholds`, `wordsPerBatch`, `maxRetryPerSession`, `maxRetryPerWord`, `sentenceDirections`. `pedagogy` (T2 authored course design, read-only to the client): `sentenceScheduling`, `sentenceGraduation`. **T3 system internals** (FSRS params, seed heuristics, `maxMastery`-as-scale) are **never served** (ADR D4). Declared server-side in `apps/server/src/config/learning.ts`; **still nothing in `@gll/api-contract`.**
- **ST11 removes ALL FE-declared config.** `PRESENTATION_DEFAULTS` is **deleted** from `App.vue` (not just the four policy values). `CONFIG` starts empty and is fully populated from the fetch (`{ ...cfg.user, ...cfg.pedagogy }`). The boot fetch helper is `loadConfig()` (was `loadLearningConfig()`), returning the categorized `AppConfig`; the gate ref is `configReady` (was `policyReady`). Fail-closed is unchanged.
- **Interim on accounts.** No user accounts yet, so `user` config is hardcoded in the server config module and served read-only; the per-user DB row + `PUT` write path arrive with accounts. The `user`/`pedagogy` split in the wire shape records the future writable boundary now (user → per-user write path; pedagogy → per-deck authoring).

**Retained from the body:** server is the single source; `@gll/api-contract` carries no config value or type; the client consumes read-only and holds no fallback; fail-closed boot. Where the body says "learning policy," read "the whole config surface."

---

**Architecture**:
[`srs-demo` Learning Authority, Review Authority & Debug-Trace Contract](../../../product-documentation/architecture/20260708T125551Z-engineering-srs-demo-learning-authority-and-debug-trace.md) — Pillar 1 (Learning authority). Completes the cutover landed in [DS04](20260708T222525Z-EP37-DS04-client-cutover-rollout-gate.md): DS04 moved the **transition** to the server but left the **policy values** (`masteryThreshold` + `streakThresholds`) mirrored on the client and held in parity by manual verification. DS05 removes the mirror so the server is the **literal single source**, consumed read-only by any UI.

---

## 1. Feature Overview

Today the four learning-policy values live in **two** places: server [`LEARNING_CONFIG`](../../../apps/server/src/config/learning.ts) and the hardcoded client [`CONFIG`](../../../apps/srs-demo/src/App.vue) ref. DS04's amendment kept them in sync **by manual parity check**, not by a shared constant — a standing drift risk, and the one thing blocking "reuse this server from a second UI" (a future mobile/CLI client would carry its own copy and diverge per client).

DS05 makes the **server the single source of truth** for learning policy and has the client **consume it at runtime**:

- Add a read-only **`GET /api/config`** that serves the server's `LEARNING_CONFIG` learning policy (`masteryThreshold`, `streakThresholds`).
- `srs-demo` **deletes** the four hardcoded learning-policy values from its `CONFIG` ref and **fetches** them at boot, merging them over its client-owned presentation config.
- **Fail-closed**: if the policy can't be fetched, the client surfaces the existing `apiError` and does not start a session — it must never fall back to a hardcoded copy (that would reintroduce the second source).

**Why the client still needs the values at all (two reasons, both satisfied by fetching):**

1. **Display** — `isMastered(...)` filtering for `masteredDeck`/`masteredGlobal`/`recalculateCompletedDecks`, and the `max-mastery` progress-bar prop, all read `masteryThreshold`/`streakThresholds.maxMastery`.
2. **Local orchestration parity** — the client still runs `initAdaptiveSession`/`advanceAdaptiveSession` **client-side** on its locally-computed runState (DS04 scope: orchestration stays client-side, proven byte-equal to the server). That local fold consumes the **same** `masteryThreshold`/`streakThresholds`; if they differ from the server's, the client's local runState diverges from the authoritative one. Fetching the exact server values makes this parity **by construction** instead of by manual check.

**The "chicken-and-egg" is only apparent.** The client needs policy to render mastery UI *and* to run its local fold; the server needs it to compute the authoritative transition. It is **not** a cycle: the server's policy depends on nothing client-side, so the resolution is a strict one-writer / many-read-only-consumers order — server owns and serves, client fetches at boot before any session init. This is **config distribution**, not shared ownership.

**Governance line (important).** The epic rule "**no learning config in `@gll/api-contract`**" (Epic §Out-of-scope; DS01) forbids the client **carrying/versioning** policy — i.e. baking the numbers into a shipped client or into the contract, **as either constants or types**. A read-only endpoint is the **opposite**: the client holds no copy and cannot pin a version; the server can change a threshold with no client redeploy. DS05 keeps the policy fully server-owned: **nothing** — neither values nor a response type — is added to `@gll/api-contract`. The response **shape** is declared **server-side** (in the server's config module); the client types the fetch result with a **local** interface built from `StreakThresholds` (already imported from `@gll/srs-engine-v2`), so it consumes the data without the contract package carrying any learning-policy surface. DS05 therefore honours the rule while dissolving the duplication it was meant to prevent.

**Forward-compatibility (per-user).** `GET /api/config` is deliberately shaped as *"the policy this request should use,"* not *"the global singleton."* Today it serves the global `LEARNING_CONFIG`; a future per-user epic swaps the source behind it for a per-user resolver (defaults ← overrides) with **no change to the client consumption model or the endpoint contract**. The client must not bake in a "this is a process-wide constant" assumption. See the [Config Ownership & Layering ADR](../../../product-documentation/architecture/20260709T091559Z-engineering-config-ownership-and-layering.md) (this DS realises its server-owned learning-policy source; DS05 is correct and unconditional under every decision in that ADR).

**Not in this DS**: per-user or per-deck policy (values stay a single global constant; the endpoint shape leaves room for it later); moving any **presentation/orchestration** config (`wordsPerBatch`, `maxRetryPerWord`/`maxRetryPerSession`, `sentenceScheduling`, `sentenceGraduation`, `sentenceDirections`) — those are legitimately per-UI and **stay client-side**; the `/test/config/*` override endpoints (unchanged).

---

## 2. Core Requirements

| Requirement | Decision | Rationale |
| --- | --- | --- |
| Single source of truth | Server `LEARNING_CONFIG` ([learning.ts](../../../apps/server/src/config/learning.ts)) is the **only** declaration of `masteryThreshold` + `streakThresholds`; the client keeps **no** copy | Removes the drift risk DS04 held together by manual parity; the actual goal ("one location, not two") |
| Serve policy read-only | Add `GET /api/config` returning `{ masteryThreshold, streakThresholds }` from `LEARNING_CONFIG` | Distribution, not ownership: one writer, many read-only consumers (incl. future UIs) |
| Policy stays server-side | The response **type** is declared in the **server** config module — **nothing** (value or type) is added to `@gll/api-contract`; the client types the result with a **local** interface using `StreakThresholds` from `@gll/srs-engine-v2` | The epic rule bans learning-policy **surface** in the contract, not just values; keeping the type server-side upholds it strictly |
| Client consumes, never declares | `srs-demo` deletes `masteryThreshold` + `streakThresholds` from its hardcoded `CONFIG`; fetches them at boot and merges over the client-owned presentation defaults | The client "renders UI and sends raw answers; must not carry/version learning policy" (Epic rule) — fetching ≠ carrying |
| Fetch ordering | Fetch `GET /api/config` in `onMounted` **before** any `initSession`/`startBatch`; policy is a boot precondition | The local orchestration fold and mastery UI both need policy before a session exists; resolves the apparent chicken-and-egg by ordering |
| Fail-closed, no fallback | On fetch failure, set the existing `apiError` and do **not** start a session; **no** hardcoded default policy | A fallback constant *is* a second source — the exact thing being removed; failing closed keeps parity absolute |
| Presentation config stays client-side | `wordsPerBatch`, `maxRetryPerWord`, `maxRetryPerSession`, `sentenceScheduling`, `sentenceGraduation`, `sentenceDirections` remain in the client `CONFIG` ref | These are per-UI UX/pacing, not persisted-state policy; a different UI may legitimately differ or omit them |
| Parity burden retired | The DS04 "manual parity between `LEARNING_CONFIG` and client `CONFIG`" obligation is **eliminated** (nothing left to mirror) | Parity is now by construction (single value, fetched), not by verification |

## 3. Data Structures

**`@gll/api-contract` — NO change.** No learning-policy value or type is added to the contract package. (`ApiResponse<T>` already exists there as the generic envelope and is reused as-is.)

**Server — response type declared server-side (config module), served from the existing constant:**

```typescript
// apps/server/src/config/learning.ts (or a sibling in apps/server/src/routes/config.ts)
import type { StreakThresholds } from '@gll/srs-engine-v2';

/** Wire shape for GET /api/config. Declared server-side on purpose: learning
 *  policy is server-owned and must not surface in @gll/api-contract. */
export interface LearningConfigResponse {
  masteryThreshold: number;
  streakThresholds: StreakThresholds;
}

// apps/server/src/routes/config.ts
router.get('/config', (c) => {
  const body: ApiResponse<LearningConfigResponse> = {
    success: true,
    data: {
      masteryThreshold: LEARNING_CONFIG.masteryThreshold,
      streakThresholds: LEARNING_CONFIG.streakThresholds,
    },
  };
  return c.json(body);
});
```

**Client — types the fetch result with a LOCAL interface (no contract import for policy):**

```typescript
// apps/srs-demo/src/composables/useStore.ts
import type { StreakThresholds } from '@gll/srs-engine-v2'; // already a dependency

// Local consuming shape — the client owns how it reads the server's policy;
// it does NOT import a policy type from @gll/api-contract (none exists there).
interface LearningPolicy {
  masteryThreshold: number;
  streakThresholds: StreakThresholds;
}

export async function loadLearningConfig(): Promise<LearningPolicy> {
  const res = await fetch('/api/config');
  if (!res.ok) throw new Error(`GET /api/config failed: ${res.status}`);
  const body = (await res.json()) as ApiResponse<LearningPolicy>;
  if (!body.success) throw new Error(`GET /api/config error: ${body.error.message}`);
  return body.data;
}
```

**Client — `CONFIG` loses the four policy fields; they arrive from the server at boot:**

```typescript
// apps/srs-demo/src/App.vue — presentation/orchestration defaults only.
// masteryThreshold + streakThresholds are NO LONGER declared here.
const CONFIG = ref<ConfigType>({
  wordsPerBatch: 3,
  maxRetryPerSession: 5,
  maxRetryPerWord: 2,
  sentenceScheduling: { minSeenForSentence: 1, sentenceBatchGap: 2 },
  sentenceGraduation: { sentenceCorrectStreakThreshold: 2, sentenceWrongStreakThreshold: 3 },
  sentenceDirections: ['english-to-native', 'romanization-to-native', 'native-to-romanization'],
  // masteryThreshold / streakThresholds injected at boot from GET /api/config
} as ConfigType);

// onMounted, before any session init:
const policy = await loadLearningConfig();      // new useStore helper; throws on failure
CONFIG.value = { ...CONFIG.value, ...policy };  // merge server policy over client presentation config
```

> **Note — typing.** `ConfigType` currently extends `SessionConfig` (which includes `masteryThreshold`/`streakThresholds`). To make "declared-in-client" a **compile-time** guarantee, the implementer confirms which fields `SessionConfig` owns and either (a) constructs the initial ref as a presentation-only partial that is completed at boot, or (b) keeps the type intact but treats the policy fields as boot-required. The AC below asserts the runtime behaviour; the typing choice is left to the implementer as long as no hardcoded threshold literal remains in `App.vue`.

## 4. User Workflows

```
App boot (onMounted)
  → GET /api/decks            (unchanged)
  → GET /api/config           (NEW)  ── the single source of learning policy
       success → CONFIG = { ...presentationDefaults, ...policy }
       failure → apiError set; DO NOT init a session (fail-closed, no fallback)
  → GET /api/state            (unchanged)
  → load shelving / sentence override (unchanged)
  → recalculateCompletedDecks (now uses the fetched masteryThreshold)

Session start (initSession / startBatch)
  → precondition: CONFIG carries server policy (else boot already failed closed)
  → initAdaptiveSession(words, CONFIG.value, …)   // local fold uses the SAME thresholds the server uses
  → … answers replay through POST /api/answer (DS04, unchanged) …
  → advanceAdaptiveSession(sessionState, output, CONFIG.value)  // byte-equal to server by construction
```

## 5. Stories

### Phase 5: Learning-policy single source (EP37-PH05)

### EP37-ST10: `GET /api/config` serves learning policy

**Scope**: One read-only server route + a server-side response type. No client changes; **no `@gll/api-contract` change**.
**Read List**: `apps/server/src/config/learning.ts`, `apps/server/src/routes/answer.ts` (ApiResponse pattern), `apps/server/src/routes/decks.ts` (route/registration pattern), `apps/server/src/index.ts` (or wherever routers mount)
**Tasks**:

- [ ] Declare the `LearningConfigResponse` type **server-side** (in `apps/server/src/config/learning.ts` or the new route module); do **not** touch `@gll/api-contract`
- [ ] Add `apps/server/src/routes/config.ts` with `GET /api/config` returning `LEARNING_CONFIG.{masteryThreshold, streakThresholds}` wrapped in the reused `ApiResponse` envelope
- [ ] Mount the new router alongside the existing ones (same prefix convention as `/api/answer`, `/api/decks`)

**Acceptance Criteria**:

- [ ] `GET /api/config` returns `{ success: true, data: { masteryThreshold, streakThresholds } }` whose values deep-equal the server's `LEARNING_CONFIG`
- [ ] The response is derived from `LEARNING_CONFIG` at request time (changing the constant changes the response with no other edit)
- [ ] `@gll/api-contract` is **unchanged** — no learning-policy value or type is added to it
- [ ] No change to `/api/answer`, `/api/state`, `/api/decks`, or `/test/config/*`

### EP37-ST11: `srs-demo` consumes policy from the server (drop the mirror)

**Scope**: Remove the hardcoded learning-policy values from the client; fetch and merge them at boot; fail-closed.
**Read List**: `apps/srs-demo/src/App.vue` (`CONFIG` ref, `onMounted`, `initSession`, `startBatch`, `recalculateCompletedDecks`, `masteredDeck`/`masteredGlobal`), `apps/srs-demo/src/composables/useStore.ts`, `apps/server/src/routes/config.ts` (ST10 output — the served shape), `packages/srs-engine-v2` (`SessionConfig`, `StreakThresholds`, `isMastered`)
**Tasks**:

- [ ] Add `loadLearningConfig(): Promise<LearningPolicy>` to `useStore.ts` with a **local** `LearningPolicy` shape (built from `StreakThresholds`, no `@gll/api-contract` policy import); GET `/api/config`; throw a typed error on non-ok / `success:false`, mirroring `loadRunState`
- [ ] Delete `masteryThreshold` and `streakThresholds` literals from the `App.vue` `CONFIG` ref
- [ ] In `onMounted`, fetch the policy **before** any session init and merge it over the presentation defaults; on failure set `apiError` and return **without** starting a session (no hardcoded fallback)
- [ ] Confirm every reader (`isMastered(...)` call sites, `:max-mastery` props, `initAdaptiveSession`/`advanceAdaptiveSession`, `getNewlyMasteredIds`) reads the merged `CONFIG` and that no threshold literal remains in `App.vue`

**Acceptance Criteria**:

- [ ] With the server up, boot fetches policy from `/api/config`; mastery UI and completed-deck detection behave exactly as before the change (same thresholds → same output)
- [ ] The client source contains **no** hardcoded `masteryThreshold`/`streakThresholds` value; grepping `App.vue` for the literals returns nothing
- [ ] With `/api/config` failing, `apiError` is shown and **no** session starts (fail-closed); the app does not fall back to a built-in policy
- [ ] The client's local `advanceAdaptiveSession` fold uses the fetched thresholds, so its local `runState` still matches the server's authoritative `WordState` (DS04 parity preserved by construction)
- [ ] No type errors; presentation config (`wordsPerBatch`, retries, sentence*) is unchanged and still client-side

## 6. Success Criteria

1. Learning policy (`masteryThreshold` + `streakThresholds`) is declared in exactly **one** place — server `LEARNING_CONFIG` — and served read-only via `GET /api/config`.
2. `srs-demo` carries **no** hardcoded copy of the policy; it fetches at boot and fails closed if the fetch fails (no fallback constant).
3. The DS04 manual-parity obligation between server `LEARNING_CONFIG` and client `CONFIG` is retired; parity is by construction.
4. `@gll/api-contract` is unchanged — no learning-policy value **or type** lives in the contract; the response shape is server-side and the client's consuming shape is local (Epic "no learning config in the contract" rule upheld strictly).
5. Presentation/orchestration config remains client-side and per-UI; a second UI can consume the same server policy without carrying its own copy.
6. No type errors; `/api/answer` and orchestration behaviour are unchanged.
