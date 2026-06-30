# srs-demo

A Vue 3 webapp that runs the `@gll/srs-engine-v2` spaced-repetition quiz loop in the browser, backed by a persistent SQLite database via the `@gll/server` API.

## Quick start

From the **monorepo root**:

```bash
# 1. Install dependencies (if not already done)
pnpm install

# 2. Build packages (required before first run)
pnpm --filter @gll/api-contract build
pnpm --filter @gll/db build
pnpm --filter @gll/srs-engine-v2 build

# 3. Seed deck content and start everything
GLL_SEED_CONTENT=1 pnpm --filter srs-demo dev:all
```

- App: [http://localhost:5173](http://localhost:5173)
- API server: [http://localhost:6060](http://localhost:6060)

> Subsequent restarts do **not** need `GLL_SEED_CONTENT=1` — the DB already has content. Use the flag only on a fresh (empty) DB.

## Content seeding

Deck content is stored in SQLite and served via `GET /api/decks`. It is **not** auto-seeded — you opt in with the env var:

```bash
# First run / after deleting .data/srs-demo.db
GLL_SEED_CONTENT=1 pnpm --filter @gll/server dev

# Normal run (DB already has content)
pnpm --filter @gll/server dev
```

Source data: `packages/srs-engine-v2/data/samples/conversations-2026-03-08.json` (5 Thai conversation topics).

To add a new deck at runtime (curator upload):

```bash
curl -X POST http://localhost:6060/api/curriculum/import \
  -H 'Content-Type: application/json' \
  -d '{"topic":"My Deck","lines":[...],"breakdown":[...]}'
```

## What it does

1. **Deck Select** — pick a Thai vocabulary deck (5 topics loaded from DB)
2. **Quiz** — answer multiple-choice questions per batch (native ↔ English ↔ romanization)
3. **Results** — see per-word mastery after each batch; mastered words retire from the active pool
4. **Shelving** — words with repeated stagnant mastery are temporarily removed from the quiz pool; they are reintroduced on a fresh session
5. **Persistence** — word state, shelving, and stagnation data are stored in SQLite via the API server (`.data/srs-demo.db`)

## Manual testing

Speed up shelving by lowering the stagnation threshold:

```bash
# Trigger shelving after 1 bad batch instead of 3
curl -X POST http://localhost:6060/api/test/config/shelving \
  -H 'Content-Type: application/json' \
  -d '{"stagnationBatchWindow": 1, "maxShelved": 2}'

# Reset to defaults
curl -X DELETE http://localhost:6060/api/test/config/shelving
```

Useful API checks:

```bash
# List all decks (with UUID ids)
curl http://localhost:6060/api/decks

# See currently shelved words for a deck (use UUID from above)
curl "http://localhost:6060/api/shelving?deckId=<deck-uuid>"

# See stagnant words at a given threshold
curl "http://localhost:6060/api/stagnation/stagnant?deckId=<deck-uuid>&threshold=1"

# Clear all user state
curl -X DELETE http://localhost:6060/api/state
```

Seed a pre-built scenario directly to the DB:

```bash
curl -X POST http://localhost:6060/api/test/seed \
  -H 'Content-Type: application/json' \
  -d @apps/srs-demo/e2e/fixtures/scenarios/stagnant-word-ready-to-shelve.json
```

## Other commands

```bash
# Type-check only
pnpm --filter srs-demo typecheck

# Production build
pnpm --filter srs-demo build

# Run E2E tests
pnpm --filter srs-demo e2e
```
