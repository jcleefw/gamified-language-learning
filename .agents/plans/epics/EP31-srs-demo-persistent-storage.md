# EP31 — SRS Demo: Persistent Storage via DB Layer

**Created**: 20260623T143620Z
**Status**: In Progress

<!-- Status: Draft | Accepted | In Progress | Impl-Complete | BDD Pending | Completed | Shelved | Withdrawn -->

**Type**: Epic Plan
**Depends on**: EP30 (Impl-Complete), EP32 (Impl-Complete)
**Parallel with**: N/A
**Predecessor**: EP24 (Vue SRS Demo App)

---

## Problem Statement

The `srs-demo` Vue app (EP24) persists learning state as a whole-session snapshot in `localStorage`. This means:

1. Clearing the browser wipes all history.
2. The snapshot stores the full `AdaptiveSessionState` (active pool, queue, recheck sets) — not just `RunState` — so mid-session exits corrupt the resumed state if the engine's internals change.
3. The `@gll/db` SQLite layer built in EP30 cannot be imported directly in a Vite browser bundle (`better-sqlite3` is a Node native module).

The goal of EP31 is to replace `localStorage` with the EP30 DB layer by retrofitting `apps/server` (the existing Hono app, cleaned up in EP32) as an HTTP bridge. Word states are written on every answer (write-on-answer, same as `cli-demo-db`). The demo app's content (decks, words, sentences) continues to come from its hardcoded `src/data/decks.ts`; no DB content import is needed.

---

## Scope

**In scope**:

- Retrofit `apps/server` (already a clean Hono skeleton after EP32) with three endpoints:
  - `GET /api/state` — returns persisted `RunState` (word states) for the demo user
  - `POST /api/state/word` — upserts a single `WordState` (write-on-answer)
  - `DELETE /api/state` — clears all word states (replaces "clear session")
- Routes use `@gll/api-contract` v2 wire types (`WordStatePayload`, `GetStateResponse`, `UpsertWordStateRequest`)
- `srs-demo` Vue app changes:
  - Replace `useSession.ts` (localStorage snapshot) with `useStore.ts` (HTTP fetch against local server)
  - Load `RunState` on mount via `GET /api/state`; write per-answer via `POST /api/state/word`
  - Remove `saveSession` / `loadSession` / `clearSession` localStorage calls
  - "Resume session" detection based on non-empty `RunState` returned by `GET /api/state`
- Vite proxy config so srs-demo dev server forwards `/api/*` to `apps/server` on port 3000
- Dev launch script to run both `apps/server` and `apps/srs-demo` concurrently

**Out of scope**:

- Sentence state persistence (no sentence corpus in srs-demo; sentences are only in `cli-demo-db`)
- Content seeding from DB (srs-demo keeps hardcoded `decks.ts`)
- Authentication / multi-user (single hardcoded `demo-user` userId)
- Deploying to Cloudflare Workers / D1 (EP21 or later)

---

## Stories

### Phase 1: Server — DB Wiring (EP31-PH01)

### EP31-ST01: Add `@gll/db` to `apps/server` and wire `initDb`

**Scope**: Add `@gll/db` to `apps/server/package.json` dependencies; call `initDb()` on server startup in `src/index.ts`; ensure the server still starts cleanly (`pnpm --filter apps/server dev`).

### EP31-ST02: State routes (`GET /api/state`, `POST /api/state/word`, `DELETE /api/state`)

**Scope**: Add `src/routes/state.ts` to `apps/server`; implement the three routes using `SqliteLearningStore`; hard-code `userId = 'demo-user'`; use `@gll/api-contract` v2 wire types (`GetStateResponse`, `UpsertWordStateRequest`, `WordStatePayload`) for request/response shapes; mount routes on `app` in `app.ts`.

- `GET /api/state` → `GetStateResponse` (`{ words: WordStatePayload[] }`)
- `POST /api/state/word` → accepts `UpsertWordStateRequest` body; returns `200` with updated `WordStatePayload`
- `DELETE /api/state` → `204 No Content`

### Phase 2: Vue App Integration (EP31-PH02)

### EP31-ST03: `useStore.ts` composable — HTTP state persistence

**Scope**: Create `apps/srs-demo/src/composables/useStore.ts` that exports:
- `loadRunState(): Promise<RunState>` — `GET /api/state`, maps `WordStatePayload[]` to `RunState` (`Map<string, WordState>`)
- `saveWordState(ws: WordState): Promise<void>` — `POST /api/state/word`
- `clearStore(): Promise<void>` — `DELETE /api/state`

Use `@gll/api-contract` types for the fetch payloads. Do not import `@gll/db` here — server-side only.

### EP31-ST04: Wire `App.vue` to `useStore.ts`

**Scope**: On mount call `loadRunState()` to hydrate `globalRunState`; in `onAnswered` call `saveWordState` for each word result after `submitBatchResult`; in `onClear` call `clearStore()`; remove all `saveSession` / `loadSession` / `clearSession` imports and calls; delete `useSession.ts`.

### EP31-ST05: Vite proxy + dev launch script

**Scope**: Add `server.proxy` to `apps/srs-demo/vite.config.ts` (`/api` → `http://localhost:6060`); add `dev:all` script to `apps/srs-demo/package.json` that starts `apps/server` and Vite concurrently.

---

## Overall Acceptance Criteria

- [ ] Starting a quiz session and answering questions persists word states across full browser refresh (no localStorage)
- [ ] "Clear session" deletes all DB word states; the deck selector shows no saved session on next load
- [ ] Mid-session answer writes are durable: killing the browser mid-batch does not lose answered words
- [ ] `pnpm dev:all` from `apps/srs-demo` starts both the Vite dev server and `apps/server`
- [ ] `vue-tsc --noEmit` passes with no new TypeScript errors
- [ ] `useSession.ts` is fully removed; no `localStorage` calls remain in srs-demo
- [ ] `pnpm --filter @gll/srs-demo dev` starts without errors
- [ ] `pnpm --filter @gll/srs-engine-v2 test` passes — v2 engine unit tests unaffected

---

## Dependencies

- EP30 — `@gll/db` package with `SqliteLearningStore`, `initDb`, `getDb` (Impl-Complete)
- EP32 — `apps/server` stripped of v1 code; `@gll/api-contract` rewritten for v2 (Impl-Complete)
- EP24 — `apps/srs-demo` Vue app baseline

## Next Steps

1. Review and approve plan
2. Begin implementation story by story (ST01 → ST05 in order)
