# EP12 - `apps/server` — Hono Server Scaffold

**Created**: 20260311T000000Z
**Status**: Draft

<!-- Status: Draft | Accepted | In Progress | Impl-Complete | BDD Pending | Completed | Shelved | Withdrawn -->

**Type**: Epic Plan
**Depends on**: EP11
**Parallel with**: N/A
**Predecessor**: N/A

---

## Problem Statement

The SRS engine is complete and tested in isolation. To expose it over HTTP we need a Hono server application. Before any SRS routes can be built (EP13), the server must exist with its foundational plumbing in place: package setup, a health route to confirm the server runs, the middleware stack (CORS, error handler, auth passthrough), and a minimal Cloudflare Workers config file so deployment wiring is not a rework task later.

## Scope

**In scope**:

- `apps/server/` — new Hono application with package name `@gll/server`
- `package.json` with Hono 4 + `@hono/node-server` for local dev; `tsx` as local runner
- `tsconfig.json` extending `tsconfig.base.json`
- `GET /health` route returning `{ status: "ok" }`
- Middleware stack: CORS, global error handler (maps errors to `ApiError` envelope from `@gll/api-contract`), auth passthrough (accepts `Authorization: Bearer <token>` but does not validate)
- Minimal `wrangler.toml` — declares app name and entry point; not wired into local dev loop
- `pnpm dev` script using `tsx watch` for local development

**Out of scope**:

- SRS routes — EP13
- In-memory state store — EP13
- `wrangler dev` local dev integration — deferred (not wired in Stage 2)
- Auth enforcement — Stage 5
- Tests beyond health route smoke test

---

## Stories

### EP12-ST01: Package scaffold + health route + `wrangler.toml`

**Scope**: Create `apps/server/` with `package.json` (`name: "@gll/server"`), `tsconfig.json`, `src/index.ts` entry point, Hono app instance, `GET /health` route returning `200 { status: "ok" }`, `pnpm dev` script via `tsx watch src/index.ts`, and a minimal `wrangler.toml` (name, main entry — no routes or bindings). Verify server starts and `/health` returns 200 locally.

### EP12-ST02: Middleware stack

**Scope**: Add CORS middleware (permissive config for local dev), global error handler middleware that catches thrown errors and returns the `ApiError` response envelope from `@gll/api-contract`, and auth passthrough middleware that reads the `Authorization` header and attaches a stub context value without validating. All middleware registered before route handlers. Verify error handler returns correct envelope shape for a thrown error.

---

## Overall Acceptance Criteria

- [ ] `apps/server/` exists with `package.json` declaring `name: "@gll/server"`
- [ ] `GET /health` returns `200` with `{ status: "ok" }`
- [ ] `pnpm dev` from `apps/server/` starts the server locally via `tsx watch`
- [ ] Global error handler returns `ApiError` envelope shape on unhandled errors
- [ ] CORS middleware is registered
- [ ] Auth passthrough middleware is registered and does not reject requests without a token
- [ ] `wrangler.toml` exists with app name and entry point declared
- [ ] `pnpm typecheck` passes for `apps/server`

---

## Dependencies

- EP11 — `@gll/api-contract` (error envelope types used by error handler middleware)
- EP01 — monorepo scaffold (`tsconfig.base.json`, Turborepo config)

## Next Steps

1. Review and approve plan
2. Implement ST01 (scaffold + health route) → ST02 (middleware stack)
3. EP13 and EP14 can begin once EP12 is complete
