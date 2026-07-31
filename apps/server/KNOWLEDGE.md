---
unit: apps/server
sources: ["EP12-DS01", "EP12-ST01", "EP12-ST02"]
updated: 2026-07-31
---

## http-server

The Hono app registers a three-layer middleware stack in order: CORS (permissive for Stage 1, tightened when auth is enforced), auth passthrough (reads the `Authorization` header and attaches userId to context), and a global error handler that returns standardized API error envelopes. Unhandled errors are caught and converted to HTTP 500 responses with `{ success: false, error: { code: "INTERNAL_ERROR", message } }`.

## package-scaffold

A new pnpm workspace package (`@gll/server`) exists with TypeScript configuration, a Hono 4 app, and a `GET /health` route. The app is split into two files: the pure Hono app instance (exported for tests and Workers runtime) and the Node server entry point (for local development via tsx watch). A Wrangler config file declares the package name and entry point for future Cloudflare Workers deployment. A monorepo root script (`dev:server`) starts the server from anywhere in the repo.
