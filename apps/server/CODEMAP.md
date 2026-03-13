# apps/server CODEMAP

Package: `@gll/server`
Purpose: Hono 4 HTTP server for the GLL API. Runs on Cloudflare Workers (production) and via `@hono/node-server` (local dev).

## Files

| File | Purpose |
|---|---|
| `src/app.ts` | Hono app instance. Registers middleware and routes. Exported for tests and Workers runtime. |
| `src/index.ts` | Local dev entry point. Starts `@hono/node-server` on port 3000. Re-exports app for `wrangler`. |
| `wrangler.toml` | Minimal Cloudflare Workers config — name and entry point only. |
| `tsconfig.json` | TypeScript config extending `tsconfig.base.json`. |
| `package.json` | Package manifest for `@gll/server`. |

## Middleware (registered in `src/app.ts`)

| Middleware | Source | Purpose |
|---|---|---|
| CORS | `hono/cors` | Permissive CORS for local dev (Stage 1). |
| Auth passthrough | inline | Reads `Authorization` header, sets `userId = null`. No validation until Stage 5. |
| Error handler | `app.onError` | Catches thrown errors, returns `ApiResponse<never>` envelope from `@gll/api-contract`. |

## State (`src/state/`)

→ See [src/state/CODEMAP.md](src/state/CODEMAP.md)

## Routes (`src/routes/`)

→ See [src/routes/CODEMAP.md](src/routes/CODEMAP.md)

| Method | Path | Handler |
|---|---|---|
| GET | `/health` | Returns `200 { status: "ok" }` |
| POST | `/api/srs/batch` | `src/routes/srs.ts` — compose and return a quiz batch |
| POST | `/api/srs/answers` | `src/routes/srs.ts` — submit answers and update word state |
