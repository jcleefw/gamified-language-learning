# EP12-ST02: Middleware Stack

**Created**: 20260312T000000Z
**Epic**: [EP12 - `apps/server` — Hono Server Scaffold](.agents/plans/epics/EP12-hono-server-scaffold.md)
**Status**: Complete ✅

## Summary

Added three middleware layers to the Hono app: CORS (`hono/cors`, permissive for Stage 1), auth passthrough (reads `Authorization` header, sets `userId = null`), and a global error handler (`app.onError`) that returns the `ApiResponse<never>` envelope from `@gll/api-contract`. Middleware registered in order: CORS → auth passthrough → routes, with `onError` as the top-level handler. Error handler extracted as a named export so tests can compose a local Hono instance without coupling to the production app.

## Files Modified

### apps/server/src/app.ts
- Added `cors()` middleware via `hono/cors` registered on `*`.
- Added auth passthrough middleware: reads `Authorization` header, sets `c.set('userId', null)`, calls `next()`.
- Added `errorHandler` named export: catches `Error`, returns `ApiResponse<never>` with `ErrorCode.INTERNAL_ERROR`.
- Registered `app.onError(errorHandler)`.
- Added `@gll/api-contract` import for `ErrorCode` and `ApiResponse`.

### apps/server/package.json
- Added `"@gll/api-contract": "workspace:*"` to `dependencies`.

### apps/server/src/__tests__/errorHandler.test.ts
- New file. Smoke test using a local `Hono` instance (not the production app) with a throwing route. Asserts response is `500` with `{ success: false, error: { code: "INTERNAL_ERROR", message: "..." } }`.

## Behavior Preserved / New Behavior

- CORS headers returned on all responses; does not reject any origin (Stage 1 permissive config)
- Requests without `Authorization` header pass through (no rejection)
- Unhandled errors return `{ success: false, error: { code: "INTERNAL_ERROR", message } }` with HTTP 500
- `GET /health` still returns `200 { status: "ok" }` (health test remains green)
- `pnpm typecheck` passes for `@gll/server`

## Next Steps

- EP13: SRS routes + in-memory state store
