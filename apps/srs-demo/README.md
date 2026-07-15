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

### Named review scenarios (recommended) — `pnpm seed`

Named scenarios build a complete, correct review state in one shot, **auto-resolving real deck
words** so you never hand-author a fixture. The scenario catalogue (FSRS composition included) is
shared by a CLI and an HTTP endpoint — use whichever fits.

**Two-terminal manual-test loop (no curl):**

```bash
# Terminal 1 — app + server (holds .data/srs-demo.db)
pnpm --filter @gll/srs-demo dev:all

# Terminal 2 — seed a state, then reload the browser
pnpm --filter @gll/server seed mastered-due --count 3
pnpm --filter @gll/server seed --list          # show all scenarios
pnpm --filter @gll/server seed relapsed-due --dry-run   # inspect, write nothing
```

The CLI runs in-process and defaults to the **same DB path the server uses** (`GLL_DB_PATH` → else
`.data/srs-demo.db`), so a seed is visible on the next request — **just reload the browser, no server
restart**.

| `name` | Seeds | Verifies |
| --- | --- | --- |
| `mastered-fresh` | N mastered words + cards at the natural FSRS graduation due (future) | "mastered ≠ due today": `dueNow: 0`, `anytime: N`, Review unlocked |
| `mastered-due` | N mastered words + cards **due now** | all N surface at once (due list is uncapped) |
| `review-only` | cards **due now**, but **no** mastered word state | Review unlocks from card existence alone (EP39-BUG01 regression) |
| `relapsed-due` | graduate → review → **lapse** → relearn over ~3 weeks, now due | multi-day history as an engine-computed snapshot; `dueNow: N` |
| `mature-interval` | several good reviews → long interval, **not** due | learned-but-not-due: `dueNow: 0`, practisable via anytime |

Flags: `--count N` (default 3), `--deck <deckId>` (default: first deck), `--dry-run`, `--list`.

**Caveats (2-terminal loop):**

1. **Same DB path** — the CLI defaults to the server's; only override `GLL_DB_PATH` if the server has it too, or you'll seed a DB nobody reads.
2. **Reload to refresh** — seeding changes the DB; the already-rendered app re-fetches on reload.
3. **Config overrides are HTTP-only** — shelving/sentence config lives in the running server's memory, so use the HTTP endpoint (below) for those, not the CLI.

**HTTP endpoint (e2e / config-override cases):** `POST /api/test/seed/scenario` takes the same
`{ name, deckId?, count? }` and returns `{ scenario, deckId, wordIds, expected }`:

```bash
curl -s -X POST http://localhost:6060/api/test/seed/scenario \
  -H 'Content-Type: application/json' -d '{"name":"mastered-fresh","count":3}'
```

> Each scenario **resets the demo user's state** (word progress + review cards) before seeding.

#### Why "mastered N words" isn't immediately due

FSRS schedules a freshly-graduated word's first review in the **future**, so "mastered" ≠ "due
today". `mastered-fresh` reproduces this (nothing due, all N practisable via anytime); `mastered-due`
places them due now; `relapsed-due`/`mature-interval` reproduce real multi-day histories without
waiting real days. Assert against `GET /api/reviews` (due) and `GET /api/reviews/anytime` (all
learned).

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

## Routing architecture

Vue Router 4 owns URL-to-screen mapping. App.vue is a layout shell (nav + `<RouterView />`); it holds no screen-selection state.

| Path | Route name | View |
| --- | --- | --- |
| `/` | `home` | `HomePage.vue` |
| `/learn/select` | `select` | `DeckSelectPage.vue` |
| `/learn/quiz/:deckId` | `quiz` | `QuizPage.vue` |
| `/learn/results` | `results` | `ResultsPage.vue` |
| `/learn/overview/:deckId` | `overview` | `OverviewPage.vue` |
| `/review` | `review-hub` | `ReviewHubPage.vue` |
| `/review/session` | `review` | `ReviewSessionPage.vue` (`?mode=due\|anytime`) |
| `/curation` | `curation` | `CurationLandingPage.vue` |
| `/curation/curate` | `curate` | `CurateAudioPage.vue` |
| `/curation/mark` | `mark` | `MarkAudioPage.vue` |

Route names are centralized in `src/routeNames.ts` (`ROUTE_NAMES`) so `router.ts` and `router-guards.ts` can both reference them without an import cycle. Every route is lazy-loaded (`() => import('./views/...')`) for per-page code-splitting.

### Adding a route

1. Add a name to `ROUTE_NAMES` in `src/routeNames.ts`.
2. Add a `RouteRecordRaw` entry in `src/router.ts` with a lazy `component` import.
3. Create the view under `src/views/`, forwarding to the existing screen component via composable `inject()` (see any existing view for the pattern).
4. If the route needs a guard condition (curation-only, mid-quiz confirmation, etc.), extend `src/router-guards.ts` rather than adding logic inline in the view.

### Where session state lives

Routes carry no session state in params beyond identifiers (`:deckId`, `?mode=`). Learning/review progress lives in composables (`useLearningSession()`, `useReviewSession()`, `useDebugRecording()`), instantiated once and shared via `provide`/`inject` from `App.vue` — this is why views `inject()` composable state rather than re-calling the composable, and why navigating between routes never loses in-progress quiz/review state.

### Navigation guards

`src/router-guards.ts` registers a single `router.beforeEach` that: redirects `curationOnly` routes to `/` when `env.curationMode` is off, confirms before leaving a quiz mid-batch (flushing the batch first), and finalizes any active debug recording on cross-phase navigation. Internal navigations triggered by composables (not the nav menu) call `markInternalNavigation()` first to skip the guard — see the comments in that file for why.

See the [Vue Router docs](https://router.vuejs.org/) for guard/lazy-loading patterns beyond what's used here.

> Individual page/component refactoring (the screens themselves) is out of scope for this routing epic — see EP45+.

## Other commands

```bash
# Type-check only
pnpm --filter srs-demo typecheck

# Production build
pnpm --filter srs-demo build

# Run E2E tests
pnpm --filter srs-demo e2e
```
