# EP31 — SRS Demo: Persistent Storage via DB Layer

**Created**: 20260623T143620Z
**Status**: Draft

<!-- Status: Draft | Accepted | In Progress | Impl-Complete | BDD Pending | Completed | Shelved | Withdrawn -->

**Type**: Epic Plan
**Depends on**: EP30 (Impl-Complete)
**Parallel with**: N/A
**Predecessor**: EP24 (Vue SRS Demo App)

---

## Problem Statement

The `srs-demo` Vue app (EP24) persists learning state as a whole-session snapshot in `localStorage`. This means:

1. Clearing the browser wipes all history.
2. The snapshot stores the full `AdaptiveSessionState` (active pool, queue, recheck sets) — not just `RunState` — so mid-session exits corrupt the resumed state if the engine's internals change.
3. The `@gll/db` SQLite layer built in EP30 cannot be imported directly in a Vite browser bundle (`better-sqlite3` is a Node native module).

The goal of EP31 is to replace `localStorage` with the EP30 DB layer by introducing a lightweight local API server that the demo Vue app calls over HTTP. Word states are written on every answer (write-on-answer, same as `cli-demo-db`). The demo app's content (decks, words, sentences) continues to come from its hardcoded `src/data/decks.ts`; no DB content import is needed.

---

## Scope

**In scope**:

- New `apps/srs-demo-server/` Hono + Node app with three endpoints:
  - `GET /state` — returns persisted `RunState` (word states) for the demo user
  - `POST /state/word` — upserts a single `WordState` (write-on-answer)
  - `DELETE /state` — clears all word states (replaces "clear session")
- `srs-demo` Vue app changes:
  - Replace `useSession.ts` (localStorage snapshot) with `useStore.ts` (HTTP fetch against local server)
  - Load `RunState` on mount via `GET /state`; write per-answer via `POST /state/word`
  - Remove `saveSession` / `loadSession` / `clearSession` localStorage calls
  - "Resume session" detection based on non-empty `RunState` returned by `GET /state`
- Vite proxy config so srs-demo dev server forwards `/api/*` to srs-demo-server on a fixed port
- `package.json` dev script in srs-demo to run both servers concurrently (`concurrently` or `turbo dev`)

**Out of scope**:

- Sentence state persistence (no sentence corpus in srs-demo; sentences are only in `cli-demo-db`)
- Content seeding from DB (srs-demo keeps hardcoded `decks.ts`)
- Authentication / multi-user (single hardcoded `demo-user` userId)
- Deploying to Cloudflare Workers / D1 (EP21 or later)
- Wiring the existing `apps/server` (v1 engine) to EP30's DB

---

## Stories

### Phase 1: API Server (EP31-PH01)

### EP31-ST01: `apps/srs-demo-server` scaffold

**Scope**: Create `apps/srs-demo-server/` with `package.json` (Hono + `@hono/node-server` + `@gll/db`), `tsconfig.json`, and `src/index.ts` that boots the server and applies `@gll/db`'s `initDb` on startup.

### EP31-ST02: State routes (`GET /state`, `POST /state/word`, `DELETE /state`)

**Scope**: Implement the three routes using `SqliteLearningStore`; hard-code `userId = 'demo-user'`; return JSON-serialisable `WordState[]` on GET; accept a single `WordState` body on POST; 204 on DELETE.

### Phase 2: Vue App Integration (EP31-PH02)

### EP31-ST03: `useStore.ts` composable — HTTP state persistence

**Scope**: Replace `useSession.ts` with `useStore.ts` that exports `loadRunState(): Promise<RunState>`, `saveWordState(ws: WordState): Promise<void>`, and `clearStore(): Promise<void>` — each making a `fetch` call to `/api/state`.

### EP31-ST04: Wire `App.vue` to `useStore.ts`

**Scope**: On mount call `loadRunState()` to hydrate `globalRunState`; in `onAnswered` call `saveWordState` for each word result after `submitBatchResult`; in `onClear` call `clearStore()`; remove all `saveSession` / `loadSession` / `clearSession` calls.

### EP31-ST05: Vite proxy + dev launch script

**Scope**: Add `server.proxy` config to `vite.config.ts` (`/api` → `http://localhost:3001`); add `dev:all` script to srs-demo's `package.json` that runs `srs-demo-server` and Vite concurrently.

---

## Overall Acceptance Criteria

- [ ] Starting a quiz session and answering questions persists word states across full browser refresh (no localStorage)
- [ ] "Clear session" deletes all DB word states; the deck selector shows no saved session on next load
- [ ] Mid-session answer writes are durable: killing the browser mid-batch does not lose answered words
- [ ] `pnpm dev:all` from `apps/srs-demo` starts both the Vite dev server and srs-demo-server
- [ ] `vue-tsc --noEmit` passes with no new TypeScript errors
- [ ] `useSession.ts` is fully removed; no `localStorage` calls remain in srs-demo

---

## Dependencies

- EP30 — `@gll/db` package with `SqliteLearningStore`, `initDb`, `getDb` (Impl-Complete)
- EP24 — `apps/srs-demo` Vue app baseline

## Next Steps

1. Review and approve plan
2. Create Design Spec (DS01)
3. Begin implementation story by story
