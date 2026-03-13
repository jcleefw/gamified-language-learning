# EP12-ST01: Package Scaffold + Health Route + wrangler.toml

**Created**: 20260312T000000Z
**Epic**: [EP12 - `apps/server` — Hono Server Scaffold](.agents/plans/epics/EP12-hono-server-scaffold.md)
**Status**: Complete ✅

## Summary

Created `apps/server/` as a new pnpm workspace package (`@gll/server`). Scaffolded the Hono 4 app with a `GET /health` route, split into `src/app.ts` (pure Hono app, exported for tests and Workers runtime) and `src/index.ts` (starts `@hono/node-server` for local dev). Added `wrangler.toml` with name and entry point. Added `dev:server` script to monorepo root.

## Files Modified

### apps/server/package.json
- New file. `name: "@gll/server"`, `type: "module"`, scripts: `dev` / `build` / `typecheck` / `lint` / `test`. Deps: `hono@^4`, `@hono/node-server@^1`. DevDeps: `typescript`, `tsx`, `vitest`.

### apps/server/tsconfig.json
- New file. Extends `../../tsconfig.base.json` with `outDir: dist`, `rootDir: src`.

### apps/server/src/app.ts
- New file. `Hono<{ Variables }>` instance. `GET /health` returns `200 { status: "ok" }`. Exported as default.

### apps/server/src/index.ts
- New file. Starts `@hono/node-server` on port 3000. Re-exports app default for Workers runtime.

### apps/server/wrangler.toml
- New file. `name = "gll-server"`, `main = "src/index.ts"`, `compatibility_date = "2024-01-01"`.

### apps/server/src/__tests__/health.test.ts
- New file. Vitest smoke test — `app.request('/health')` asserts `200` + `{ status: "ok" }`.

### apps/server/CODEMAP.md
- New file. Documents package files, middleware, and routes.

### package.json (root)
- Added `"dev:server": "pnpm --filter @gll/server dev"` script.

## Behavior Preserved / New Behavior

- `GET /health` returns `200 { status: "ok" }`
- `pnpm dev` from `apps/server/` starts server via `tsx watch src/index.ts`
- `pnpm dev:server` from monorepo root starts the server
- `wrangler.toml` declares `name` and `main` for future `wrangler deploy`
- `pnpm typecheck` passes for `@gll/server`

## Next Steps

- EP12-ST02: Add CORS, auth passthrough, and global error handler middleware
