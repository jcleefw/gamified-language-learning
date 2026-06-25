# EP31-DS01: SRS Demo Persistent Storage Specification

**Date**: 20260623T230521Z
**Status**: Impl-Complete
**Epic**: [EP31 — SRS Demo: Persistent Storage via DB Layer](../../plans/epics/EP31-srs-demo-persistent-storage.md)

---

## 1. Feature Overview

Replace `apps/srs-demo`'s localStorage snapshot with a SQLite-backed HTTP state layer. `apps/server` (Hono, cleaned up in EP32) is retrofitted with three state routes backed by `@gll/db`'s `SqliteLearningStore`. The Vue app replaces `useSession.ts` with a new `useStore.ts` composable that fetches against those routes via a Vite proxy. Only `RunState` (per-word `WordState`) is persisted — no in-progress session snapshot. Wire types between server and client use `@gll/api-contract` v2.

**Persistence model change**:

| | Before (EP24) | After (EP31) |
|---|---|---|
| Storage | `localStorage` (JSON) | SQLite via Hono API |
| Granularity | Full `AdaptiveSessionState` snapshot | Per-word `WordState` only |
| When written | On batch finish / session start | On every answer (write-on-answer) |
| Resume semantics | Restore full mid-session state | Reload word mastery; start fresh batch |

---

## 2. Core Requirements

| Requirement | Decision | Rationale |
|---|---|---|
| Persistence store | SQLite via `@gll/db` | EP30 DB layer; consistent with `cli-demo-db` |
| Session model | RunState only | Simpler; mid-batch state is ephemeral and short-lived |
| Resume semantics | Keep button; new semantics (fresh batch from saved RunState) | UX continuity; user expects a "continue where I left off" option |
| `deckId` persistence | `localStorage` key `'srs-demo-last-deck'` (UI hint only, not learning data) | DB stores word states only; deckId is ephemeral UI state; cleared on `onClear` |
| DB file location | `.data/srs-demo.db` at repo root | Centralised; easy to gitignore; consistent for future apps |
| HTTP bridge | Retrofit `apps/server` port 6060 | Already a clean Hono skeleton; no new app needed |
| Wire types | `@gll/api-contract` v2 (`WordStatePayload`, `GetStateResponse`, `UpsertWordStateRequest`) | Convention: all HTTP endpoints use api-contract types |
| Client typing | `apps/srs-demo` imports `@gll/api-contract` | Type-safe fetch payloads; consistent with convention |
| Write timing | Per-answer (`POST /api/state/word` in `onAnswered`) | Durable; matches `cli-demo-db` write-on-answer pattern |

---

## 3. Data Structures

```typescript
// @gll/api-contract — already defined in EP32
interface WordStatePayload {
  wordId: string;
  seen: number;
  correct: number;
  mastery: number;
  correctStreak: number;
  wrongStreak: number;
  lapses: number;
}

interface GetStateResponse {
  words: WordStatePayload[];
}

type UpsertWordStateRequest = WordStatePayload;

// useStore.ts — local helper (not exported from api-contract)
// Maps WordStatePayload[] → RunState (Map<string, WordState>)
function toRunState(words: WordStatePayload[]): RunState;
// Maps WordState → WordStatePayload for POST body
function toPayload(ws: WordState): WordStatePayload;
```

**DB path resolution** (`apps/server/src/index.ts`):
```typescript
import path from 'node:path';
// Resolved relative to repo root so the file is stable regardless of CWD
const DB_PATH = path.resolve(import.meta.dirname, '../../../.data/srs-demo.db');
initDb(DB_PATH);
```

---

## 4. User Workflows

```
MOUNT
  └─ GET /api/state
       ├─ words[] non-empty → hasSavedSession = true, hydrate globalRunState
       │    └─ read localStorage['srs-demo-last-deck'] → deckId
       └─ words[] empty    → hasSavedSession = false

SELECT DECK
  └─ initSession(deckId)
       └─ localStorage.setItem('srs-demo-last-deck', deckId)
       └─ initAdaptiveSession(words, CONFIG, recheckIds, globalRunState)
       └─ startBatch()

ON ANSWER
  └─ submitBatchResult → POST /api/state/word (WordStatePayload)
       └─ isBatchDone? → finishBatchAndTransition OR nextQuestion

RESUME (button)
  └─ loadRunState() → hydrate globalRunState → initSession(deckId.value!)
       └─ startBatch() with saved mastery

CLEAR
  └─ DELETE /api/state → 204
       └─ localStorage.removeItem('srs-demo-last-deck')
       └─ globalRunState = new Map(), hasSavedSession = false, screen = 'select'
```

---

## 5. Stories

### Phase 1: Server — DB Wiring (EP31-PH01)

### EP31-ST01: Add `@gll/db` to `apps/server` and wire `initDb`

**Scope**: Wire `@gll/db` into `apps/server`; DB initialises on startup; server still boots cleanly.

**Read List**:
- `apps/server/src/index.ts`
- `apps/server/package.json`
- `packages/db/src/index.ts` (exports: `initDb`, `getDb`, `closeDb`, `SqliteLearningStore`)

**Tasks**:
- [x] Add `@gll/db` to `apps/server/package.json` dependencies
- [x] In `apps/server/src/index.ts`, import `initDb` from `@gll/db` and call `initDb(DB_PATH)` before `serve()`
- [x] Resolve `DB_PATH` to `path.resolve(import.meta.dirname, '../../../.data/srs-demo.db')`
- [x] Add `.data/` to root `.gitignore`
- [x] Change port in `apps/server/src/index.ts` from `3000` to `6060`
- [x] Run `pnpm --filter apps/server dev` — confirm server starts on port 6060, DB file created at `.data/srs-demo.db`

**Acceptance Criteria**:
- [x] `apps/server` starts without errors
- [x] `.data/srs-demo.db` is created on first run
- [x] `.data/` is gitignored

---

### EP31-ST02: State routes (`GET /api/state`, `POST /api/state/word`, `DELETE /api/state`)

**Scope**: Implement three state routes in `apps/server`; use `SqliteLearningStore`; use `@gll/api-contract` v2 wire types.

**Read List**:
- `apps/server/src/app.ts`
- `packages/api-contract/src/srs.ts` (`WordStatePayload`, `GetStateResponse`, `UpsertWordStateRequest`)
- `packages/api-contract/src/errors.ts` (`ApiResponse<T>`)
- `packages/db/src/index.ts` (`SqliteLearningStore`, `getDb`)
- `apps/cli-demo-db/src/index.ts` (reference: how `SqliteLearningStore` is used)

**Tasks**:
- [x] Create `apps/server/src/routes/state.ts`
  - `GET /api/state` → `SqliteLearningStore.getAll('demo-user')` → `ApiResponse<GetStateResponse>`
  - `POST /api/state/word` → parse `UpsertWordStateRequest` body → `SqliteLearningStore.upsertWordState('demo-user', ws)` → `ApiResponse<WordStatePayload>`
  - `DELETE /api/state` → `SqliteLearningStore.clearUser('demo-user')` → `204`
- [x] Mount routes in `apps/server/src/app.ts` under `/api`
- [x] `pnpm --filter apps/server typecheck` passes

**Acceptance Criteria**:
- [x] `GET /api/state` returns `{ success: true, data: { words: [] } }` on empty DB
- [x] `POST /api/state/word` upserts and returns the word state
- [x] `DELETE /api/state` returns 204; subsequent GET returns empty words
- [x] All routes return `ApiResponse<T>` envelope on success
- [x] Error cases return `ApiResponse<never>` with appropriate `ErrorCode`

---

### Phase 2: Vue App Integration (EP31-PH02)

### EP31-ST03: `useStore.ts` composable

**Scope**: New composable replacing `useSession.ts`; HTTP fetch against `/api` routes; typed with `@gll/api-contract`.

**Read List**:
- `apps/srs-demo/src/composables/useSession.ts` (to replace)
- `packages/api-contract/src/srs.ts`
- `packages/srs-engine-v2/src/index.ts` (for `RunState`, `WordState` types)

**Tasks**:
- [x] Create `apps/srs-demo/src/composables/useStore.ts`
  - `loadRunState(): Promise<RunState>` — `GET /api/state`, map `WordStatePayload[]` → `Map<string, WordState>`
  - `saveWordState(ws: WordState): Promise<void>` — `POST /api/state/word`
  - `clearStore(): Promise<void>` — `DELETE /api/state`
- [x] Add `@gll/api-contract` to `apps/srs-demo/package.json` dependencies
- [x] `vue-tsc --noEmit` passes

**Acceptance Criteria**:
- [x] `loadRunState()` returns an empty `Map` when DB has no words
- [x] `saveWordState()` sends correct `WordStatePayload` body
- [x] `clearStore()` sends `DELETE /api/state`
- [x] All three functions handle non-ok HTTP responses by throwing

---

### EP31-ST04: Wire `App.vue` to `useStore.ts`

**Scope**: Replace all localStorage session calls in `App.vue`; update `DeckSelector` resume semantics; delete `useSession.ts`.

**Read List**:
- `apps/srs-demo/src/App.vue`
- `apps/srs-demo/src/components/DeckSelector.vue`
- `apps/srs-demo/src/composables/useStore.ts` (from ST03)

**Tasks**:
- [x] In `onMounted`: call `loadRunState()`, hydrate `globalRunState`; set `hasSavedSession = words.size > 0`; read `deckId` from `localStorage.getItem('srs-demo-last-deck')`
- [x] In `initSession`: call `localStorage.setItem('srs-demo-last-deck', id)` when a deck is selected
- [x] In `onAnswered`: after each `submitBatchResult`, call `saveWordState` for every word result that has a `wordId`
- [x] In `onClear`: call `clearStore()`; call `localStorage.removeItem('srs-demo-last-deck')`
- [x] In `onResume`: call `loadRunState()`, hydrate `globalRunState`, then call `initSession(deckId.value!)`
- [x] Remove all imports of `saveSession`, `loadSession`, `clearSession`
- [x] Delete `apps/srs-demo/src/composables/useSession.ts`

**Acceptance Criteria**:
- [x] No `localStorage` calls remain in `srs-demo` except the single `'srs-demo-last-deck'` key
- [x] `useSession.ts` does not exist
- [x] Answering a question triggers `POST /api/state/word` (visible in network tab or server logs)
- [x] Clear triggers `DELETE /api/state` and removes `'srs-demo-last-deck'`; refresh shows empty deck selector
- [x] Resume banner appears after refresh if DB has word states and `'srs-demo-last-deck'` is set

---

### EP31-ST05: Vite proxy + dev launch script

**Scope**: Wire Vite proxy so `/api` requests from the dev SPA hit `apps/server:6060`; add a single `dev:all` launch script.

**Read List**:
- `apps/srs-demo/vite.config.ts`
- `apps/srs-demo/package.json`

**Tasks**:
- [x] Add `server.proxy` to `apps/srs-demo/vite.config.ts`:
  ```ts
  server: {
    proxy: {
      '/api': 'http://localhost:6060',
    },
  }
  ```
- [x] Add `concurrently` (or verify it exists) to `apps/srs-demo/package.json` devDependencies
- [x] Add `dev:all` script: `"concurrently \"pnpm --filter apps/server dev\" \"vite\""`

**Acceptance Criteria**:
- [x] `pnpm dev:all` from `apps/srs-demo` starts both servers
- [x] Browser requests to `/api/state` are proxied to `http://localhost:6060/api/state`
- [x] No CORS errors in browser console

---

## 6. Success Criteria

1. Starting a quiz session and answering questions persists word states across full browser refresh (no localStorage)
2. "Clear session" deletes all DB word states; the deck selector shows no saved session on next load
3. Mid-session answer writes are durable: killing the browser mid-batch does not lose answered words
4. `pnpm dev:all` from `apps/srs-demo` starts both Vite and `apps/server`
5. `vue-tsc --noEmit` passes with no new TypeScript errors
6. `useSession.ts` is fully removed; no `localStorage` calls remain in srs-demo (except optional `lastDeckId` key)
7. `pnpm --filter @gll/srs-engine-v2 test` — v2 engine unit tests unaffected
