# apps/cli-demo-db CODEMAP

App: `cli-demo-db`
Purpose: Interactive CLI tool for testing and demonstrating the SRS learning engine with a real SQLite database. Entry point for manual testing, debugging, and validation.

## Main Entry Point

| File | Purpose |
|---|---|
| `src/menu.ts` | Menu-driven interface: choose between learning demo, review, curriculum import, DB tools. |

## Learning Flow

| File | Purpose |
|---|---|
| `src/learning-runner-db.ts` | Run a full learning session: fetch batch, auto-answer questions, update state, repeat. |
| `src/auto-answerer.ts` | Auto-answer logic for a quiz batch. |
| `src/auto-answer-strategy.ts` | Strategy for auto-answering: randomized, deterministic, or hinted. |
| `src/learning-io.ts` | Display learning questions and results. |
| `src/graduation-performance.ts` | Compute GraduationPerformance metrics when words graduate. |

## Review Flow

| File | Purpose |
|---|---|
| `src/review-runner-db.ts` | Run a review session: fetch due cards, auto-rate, schedule, repeat. Pool or deck mode. |
| `src/review-rating.ts` | Infer review ratings (again/hard/good/easy) from auto-answerer scores. |
| `src/seed-mock-reviews.ts` | Seed mock review cards for testing review flow without full graduation. |

## Curriculum & Data

| File | Purpose |
|---|---|
| `src/import-curriculum.ts` | Import curriculum JSON files from disk or API into the database. |
| `src/db-fixtures.ts` | Pre-built curriculum and word data for testing. |

## Database Tools

| File | Purpose |
|---|---|
| `src/db-tools-cli.ts` | CLI entry: `clear`, `reset`, `seed {baseline,mid-session,sentence-ready}`. |
| `src/db-tools.ts` | DB operations: clear all data, reset to fixtures, apply seed scenarios. |
| `src/db-query.ts` | Query utilities: inspect word state, review cards, answer history. |

## Configuration

| File | Purpose |
|---|---|
| `src/config.ts` | App configuration: database path, difficulty levels, batch size. |
| `src/env.ts` | Environment variable loading (REVIEW_MODE, DEBUG, etc.). |

## Package Scripts

| Script | Purpose |
|---|---|
| `menu` | Launch interactive menu. |
| `engine:real-db` | Run learning demo directly. |
| `engine:review` | Run review session directly. |
| `engine:review:seed` | Seed mock review cards. |
| `engine:real-db:clear` | Clear all data. |
| `engine:real-db:reset` | Reset to fixture state. |
| `engine:real-db:seed:baseline` | Seed with baseline scenario (fresh decks). |
| `engine:real-db:seed:mid-session` | Seed mid-session scenario (words in learning). |
| `engine:real-db:seed:sentence-ready` | Seed sentence-ready scenario (all deps for audio). |

## Integration Points

| Target | Used By | Purpose |
|---|---|---|
| `@gll/db` | All modules | Database schema, stores, connection. |
| `@gll/srs-engine` | learning-runner-db, review-runner-db | Quiz batches, answer application, word state. |
| `@gll/srs-review` | review-runner-db | Review scheduling (FsrsScheduler). |
| `@gll/srs-shelving` | learning-runner-db | Shelving policy evaluation. |
| `@gll/api-contract` | All modules | Type contracts (DeckDoc, BatchResponse, etc.). |

## Testing & Validation Flow

1. **Fresh start**: `npm run engine:real-db:reset` → `npm run menu` → Run learning demo
2. **Curriculum**: `npm run engine:import-curriculum` → load external deck JSON
3. **Mid-session**: `npm run engine:real-db:seed:mid-session` → Continue learning
4. **Review**: `npm run engine:real-db:seed:sentence-ready` → `npm run engine:review` → Test review flow
5. **Debug**: `npm run engine:real-db:seed:baseline` → inspect DB state with `db-query.ts`
