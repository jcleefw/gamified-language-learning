# @gll/server

Hono 4 HTTP server for the GLL API. Owns persisted Learning state, Review
scheduling, and the deck/config surfaces `srs-demo` (and any future client)
consumes. Runs locally via `@hono/node-server`; deployable to Cloudflare
Workers (`wrangler.toml`).

## Quick start

From the **monorepo root**:

```bash
# 1. Install dependencies (if not already done)
pnpm install

# 2. Build the packages this server depends on
pnpm --filter @gll/api-contract build
pnpm --filter @gll/db build
pnpm --filter @gll/srs-engine-v2 build
pnpm --filter @gll/srs-review build
pnpm --filter @gll/srs-shelving build
pnpm --filter @gll/logger build

# 3. Start the server
GLL_SEED_CONTENT=1 pnpm --filter @gll/server dev
```

- API server: [http://localhost:6060](http://localhost:6060)
- Health check: `curl http://localhost:6060/health` → `{"status":"ok"}`

> Subsequent restarts do **not** need `GLL_SEED_CONTENT=1` — the DB already
> has content. Use the flag only on a fresh (empty) DB.

To run the server together with the `srs-demo` frontend, use
`pnpm --filter srs-demo dev:all` instead (see
[apps/srs-demo/README.md](../srs-demo/README.md)).

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `GLL_DB_PATH` | `<repo-root>/.data/srs-demo.db` | SQLite file location |
| `GLL_SEED_CONTENT` | unset | Set to `1` to seed deck content on startup (first run only) |

## Data & config ownership

- **Persisted state** (`WordState`, shelving, stagnation counters, review
  cards, answer/transition events) lives in SQLite via `@gll/db`, accessed
  through store classes (`SqliteLearningStore`, `SqliteReviewStore`, etc.).
- **Learning policy and app config are server-owned**, never carried or
  versioned by a client. `GET /api/config` is the single source of truth,
  categorized by who may change it — see the
  [Config Ownership & Layering ADR](../../product-documentation/architecture/20260709T091559Z-engineering-config-ownership-and-layering.md).
- **The state transition is server-authoritative**: `POST /api/answer` runs
  the pure `@gll/srs-engine-v2` transition and persists the result — clients
  send raw answers and adopt the returned canonical `WordState`. See the
  [Learning Authority ADR](../../product-documentation/architecture/20260708T125551Z-engineering-srs-demo-learning-authority-and-debug-trace.md).

## API routes

All routes are mounted under `/api` (see `src/app.ts`); handlers live in
`src/routes/`.

| Method | Path | File | Purpose |
| --- | --- | --- | --- |
| GET | `/health` | `app.ts` | Liveness check |
| GET | `/api/config` | `config.ts` | Read-only app config (`{ user, pedagogy }`) — learning policy + presentation/orchestration defaults |
| GET | `/api/decks` | `decks.ts` | List all decks |
| POST | `/api/curriculum/import` | `decks.ts` | Import a new deck from `ConversationJSON` |
| GET | `/api/state` | `state.ts` | Get all persisted `WordState` for the demo user |
| POST | `/api/state/word` | `state.ts` | Legacy client-computed state upsert (superseded by `/api/answer`) |
| DELETE | `/api/state` | `state.ts` | Clear all persisted state |
| POST | `/api/answer` | `answer.ts` | Server-authoritative: run the Learning transition for one answer, persist it, seed a Review card on graduation |
| GET | `/api/reviews` | `reviews.ts` | List the user's due review cards, pool-global, most-overdue-first |
| POST | `/api/reviews/answer` | `reviews.ts` | Server-authoritative Review advance: map the answer to an FSRS rating, advance + persist the card, return the new due date |
| GET | `/api/shelving` | `shelving.ts` | List shelved words for a deck |
| POST | `/api/shelving/apply` | `shelving.ts` | Shelve a set of words |
| POST | `/api/shelving/unshelve-all` | `shelving.ts` | Unshelve every word in a deck |
| POST | `/api/shelving/unshelve-word` | `shelving.ts` | Unshelve one word |
| POST | `/api/stagnation/update` | `shelving.ts` | Update stagnation counters for the active pool |
| GET | `/api/stagnation/stagnant` | `shelving.ts` | List words stagnant at a given threshold |
| POST | `/api/stagnation/reset-words` | `shelving.ts` | Reset stagnation counters for specific words |
| POST | `/api/stagnation/reset` | `shelving.ts` | Reset all stagnation counters for a deck |
| POST | `/api/debug-logs` | `debug-logs.ts` | Accept a batch of client debug-log snapshots |
| POST | `/api/test/seed` | `test-seed.ts` | Seed a scripted test scenario directly to the DB |
| POST/DELETE | `/api/test/config/shelving` | `test-seed.ts` | Override/reset shelving config for manual testing |
| GET/POST/DELETE | `/api/test/config/sentence` | `test-seed.ts` | Override/reset sentence config for manual testing |

Every response is wrapped in the `ApiResponse<T>` envelope from
`@gll/api-contract`: `{ success: true, data: T }` or
`{ success: false, error: { code, message } }`.

## Manual API checks

```bash
# App config (learning policy + presentation/pedagogy defaults)
curl http://localhost:6060/api/config

# List decks (with UUID ids)
curl http://localhost:6060/api/decks

# Submit an answer (server runs the transition and returns authoritative state)
curl -X POST http://localhost:6060/api/answer \
  -H 'Content-Type: application/json' \
  -d '{"wordId":"<word-uuid>","correct":true,"latencyMs":1200}'

# Get persisted word state
curl http://localhost:6060/api/state

# Clear all user state
curl -X DELETE http://localhost:6060/api/state
```

## Testing

```bash
pnpm --filter @gll/server test         # run once
pnpm --filter @gll/server test:watch   # watch mode
```

Tests live in `src/__tests__/` and drive the Hono app directly via
`app.request(...)` against an in-memory SQLite DB (see `config.test.ts`,
`answer.test.ts`, `decks.test.ts` for the pattern).

## Other commands

```bash
# Type-check only
pnpm --filter @gll/server typecheck

# Production build (tsc)
pnpm --filter @gll/server build
```

## More detail

See [CODEMAP.md](CODEMAP.md) for the file-by-file breakdown and
`src/routes/CODEMAP.md` / `src/state/CODEMAP.md` for the routing and store
layers in depth.
