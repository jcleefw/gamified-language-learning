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

### Named review scenarios (one call — recommended)

`POST /api/test/seed/scenario` builds a complete, correct review state in one call, **auto-resolving
real deck words** so you never hand-author a fixture. It resets the user's state, seeds it, and
returns the words used plus the expected outcome (handy for manual checks and e2e):

```bash
curl -s -X POST http://localhost:6060/api/test/seed/scenario \
  -H 'Content-Type: application/json' -d '{"name":"mastered-fresh","count":3}'
# → { success, data: { scenario, deckId, wordIds, expected: { dueNow, anytime, reviewUnlocked } } }
```

| `name` | Seeds | Verifies |
| --- | --- | --- |
| `mastered-fresh` | N mastered words + review cards at the real FSRS graduation due (future) | "mastered ≠ due today": `dueNow: 0`, `anytime: N`, Review unlocked |
| `mastered-due` | N mastered words + review cards **due now** | all N surface at once (due list is uncapped) |
| `review-only` | review cards **due now**, but **no** mastered word state | Review unlocks from card existence alone (EP39-BUG01 regression) |

Optional body fields: `deckId` (default: first deck), `count` (default 3). Then open Review in the
app, or assert against `GET /api/reviews` / `GET /api/reviews/anytime`.

> **Restart the API server** after pulling these changes so the `/scenario` route is registered.
> Each scenario **resets the demo user's state** (word progress + review cards) before seeding.

#### Manual walkthrough — "I mastered N words, why isn't Review showing them?"

This is expected: FSRS schedules a freshly-graduated word's first review in the **future**, so
"mastered" ≠ "due today". Verify both halves without waiting real days:

```bash
# Part A — just mastered 3 today: nothing due yet, but all 3 are practisable.
curl -s -X POST http://localhost:6060/api/test/seed/scenario \
  -H 'Content-Type: application/json' -d '{"name":"mastered-fresh","count":3}' | python3 -m json.tool
curl -s http://localhost:6060/api/reviews          # → reviews: []   (nothing due yet)
curl -s http://localhost:6060/api/reviews/anytime  # → 3 words
#   UI: Review tab UNLOCKED · Due Review = caught-up · Practice Anytime lists all 3.

# Part B — their due date has arrived: all 3 surface at once (the due list is uncapped).
curl -s -X POST http://localhost:6060/api/test/seed/scenario \
  -H 'Content-Type: application/json' -d '{"name":"mastered-due","count":3}' | python3 -m json.tool
curl -s http://localhost:6060/api/reviews          # → 3 words due
#   UI: Due Review = 3.
```

Use `review-only` to confirm Review unlocks purely from a card's existence (no mastered word state).

### Seeding review cards by hand (low-level)

For custom cases, `/api/test/seed` accepts an optional `reviewCards` fixture field that seeds a
realistic FSRS scheduler state (via `FsrsScheduler.seed`) and sets `due` for you — no need to
graduate a word through `POST /api/answer` or backdate SQLite by hand.

```bash
# 0. Pick a word ID from a deck
WORD=$(curl -s http://localhost:6060/api/decks | python3 -c \
  "import sys,json;print(json.load(sys.stdin)['data'][0]['words'][0]['id'])")

# 1. Seed a due review card directly.
curl -s -X POST http://localhost:6060/api/test/seed \
  -H 'Content-Type: application/json' \
  -d "{\"name\":\"due-review\",\"description\":\"due review card\",\"deckId\":\"deck-eat\",\"wordStates\":[],\"stagnationCounters\":[],\"shelvedWords\":[],\"reviewCards\":[{\"wordId\":\"$WORD\"}]}"

# 2. Confirm it is now due, then open Review in the app.
curl -s http://localhost:6060/api/reviews
```

Each `reviewCards` entry accepts:

- `wordId` (required)
- `performance` — `{ correctStreak, lapses, correctRatio }`, fed into the FSRS seed heuristic
  to control the initial interval; defaults to a "good" graduation (`correctStreak: 2, lapses: 0,
  correctRatio: 1`)
- `dueOffsetMs` — milliseconds from now to set `due`; defaults to `-86400000` (1 day in the past,
  i.e. already due). Pass a positive value to seed a card that is **not** due yet.
- `naturalDue` — `true` keeps the **FSRS graduation interval** (the real due a freshly-mastered word
  gets) instead of overriding it. Use this to reproduce real graduation timing (overrides `dueOffsetMs`).

Note: `reviewCards` inserts directly into `review_cards`, bypassing the graduation path in
`POST /api/answer` — the word does not need a matching `wordStates` entry for this to work.

> **Timing reference.** A "good" graduation schedules the first review ≈3 days out, "easy" ≈8 —
> never immediately. So mastering N words shows **0 due today, 0 tomorrow**, then **all N due together**
> on their due date (the list is uncapped — never "only 1"). The `mastered-fresh` / `mastered-due`
> scenarios above let you observe both states without waiting; for a fully hand-authored equivalent,
> combine `wordStates` (mastery ≥ 2) with `reviewCards` `naturalDue: true` in a `/api/test/seed` call.

## Other commands

```bash
# Type-check only
pnpm --filter srs-demo typecheck

# Production build
pnpm --filter srs-demo build

# Run E2E tests
pnpm --filter srs-demo e2e
```
