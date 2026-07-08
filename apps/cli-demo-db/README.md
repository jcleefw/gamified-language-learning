# cli-demo-db

A terminal-based SRS quiz runner that exercises the full learning engine against a real SQLite database. Used for development, integration testing, and seeding test scenarios.

## Quick start

From the **monorepo root**:

```bash
pnpm --filter cli-demo-db menu
```

Opens an interactive menu to pick an action (run demo, run review, seed a scenario, clear/reset DB, etc.) without needing to remember individual script names or env vars. `GLL_DB_PATH` still applies if set beforehand; the menu prompts for any other choice (e.g. review mode) it needs.

Or run a specific command directly:

```bash
pnpm --filter cli-demo-db engine:real-db
```

Runs the interactive quiz loop. DB is created automatically at `.data/learning-state.db` (monorepo root) if it doesn't exist.

Override the DB path:

```bash
GLL_DB_PATH=./my-custom.db pnpm --filter cli-demo-db engine:real-db
```

## DB management

```bash
# Seed a starting scenario
pnpm --filter cli-demo-db engine:real-db:seed:baseline        # fresh state, no prior history
pnpm --filter cli-demo-db engine:real-db:seed:mid-session     # words partially learned
pnpm --filter cli-demo-db engine:real-db:seed:sentence-ready  # words seen enough to unlock sentences

# Clear all user state (keeps schema)
pnpm --filter cli-demo-db engine:real-db:clear

# Drop and recreate schema
pnpm --filter cli-demo-db engine:real-db:reset
```

## Learning config

Defaults in `src/config.ts`:

| Setting | Value | Description |
|---|---|---|
| `wordsPerBatch` | 3 | Words per quiz batch |
| `masteryThreshold` | 2 | Mastery level to retire a word |
| `correctStreakThreshold` | 2 | Correct answers in a row to increase mastery |
| `wrongStreakThreshold` | 2 | Wrong answers in a row to decrease mastery |
| `minSeenForSentence` | 2 | Times a word must be seen before sentence questions unlock |

## Review runner

Exercises the SRS review scheduler (`@gll/srs-review`, FSRS) independently of the learning loop.

```bash
# Seed 3 real curriculum words as due-now review cards (run engine:import-curriculum first if empty)
pnpm --filter cli-demo-db engine:review:seed

# Run the review session against due cards
pnpm --filter cli-demo-db engine:review
```

`engine:review` presents each due card as an MCQ, infers a rating from correctness + answer latency (`inferReviewRating` — no manual grading), reschedules via FSRS, and persists on every answer (write-on-answer). Exits immediately with "Nothing due 🎉" if there are no due cards.

Options:

| Env var | Values | Description |
|---|---|---|
| `REVIEW_MODE` | `pool` (default) \| `deck` | `pool` pulls all due cards for the user; `deck` scopes to the CLI's fixed deck (`cli-deck`) |
| `AUTO_MODE` | as set in `src/config.ts` | When enabled, answers are auto-answered correct at a fixed "good" latency instead of prompting interactively |

## Note on DB isolation

This app uses its **own separate DB** (`apps/cli-demo-db/data/learning-state.db`), independent from srs-demo's DB (`.data/srs-demo.db`). Seeding here does not affect the srs-demo app.

## Other commands

```bash
pnpm --filter cli-demo-db typecheck
pnpm --filter cli-demo-db test
```
