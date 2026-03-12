# apps/server/src/routes CODEMAP

Purpose: Hono route handlers for SRS HTTP endpoints.

## Files

| File | Purpose |
|---|---|
| `srs.ts` | SRS route handlers. Currently: `POST /batch`. Exports a `Hono` sub-app mounted at `/api/srs` in `app.ts`. |

## Routes

| Method | Path | Handler file | Description |
|---|---|---|---|
| POST | `/api/srs/batch` | `srs.ts` | Validates `deckId`, composes a batch via `SrsEngine`, maps to wire types, registers in batch registry, returns `ApiResponse<BatchPayload>`. |
