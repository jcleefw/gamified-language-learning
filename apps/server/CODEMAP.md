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

## Routes (`src/routes/`)

| File | Purpose |
|---|---|
| `state.ts` | Health check and root state route. |
| `decks.ts` | GET `/api/decks` — list all decks with metadata (audio URLs, VTT URLs). |
| `answer.ts` | POST `/api/srs/answers` — submit quiz answers, update word state, return updated batch. |
| `shelving.ts` | Shelving utilities and routes for word state transformations. |
| `config.ts` | Configuration routes (e.g., difficulty presets). |
| `curation.ts` | Audio curation routes (upload, import, validate). |
| `reviews.ts` | Review session routes (fetch by difficulty, word lists). |
| `debug.ts` | Debug routes (pool inspection, state snapshots). |
| `test-seed.ts` | Test seeding routes for development. |

## Domain Logic (`src/` subdirectories)

| Directory | Purpose |
|---|---|
| `src/config/` | Configuration: difficulty presets, learning parameters, DB path, config schema validation. |
| `src/identity/` | User identity: current user extraction from request context (Stage 5 placeholder). |
| `src/learning/` | Quiz logic: answer application, state updates (apply-answer.ts). |
| `src/review/` | Review logic: graduation performance, difficulty scoring. |
| `src/replay/` | Session replay: memory store, artifact serialization for debugging. |
| `src/seed/` | Seeding: scenario builder, apply-scenario, seed CLI, run-seed. |
| `src/storage/` | Persistence: audio store (metadata), database connection. |

## Dependencies

| Package | Source | Purpose |
|---|---|---|
| Hono | `hono` | HTTP framework. |
| better-sqlite3 | `better-sqlite3` | SQLite driver for local dev. |
| Drizzle ORM | `drizzle-orm` | Type-safe query builder. |
| @gll/db | `@gll/db` | Database schema and init. |
| @gll/srs-engine-v2 | `@gll/srs-engine-v2` | SRS state machine. |
| @gll/api-contract | `@gll/api-contract` | Type contracts for HTTP API. |
