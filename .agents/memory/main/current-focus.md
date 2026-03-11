# EP12 Current Focus

**Branch**: feat/EP12
**Epic**: EP12 - `apps/server` — Hono Server Scaffold
**Status**: impl-complete

## Completed

- ST01: `apps/server/` scaffolded — `@gll/server`, health route, `wrangler.toml`, CODEMAP
- ST02: Middleware stack — CORS, auth passthrough, global error handler using `@gll/api-contract`

## Commits

- `4679194` feat(EP12-ST01): scaffold @gll/server with Hono app and health route
- `55b06d8` feat(EP12-ST02): add CORS, auth passthrough, and global error handler middleware

## Key Decisions

- `src/app.ts` exports pure Hono app (imported by tests); `src/index.ts` starts `@hono/node-server` for local dev
- `errorHandler` exported as named function — tests compose a local Hono instance rather than adding a test route to the production app
- Middleware inline in `app.ts` (each ≤5 lines, no abstraction needed)

## Next Steps

- PR for feat/EP12 → main
- EP13: SRS routes + in-memory state store
