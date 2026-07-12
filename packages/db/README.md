# @gll/db

SQLite persistence layer for GLL, built on `better-sqlite3` + `drizzle-orm`. Owns the schema and provides async store classes over synchronous SQLite so callers can depend on a stable, `Promise`-returning port (per the EP34 async-storage contract).

## Public API

```ts
import {
  getDb, closeDb, initDb, schema,
  SqliteLearningStore,
  SqliteContentStore,
  SqliteReviewStore,
  SqliteAnswerEventStore,
} from '@gll/db';
import type {
  ILearningStore, IContentStore, IReviewStore,
  IAnswerEventStore, AnswerEventRecord, ResolvedThresholds,
} from '@gll/db';
```

| Store | Interface | Responsibility |
|---|---|---|
| `SqliteLearningStore` | `ILearningStore` | Per-user word/sentence Learning state, stagnation tracking, shelving |
| `SqliteReviewStore` | `IReviewStore` | Per-user FSRS review cards (graduated words) |
| `SqliteContentStore` | `IContentStore` | Curriculum content (decks, words, sentences) in API-contract shape |
| `SqliteAnswerEventStore` | `IAnswerEventStore` | Append-only per-answer transition log (`AnswerEventRecord`), incl. the `ResolvedThresholds` each transition used — the config an artifact replays under |

`getDb(path?)` returns a shared Drizzle client (defaults to `./data/learning-state.db`) and runs migrations via `initDb`; `closeDb()` disposes it. `schema` is the Drizzle table namespace.

## Schema

Tables: `users`, `words`, `foundational_words`, `decks`, `deck_words`, `user_word_states`, `user_sentence_states`, `review_cards`, `answer_events`, `user_shelved_words`, `user_deck_word_tracking`.

## Usage

```ts
const db = getDb();
const learning = new SqliteLearningStore(db);
const state = await learning.getAllWordStates('demo-user');
```

## Scripts

```bash
pnpm --filter @gll/db test          # unit tests (in-memory SQLite)
pnpm --filter @gll/db db:generate   # generate a Drizzle migration
pnpm --filter @gll/db db:push       # apply schema to the dev DB
```
