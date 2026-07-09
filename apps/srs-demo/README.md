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

1. **Home** — the landing dashboard routes to **Learn** or **Review**. Review is locked until at least one word is mastered, then shows a due-count badge.
2. **Deck Select** (Learn) — pick a Thai vocabulary deck (5 topics loaded from DB)
3. **Quiz** — answer multiple-choice questions per batch (native ↔ English ↔ romanization)
4. **Results** — see per-word mastery after each batch; mastered words retire from the active pool
5. **Shelving** — words with repeated stagnant mastery are temporarily removed from the quiz pool; they are reintroduced on a fresh session
6. **Review** — a pool-global spaced-repetition session over words that are **due**. Due words are shown as ordinary quiz questions (no self-rating prompt); each answer is posted to the server, which maps it to an FSRS rating and advances the card's schedule. Write-on-answer: exiting mid-session keeps every answered card's advance; re-entry reloads only the still-due cards.
7. **Persistence** — word state, shelving, stagnation, and review-card schedules are stored in SQLite via the API server (`.data/srs-demo.db`)

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

### Seeding a due review card (to exercise Review mode)

Review mode only surfaces words whose review card is **due**. Two things to know:

- A card is created **only when a word graduates** (masters) via `POST /api/answer` — `/api/test/seed` seeds `WordState`/shelving but **not** review cards.
- A freshly graduated card's `due` is scheduled **in the future**, so it will not appear in `GET /api/reviews` yet. To review it now, backdate its `due` directly in SQLite.

```bash
# 0. Pick a word UUID from a deck
WORD=$(curl -s http://localhost:6060/api/decks | python3 -c \
  "import sys,json;print(json.load(sys.stdin)['data'][0]['words'][0]['id'])")

# 1. Master it — POST correct answers until it graduates (default threshold: 2).
#    Graduation seeds a Review card server-side.
for i in 1 2 3; do
  curl -s -X POST http://localhost:6060/api/answer \
    -H 'Content-Type: application/json' \
    -d "{\"wordId\":\"$WORD\",\"correct\":true,\"latencyMs\":500}" >/dev/null
done

# 2. Backdate the card's due so it is due now (adjust GLL_DB_PATH if you overrode it).
PAST=$(python3 -c "import datetime;print((datetime.datetime.now(datetime.UTC)-datetime.timedelta(days=1)).isoformat())")
sqlite3 .data/srs-demo.db "UPDATE review_cards SET due='$PAST' WHERE word_id='$WORD';"

# 3. Confirm it is now due, then open Review in the app.
curl -s http://localhost:6060/api/reviews
```

> This backdating step is a manual workaround for the current build; a test-only
> "seed due review card" endpoint is a planned follow-up.

## Other commands

```bash
# Type-check only
pnpm --filter srs-demo typecheck

# Production build
pnpm --filter srs-demo build

# Run E2E tests
pnpm --filter srs-demo e2e
```
