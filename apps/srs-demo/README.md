# srs-demo

A Vue 3 webapp that runs the `@gll/srs-engine-v2` spaced-repetition quiz loop in the browser, backed by a persistent SQLite database via the `@gll/server` API.

## Quick start

From the **monorepo root**:

```bash
# 1. Install dependencies (if not already done)
pnpm install

# 2. Build the engine (required before first run)
pnpm --filter @gll/srs-engine-v2 build

# 3. Start both the API server and the dev server
pnpm --filter srs-demo dev:all
```

- App: [http://localhost:5173](http://localhost:5173)
- API server: [http://localhost:6060](http://localhost:6060)

> To run the app alone (no API): `pnpm --filter srs-demo dev`

## What it does

1. **Deck Select** — pick a Thai vocabulary deck (eating or weather)
2. **Quiz** — answer up to 8 multiple-choice questions per batch (native ↔ English ↔ romanization)
3. **Results** — see per-word mastery after each batch; mastered words retire from the active pool
4. **Shelving** — words with repeated stagnant mastery are temporarily removed from the quiz pool; they are reintroduced on a fresh session
5. **Persistence** — word state, shelving, and stagnation data are stored in SQLite via the API server (`.data/srs-demo.db`)

## Manual testing (EP26 shelving)

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
# See currently shelved words for a deck
curl "http://localhost:6060/api/shelving?deckId=deck-eat"

# See stagnant words at a given threshold
curl "http://localhost:6060/api/stagnation/stagnant?deckId=deck-eat&threshold=1"

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
