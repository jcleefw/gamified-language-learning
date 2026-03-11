# EP12-DS01: Hono Server Scaffold Specification

**Date**: 20260312T000000Z
**Status**: Draft
**Epic**: [EP12 - `apps/server` — Hono Server Scaffold](.agents/plans/epics/EP12-hono-server-scaffold.md)

---

## 1. Feature Overview

Create `apps/server/` — a new Hono 4 application (`@gll/server`) within the existing Turborepo/pnpm monorepo. The app exposes a single `GET /health` route, registers a three-layer middleware stack (CORS → auth passthrough → global error handler), and ships a minimal `wrangler.toml` for future Cloudflare Workers deployment. Local development uses `tsx watch`. The server consumes `@gll/api-contract` for the error envelope type only; no business logic lives here yet.

---

## 2. Core Requirements

| Requirement | Decision | Rationale |
| --- | --- | --- |
| HTTP framework | Hono 4 | Cloudflare Workers-native, first-class TypeScript, used in EP plan |
| Local runner | `tsx watch src/index.ts` via `pnpm dev` | No build step for dev; matches existing package patterns |
| Node.js adapter | `@hono/node-server` | Required to run Hono locally outside Workers runtime |
| Error envelope | `ApiError` / `ApiResponse` from `@gll/api-contract` | Single source of truth for HTTP error shape across the stack |
| CORS config | Permissive (`origin: '*'`) for Stage 1 | Tightened in Stage 5 when auth is enforced |
| Auth passthrough | Read `Authorization` header → attach stub `ctx.set('userId', null)` | Satisfies middleware slot; no validation until Stage 5 |
| `wrangler.toml` | Name + entry only; no routes/bindings | Avoids blocking deployment wiring without making `wrangler dev` the local loop |
| TypeScript config | `tsconfig.json` extending `../../tsconfig.base.json` | Monorepo consistency |
| pnpm workspace | `apps/server` auto-picked up by `apps/*` glob in `pnpm-workspace.yaml` | No workspace config change needed |

---

## 3. Data Structures

```typescript
// Re-used from @gll/api-contract — not redefined here

import type { ApiError, ApiResponse } from '@gll/api-contract';

// Error response shape returned by global error handler
// { success: false, error: { code: ErrorCode, message: string } }

// Hono context variable type (stub for auth passthrough)
type Variables = {
  userId: string | null;
};

// Health route response
type HealthResponse = {
  status: 'ok';
};
```

---

## 4. User Workflows

```
pnpm dev (apps/server)
  └─ tsx watch src/index.ts
       └─ Hono app starts on port 3000

Incoming request
  → CORS middleware (sets headers)
  → Auth passthrough (reads Authorization header, sets ctx userId = null)
  → Route handler  ──▶  GET /health → 200 { status: "ok" }
                    │
                    └─▶  (future routes — EP13)
  → [on thrown Error]
  → Global error handler → 500 ApiResponse<never> { success: false, error: { code, message } }
```

---

## 5. Stories

### EP12-ST01: Package scaffold + health route + `wrangler.toml`

**Scope**: Stand up `apps/server/` with all config files, a running Hono app, and the health route.

**Read List**:
- `tsconfig.base.json`
- `packages/srs-engine/package.json` (pattern reference)
- `pnpm-workspace.yaml`
- `turbo.json`

**Tasks**:

- [ ] Create `apps/server/package.json` — name `@gll/server`, `"type": "module"`, scripts `dev` / `build` / `typecheck` / `lint`, dependencies `hono@^4` + `@hono/node-server`, devDependencies `typescript` + `tsx`
- [ ] Create `apps/server/tsconfig.json` extending `../../tsconfig.base.json` with `"outDir": "dist"` and `"rootDir": "src"`
- [ ] Create `apps/server/src/index.ts` — instantiate `Hono<{ Variables }>`, register `GET /health`, start server via `@hono/node-server` on port 3000
- [ ] Create `apps/server/wrangler.toml` — declare `name = "gll-server"`, `main = "src/index.ts"`, `compatibility_date`
- [ ] Add `"dev:server": "pnpm --filter @gll/server dev"` to root `package.json` scripts
- [ ] Run `pnpm install` from monorepo root to link workspace deps
- [ ] Verify `pnpm dev:server` from monorepo root starts without errors and `curl localhost:3000/health` returns `{"status":"ok"}`

**Acceptance Criteria**:

- [ ] `apps/server/package.json` exists with `name: "@gll/server"`
- [ ] `GET /health` returns HTTP 200 with body `{ "status": "ok" }`
- [ ] `pnpm dev` from `apps/server/` starts via `tsx watch`
- [ ] `pnpm dev:server` from monorepo root starts the server
- [ ] `wrangler.toml` exists with `name` and `main` fields
- [ ] `pnpm typecheck` passes for `apps/server`

---

### EP12-ST02: Middleware stack

**Scope**: Add CORS, auth passthrough, and global error handler middleware to the Hono app.

**Read List**:
- `apps/server/src/index.ts` (from ST01)
- `packages/api-contract/src/errors.ts`
- `packages/api-contract/src/index.ts`

**Tasks**:

- [ ] Add `@gll/api-contract` as a workspace dependency in `apps/server/package.json`
- [ ] Add CORS middleware using `hono/cors` — `origin: '*'`, permissive methods/headers
- [ ] Add auth passthrough middleware — read `c.req.header('Authorization')`, call `c.set('userId', null)`, call `next()`
- [ ] Add global error handler using `app.onError` — catch any thrown error, return `ApiResponse` with `success: false`, `error: { code: ErrorCode.INTERNAL_ERROR, message: err.message }`
- [ ] Register middleware in order: CORS → auth passthrough before routes; `onError` as top-level handler
- [ ] Write a smoke test: throw a deliberate error from a test route, assert response matches `ApiError` envelope shape

**Acceptance Criteria**:

- [ ] CORS middleware is registered; `OPTIONS` preflight returns `200` with CORS headers
- [ ] Auth passthrough does not reject requests missing an `Authorization` header
- [ ] Global error handler returns `{ success: false, error: { code: "INTERNAL_ERROR", message: "..." } }` on unhandled errors
- [ ] Middleware order: CORS → auth passthrough → routes (verified by reading `src/index.ts`)
- [ ] `pnpm typecheck` passes for `apps/server`

---

## 6. Success Criteria

1. `apps/server/` exists as a valid pnpm workspace package named `@gll/server`
2. `GET /health` returns `200 { status: "ok" }` when server starts locally
3. Global error handler returns the `ApiError` envelope shape (`ApiResponse<never>`) for unhandled errors
4. CORS and auth passthrough middleware are registered and do not block normal requests
5. `wrangler.toml` declares `name` and `main` — ready for future `wrangler deploy`
6. `pnpm typecheck` passes with no errors
