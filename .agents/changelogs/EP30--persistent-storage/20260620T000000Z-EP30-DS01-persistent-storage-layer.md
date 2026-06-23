# EP30-DS01: Persistent Storage Layer

**Date**: 2026-06-20
**Status**: Draft
**Epic**: [EP30 — Persistent Storage Layer](../../.agents/plans/epics/EP30-persistent-storage.md)
**Schema authority**: [Database Schema ADR](../../product-documentation/architecture/20260620T000000Z-engineering-database-schema.md)

---

## 1. Feature Overview

EP30 replaces the `ENABLE_MOCK_DB` JSON flat-file shim in `demo/learning-runner.ts` with a production-grade SQLite persistence layer. It covers the full learner state domain (`user_word_states`, `user_sentence_states`) with write-on-answer semantics, and lays the complete DB schema for all domains defined in the schema ADR.

The call chain after EP30:

```
pnpm engine:real-db
  └── tsx apps/cli-demo-db/src/learning-runner-db.ts
        ├── getDb("data/learning-state.db")       ← from @gll/db; runs initDb
        ├── store.getAllWordStates('cli-user')     → RunState (Map)
        ├── store.getAllSentenceStates('cli-user') → SentenceRunState (Map)
        ├── words = allWords.filter(w => !mastered(w, initialRunState))  ← mastered words excluded from session
        ├── runAdaptiveLoop(words, wordPool, ..., initialRunState, initialSentenceRunState,
        │     recheckIds:       new Set(),         ← no recheck on launch
        │     onWordAnswer:     (ws) => store.upsertWordState('cli-user', ws),
        │     onSentenceAnswer: (ss) => store.upsertSentenceState('cli-user', ss),
        │     onGraduation:     (ids) => console.log('[INFO] Graduated:', ids),
        │   )
        │     └── returns { runState, sentenceRunState }
        └── store.close()
```

**Architecture**:
- **`@gll/db`** (application layer): DB setup, migrations, schema definition, Drizzle config, serialization helpers, implementations
- **`@gll/srs-engine-v2`** (library layer): DB-agnostic; no persistence concepts. Exposes plain-function callbacks as extension points only.

`better-sqlite3` writes directly to a local `.db` file — no network, no server. The schema is D1-compatible, making it a config swap (not a migration) when the app moves to Cloudflare.

Drizzle chosen over Knex for lightweight schema-first migrations. The schema lives in TypeScript; migrations are generated `.sql` files. This approach scales to Hono wiring without lifting.

---

## 2. Pre-condition: Current Code Gap

`runAdaptiveLoop` in `demo/learning-io.ts` currently returns only `RunState`:

```ts
// learning-io.ts line 292 — current signature
export async function runAdaptiveLoop(...): Promise<RunState>

// learning-io.ts line 311 — sentenceRunState is local, never returned
const sentenceRunState: SentenceRunState = new Map();

// learning-io.ts line 390 — only runState returned
return state.runState;
```

EP30-ST01 fixes this before any persistence story touches it.

---

## 3. Core Requirements

| Requirement | Decision | Rationale |
|---|---|---|
| Storage technology | `better-sqlite3` | Synchronous API matches blocking readline runner; D1-compatible SQL dialect |
| Schema | All 10 tables from schema ADR; `CREATE TABLE IF NOT EXISTS` | Full schema DDL from day one, even if only learner state tables are written in EP30 |
| Multi-user | `user_id` on all learner state tables; CLI hardcodes `'cli-user'` | No migration when Hono/auth arrives |
| Write-on-answer | Callbacks `onWordAnswer` / `onSentenceAnswer` passed into `runAdaptiveLoop` | Engine stays decoupled from store type; write after each answer, not batch end |
| Session resume | Reconstruct `active[]`/`queue[]` from `user_word_states` on next launch | No session snapshot table needed |
| Serialisation boundary | Application-owned helpers in `@gll/db` | `Map`/`Set` don't survive `JSON.stringify`; app decides serialization format (JSON, MessagePack, etc.) |
| Graduation hook | `onGraduation?: GraduationHook` on `runAdaptiveLoop` | No-op default; EP21 wires FSRS seed here with zero changes to the runner |
| JSON shim removal | Delete `ENABLE_MOCK_DB`, `loadRunState`, `saveRunState`, `STATE_FILE` | No backward-compat needed — CLI demo only; clean cut |
| D1 compatibility | Standard SQL only — no `AUTOINCREMENT`, no `PRAGMA foreign_keys` | Schema must apply without change to D1 |
| Knex | Not introduced in EP30 | 5 SQL statements; defer to Hono wiring epic |

---

## 4. Data Structures

### `LearningStore` interface

```ts
// packages/db/src/learning-store.ts

import type { WordState } from '@gll/srs-engine-v2';
import type { SentenceState } from '@gll/srs-engine-v2';

export interface LearningStore {
  getAllWordStates(userId: string): Map<string, WordState>;
  upsertWordState(userId: string, state: WordState): void;

  getAllSentenceStates(userId: string): Map<string, SentenceState>;
  upsertSentenceState(userId: string, state: SentenceState): void;

  close(): void;
}
```

`LearningStore` lives in `@gll/db` alongside `SqliteLearningStore`. The engine imports nothing from `@gll/db` — callbacks are typed as plain functions using engine-owned types (`WordState`, `SentenceState`).

### SQLite schema (learner state tables — full DDL in `schema.sql`)

```sql
-- user_word_states
CREATE TABLE IF NOT EXISTS user_word_states (
  user_id        TEXT NOT NULL,
  word_id        TEXT NOT NULL,
  seen           INTEGER NOT NULL DEFAULT 0,
  correct        INTEGER NOT NULL DEFAULT 0,
  mastery        INTEGER NOT NULL DEFAULT 0,
  correct_streak INTEGER NOT NULL DEFAULT 0,
  wrong_streak   INTEGER NOT NULL DEFAULT 0,
  lapses         INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, word_id)
);

-- user_sentence_states
CREATE TABLE IF NOT EXISTS user_sentence_states (
  user_id              TEXT NOT NULL,
  sentence_id          TEXT NOT NULL,
  sentence_streak      INTEGER NOT NULL DEFAULT 0,
  last_batch_seen      INTEGER NOT NULL DEFAULT -1,
  daily_count          INTEGER NOT NULL DEFAULT 0,
  session_wrong_streak INTEGER NOT NULL DEFAULT 0,
  active               INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, sentence_id)
);
```

`schema.sql` also includes all other tables from the schema ADR (`users`, `decks`, `words`, `foundational_words`, `sentences`, `sentence_components`, `deck_words`, `review_cards`) as `CREATE TABLE IF NOT EXISTS`. EP30 only writes to the two learner state tables — the rest are created but unpopulated.

### `runAdaptiveLoop` signature after EP30

```ts
// packages/srs-engine-v2/demo/learning-io.ts

export async function runAdaptiveLoop(
  words: QuizItem[],
  wordPool: QuizItem[],
  foundationalPool: QuizItem[],
  wordsPerBatch: number,
  masteryThreshold: number,
  streakThresholds: StreakThresholds,
  initialRunState?: RunState,
  initialSentenceRunState?: SentenceRunState,    // ← ST01: was local variable, now a parameter
  recheckIds?: Set<string>,
  strategy?: AutoAnswerStrategy,
  onWordAnswer?: (state: WordState) => void,     // ← ST06: write-on-answer callback
  onSentenceAnswer?: (state: SentenceState) => void, // ← ST06
  onGraduation?: GraduationHook,                 // ← ST07
): Promise<{ runState: RunState; sentenceRunState: SentenceRunState }>  // ← ST01: was Promise<RunState>
```

### `GraduationHook`

```ts
// packages/srs-engine-v2/src/index.ts (exported)

export type GraduationHook = (
  graduatedWordIds: string[],
  runState: RunState,
) => void;
```

---

## 5. Stories

### EP30-ST01: Return `SentenceRunState` from `runAdaptiveLoop`

**Scope**: Fix the current gap where `sentenceRunState` is a local variable in `runAdaptiveLoop` and never returned. Change the return type to `{ runState, sentenceRunState }`. Accept `initialSentenceRunState` as an optional parameter so the runner can pass in loaded state. Update the call site in `learning-runner.ts`.

No DB, no schema, no serialisation — purely engine plumbing.

**Read list**:
- `packages/srs-engine-v2/demo/learning-io.ts` — lines 292–391 (`runAdaptiveLoop`)
- `packages/srs-engine-v2/demo/learning-runner.ts` — line 106 (call site)

**Tasks**:
- [x] `demo/learning-io.ts`: add `initialSentenceRunState?: SentenceRunState` parameter; initialise `sentenceRunState` from it (fallback `new Map()`); change return to `{ runState: state.runState, sentenceRunState }`
- [x] `demo/learning-runner.ts`: destructure `{ runState, sentenceRunState }` from `runAdaptiveLoop`; pass `sentenceRunState` back into next loop iteration; update `saveRunState` call (still JSON shim for now — ST04 replaces it)

**Acceptance criteria**:
- [x] `runAdaptiveLoop` return type is `Promise<{ runState: RunState; sentenceRunState: SentenceRunState }>`
- [x] `sentenceRunState` no longer discarded at function exit — properly returned to caller
- [x] Call site in `learning-runner.ts` destructures both `runState` and `sentenceRunState`; passes `sentenceRunState` into next loop iteration
- [x] `pnpm learnv2` runs without error
- [x] All existing tests pass: `pnpm --filter @gll/srs-engine-v2 test`
- [x] `pnpm --filter @gll/srs-engine-v2 typecheck` clean

---

### EP30-ST02: Drizzle Schema Definition

**Scope**: Define all 11 tables from the schema ADR using Drizzle ORM TypeScript. Schema lives in `@gll/db` (application layer, not library layer).

**Read list**:
- `product-documentation/architecture/20260620T000000Z-engineering-database-schema.md` — canonical DDL

**Tasks**:
- [x] Create `packages/db/src/schema.ts` — Drizzle schema for all 11 tables (users, words, foundational_words, decks, sentences, sentence_components, deck_words, user_word_states, user_sentence_states, review_cards)
- [x] Use `sqliteTable` (SQLite dialect)
- [x] Add `drizzle-orm` to `@gll/db/package.json`

**Acceptance criteria**:
- [x] `schema.ts` matches schema ADR exactly for all 11 tables
- [x] All columns, types, and constraints present
- [x] `@gll/db` package created with proper structure (package.json, tsconfig, drizzle.config.ts)
- [x] Drizzle schema compiles with `pnpm --filter @gll/db typecheck`

---

### EP30-ST02b: Migration Infrastructure + Init DB Helper

**Scope**: Set up Drizzle migrations and `initDb` helper in `@gll/db`. Generates and tracks `.sql` migration files.

**Tasks**:
- [x] Create `packages/db/drizzle.config.ts` — Drizzle config pointing to schema and migrations directory
- [x] Create `packages/db/src/init-db.ts` — `initDb(db: DatabaseConnection)` reads `.sql` files from `drizzle/migrations/`, tracks applied migrations in `__drizzle_migrations__` table, applies pending migrations idempotently
- [x] Create `packages/db/src/db.ts` — `getDb(path)` initializes better-sqlite3 + Drizzle + runs `initDb`
- [x] Run `pnpm --filter @gll/db db:generate` to create initial `0001_initial_schema.sql`
- [x] Add `drizzle-kit` as devDep; add `db:generate` and `db:push` scripts to `package.json`

**Acceptance criteria**:
- [x] Migration files in `packages/db/drizzle/migrations/*.sql` are D1-compatible (no `AUTOINCREMENT`, standard SQL)
- [x] `initDb` is idempotent — calling twice on the same DB does not error
- [x] `pnpm --filter @gll/db db:generate` creates `.sql` files without error
- [x] Migration tested end-to-end — creates all 10 tables successfully
- [x] Engine package has zero DB dependencies (drizzle-orm, drizzle-kit, better-sqlite3, @types/better-sqlite3 removed)
- [x] `pnpm --filter @gll/db typecheck` clean
- [x] `pnpm --filter @gll/srs-engine-v2 typecheck` clean

---

### ~~EP30-ST03: Serialisation Helpers~~ (DELETED)

~~Pure serialisation/deserialisation helpers — unused in production code. Apps decide their own serialization format.~~

---

### EP30-ST04: `LearningStore` Interface + `SqliteLearningStore`

**Scope**: Define `LearningStore` interface and implement `SqliteLearningStore` — both in `@gll/db`. The engine has no persistence concepts; it exposes plain-function callbacks typed against its own domain types (`WordState`, `SentenceState`).

**Read list**:
- `packages/db/src/schema.ts` (ST02 output)
- `packages/srs-engine-v2/src/types/word-state.ts`
- `packages/srs-engine-v2/src/types/sentence-state.ts`

**Tasks**:
- [x] Create `packages/db/src/learning-store.ts` — `LearningStore` interface (imports `WordState`, `SentenceState` from `@gll/srs-engine-v2`)
- [x] Create `packages/db/src/sqlite-learning-store.ts` — `SqliteLearningStore` implementation:
  - [x] Constructor: accepts `Database` connection (not file path)
  - [x] Uses Drizzle queries (type-safe)
  - [x] `getAllWordStates(userId)`: `SELECT * FROM user_word_states WHERE user_id = ?` → `Map<string, WordState>`
  - [x] `upsertWordState(userId, state)`: `INSERT OR REPLACE INTO user_word_states`
  - [x] `getAllSentenceStates(userId)`: `SELECT * FROM user_sentence_states WHERE user_id = ?` → `Map<string, SentenceState>`
  - [x] `upsertSentenceState(userId, state)`: `INSERT OR REPLACE INTO user_sentence_states`
  - [x] `close()`: close the connection
- [x] Create `packages/db/src/__tests__/sqlite-learning-store.test.ts`:
  - [x] Pass a test Database connection (caller responsibility)
  - [x] Upsert then getAll returns same `WordState` (all fields including `lapses`)
  - [x] Upsert then getAll returns same `SentenceState` (`active: false`, `lastBatchSeen: -1` preserved)
  - [x] Second upsert with same `(userId, wordId)` overwrites — no duplicate rows
- [x] Export `LearningStore`, `SqliteLearningStore` from `packages/db/src/index.ts`

**Acceptance criteria**:
- [x] All integration tests pass: `pnpm --filter @gll/db test`
- [x] `pnpm --filter @gll/db typecheck` clean
- [x] `pnpm --filter @gll/srs-engine-v2 typecheck` clean
- [x] Constructor signature is `SqliteLearningStore(db: Database)` — no file path
- [x] `LearningStore` and `SqliteLearningStore` importable from `@gll/db`
- [x] `srs-engine-v2` has zero imports from `@gll/db`

---

### EP30-ST05: Curriculum Import (JSON → DB)

**Scope**: Create a one-time import script in `apps/cli-demo-db` that reads `packages/srs-engine-v2/data/samples/conversations-2026-03-08.json` and `packages/srs-engine-v2/data/seed-data/thai-full-foundations.ts`, transforms them, and inserts into the DB content tables (`decks`, `words`, `foundational_words`, `sentences`, `sentence_components`, `deck_words`). This is a prerequisite for ST06 — the runner must query curriculum from the DB, not from TypeScript mock files.

**Read list**:
- `packages/db/src/schema.ts` (ST02 output)
- `packages/db/src/db.ts` (ST02b output)
- `packages/srs-engine-v2/data/samples/conversations-2026-03-08.json` — source curriculum
- `packages/srs-engine-v2/data/seed-data/thai-full-foundations.ts` — source foundations

**Tasks**:
- [x] Create `apps/cli-demo-db/` package scaffold (package.json, tsconfig.json)
- [x] Create `apps/cli-demo-db/src/import-curriculum.ts`:
  - [x] Parse conversations JSON → insert one `decks` row per conversation (use existing UUID from JSON `id` field)
  - [x] Deduplicate words by `(language, text)` across all conversations → insert into `words` (generate UUID per unique word; handle sense merging per schema ADR Q10)
  - [x] Insert `sentences` rows (one per `breakdown` entry; generate UUID)
  - [x] Insert `sentence_components` rows (one per component in breakdown; FK to sentence UUID + word UUID)
  - [x] Derive and insert `deck_words` from `sentence_components` (no drift)
  - [x] Insert `foundational_words` from `thai-full-foundations.ts` (use existing string IDs e.g. `th:consonant:ก`)
  - [x] Import is idempotent — safe to run twice (use `INSERT OR IGNORE` / `onConflictDoNothing`)
- [x] Add `engine:import-curriculum` script to `apps/cli-demo-db/package.json` → `tsx src/import-curriculum.ts`

**Acceptance criteria**:
- [x] `pnpm --filter cli-demo-db engine:import-curriculum` exits cleanly
- [x] `decks`, `words`, `sentences`, `sentence_components`, `deck_words`, `foundational_words` tables are populated
- [x] Running twice does not error (idempotent)
- [x] Word dedup works — same Thai text appearing in multiple conversations resolves to one `words` row
- [x] `pnpm --filter cli-demo-db typecheck` clean

---

### EP30-ST06: `cli-demo-db` Runner (DB-backed)

**Scope**: Create the DB-backed runner in `apps/cli-demo-db`. Queries curriculum from DB (not from TypeScript mock files), loads learner state from DB, and passes both into `runAdaptiveLoop`. Also includes DB management utilities (clear, reset, seed). Keep original mock runner (`learning-runner.ts`) in srs-engine-v2 demo untouched.

**Read list**:
- `packages/db/src/db.ts` (ST02b output)
- `packages/db/src/sqlite-learning-store.ts` (ST04 output)
- `packages/db/src/schema.ts` (ST02 output)
- `packages/srs-engine-v2/demo/learning-io.ts` (ST01 output)
- `apps/cli-demo-db/src/import-curriculum.ts` (ST05 output)

**Tasks**:
- [x] Create `apps/cli-demo-db/src/learning-runner-db.ts`:
  - [x] `DB_PATH = process.env.GLL_DB_PATH ?? './data/learning-state.db'`
  - [x] `getDb(DB_PATH)` at startup; log `[INFO] DB ready`
  - [x] Query `words` + `deck_words` + `decks` from DB → build `QuizItem[]` (word UUID as `id`)
  - [x] Query `sentences` + `sentence_components` from DB → build `SentenceContext[]`
  - [x] Query `foundational_words` from DB → build foundational `QuizItem[]`
  - [x] Load `RunState` via `store.getAllWordStates('cli-user')` (keyed by word UUID)
  - [x] Load `SentenceRunState` via `store.getAllSentenceStates('cli-user')`
  - [x] Call `runAdaptiveLoop` (callbacks wired in ST07)
  - [x] `closeDb()` on exit
- [x] Duplicate interactive helpers from `srs-engine-v2/demo/learning-io.ts` into app (no cross-package demo import):
  - [x] `selectDeck`, `runInteractive`, `runInteractiveMCQ`, `runInteractiveWordBlock`, `runBatch`, `runAdaptiveLoop`
  - [x] `AutoAnswerStrategy`, `CorrectAutoAnswerStrategy`, `runAutoInteractive`
- [x] Create `apps/cli-demo-db/src/config.ts` — duplicate `LEARNING_CONFIG`, `STREAK_THRESHOLDS`, `AUTO_MODE` (no `ENABLE_MOCK_DB`)
- [x] Create `apps/cli-demo-db/src/db-tools.ts`:
  - [x] `clearUserState(userId)` — DELETE from learner state tables
  - [x] `resetDb()` — `closeDb()` first, delete DB file, `getDb()` to reinitialize
  - [x] `seedDb(fixtureName)` — throws `Error` if fixture unknown; clears then upserts fixture rows
- [x] Create `apps/cli-demo-db/src/db-fixtures.ts`:
  - [x] `baseline` — empty state
  - [x] `mid-session` — 4 words at mastery 0–2 (word UUIDs resolved from DB after ST05 import)
  - [x] `sentence-ready` — all 6 words from `sent::eat-001` equivalent with `seen >= 2`
- [x] Add scripts to `apps/cli-demo-db/package.json`:
  - [x] `engine:real-db`, `engine:real-db:clear`, `engine:real-db:reset`
  - [x] `engine:real-db:seed:baseline`, `engine:real-db:seed:mid-session`, `engine:real-db:seed:sentence-ready`
- [x] Rename `learnv2` → `engine:mock-db` in `packages/srs-engine-v2/package.json`
- [x] Rename `learnv2` → `engine:mock-db` in root `package.json`

**Acceptance criteria**:
- [x] `pnpm --filter cli-demo-db engine:real-db` runs — queries curriculum from DB, loads zero learner state on fresh DB, enters session (will not persist — ST07 adds callbacks)
- [x] `pnpm --filter cli-demo-db engine:real-db:seed:mid-session` then `engine:real-db` — loaded word states passed into `runAdaptiveLoop` as `initialRunState`; session reflects partial progress
- [x] `pnpm --filter cli-demo-db engine:real-db:seed:sentence-ready` then `engine:real-db` — sentence question appears in session
- [x] `pnpm --filter cli-demo-db engine:real-db:clear` exits cleanly
- [x] `pnpm --filter cli-demo-db engine:real-db:reset` deletes DB file cleanly
- [x] `pnpm --filter @gll/srs-engine-v2 engine:mock-db` still works unchanged
- [x] `pnpm --filter cli-demo-db typecheck` clean

---

### EP30-ST07: Write-on-Answer Callbacks

**Scope**: Add `onWordAnswer` / `onSentenceAnswer` callbacks to `runAdaptiveLoop`. Wire them in `cli-demo-db/learning-runner-db.ts` to call `store.upsertWordState` / `store.upsertSentenceState` after each batch.

**Implementation notes**:
- Callbacks receive the updated `WordState` / `SentenceState` after each batch (post-`advanceAdaptiveSession` for words; post-`updateSentenceRunState` for sentences)
- `onWordAnswer` fires once per unique word ID answered in the batch; asserts `runState` entry exists (throws on missing entry rather than silently skipping)
- `onSentenceAnswer` fires once per `SentenceQuizResult` record (sentences may appear more than once per batch if retried)
- `CLI_USER_ID = 'cli-user'` extracted as named constant in runner — single change point for future multi-user support
- Tests live in `apps/cli-demo-db/src/__tests__/learning-io.test.ts` (7 tests covering callback invocation, structure, independence, and write-on-answer integration with real in-memory SQLite)

**Read list**:
- `apps/cli-demo-db/src/learning-io.ts` (ST06 output)
- `apps/cli-demo-db/src/learning-runner-db.ts` (ST06 output)
- `packages/db/src/sqlite-learning-store.ts` (ST04 output)

**Tasks**:
- [x] Add `onWordAnswer?: (state: WordState) => void` callback to `runAdaptiveLoop`
- [x] Add `onSentenceAnswer?: (state: SentenceState) => void` callback to `runAdaptiveLoop`
- [x] Call callbacks in `learning-io.ts` after each batch is processed; assert `runState` entry exists for `onWordAnswer`
- [x] Wire callbacks in `apps/cli-demo-db/src/learning-runner-db.ts` to persist state after each batch
- [x] Extract `CLI_USER_ID` constant in runner
- [x] Add tests in `apps/cli-demo-db/src/__tests__/learning-io.test.ts`

**Acceptance criteria**:
- [x] `pnpm --filter cli-demo-db engine:real-db` persists after each batch (mid-session quit does not lose progress)
- [x] Callbacks are optional (omitting them does not throw)
- [x] `pnpm --filter cli-demo-db test` passes (27 tests across 4 test files)

---

### EP30-ST08: Graduation Hook Stub

**Scope**: Add `onGraduation?: GraduationHook` to `runAdaptiveLoop`. At loop exit, compare initial `RunState` with final `RunState` to identify words that crossed `masteryThreshold` this session. Call the hook with those IDs. Pass a console-log hook in `cli-demo-db/learning-runner-db.ts`.

**Read list**:
- `packages/srs-engine-v2/demo/learning-io.ts` (ST07 output)
- `packages/srs-engine-v2/src/index.ts`

**Tasks**:
- [x] Add `GraduationHook` type to `packages/srs-engine-v2/src/types/word-state.ts`
- [x] Add `onGraduation?: GraduationHook` to `runAdaptiveLoop` signature
- [x] `apps/cli-demo-db/src/learning-io.ts`: after loop exits, derive `graduatedWordIds` by comparing initial vs final `RunState` against `masteryThreshold`; call `onGraduation(graduatedWordIds, finalRunState)` if provided
- [x] `apps/cli-demo-db/src/learning-runner-db.ts`: pass graduation hook that logs newly mastered words
- [x] Export `GraduationHook` type from `packages/srs-engine-v2/src/index.ts`

**Acceptance criteria**:
- [x] Running `pnpm --filter cli-demo-db engine:real-db` logs graduated word IDs at session end
- [x] Omitting `onGraduation` does not throw
- [x] `GraduationHook` importable from `@gll/srs-engine-v2`
- [x] All existing tests pass: `pnpm --filter cli-demo-db test`
- [x] `pnpm --filter @gll/srs-engine-v2 typecheck` clean

---

## 6. File Map After EP30

```
packages/db/
├── src/
│   ├── schema.ts                             ← NEW (ST02): Drizzle schema, all 11 tables
│   ├── init-db.ts                            ← NEW (ST02b): migration runner
│   ├── db.ts                                 ← NEW (ST02b): getDb/closeDb helpers
│   ├── learning-store.ts                     ← NEW (ST04): LearningStore interface
│   ├── sqlite-learning-store.ts              ← NEW (ST04): SqliteLearningStore impl
│   ├── __tests__/
│   │   └── sqlite-learning-store.test.ts     ← NEW (ST04): integration tests
│   └── index.ts                              ← MODIFIED (ST04): export LearningStore, SqliteLearningStore
├── drizzle.config.ts                         ← NEW (ST02b)
└── drizzle/migrations/
    └── 0001_initial_schema.sql               ← NEW (ST02b): initial DDL

packages/srs-engine-v2/
├── src/
│   └── index.ts                              ← MODIFIED (ST08): new exports
├── demo/
│   ├── learning-io.ts                        ← MODIFIED (ST01, ST08): return type, graduation hook
│   ├── learning-runner.ts                    ← MODIFIED (ST01): accept SentenceRunState
│   └── config.ts                             ← (no changes, keep as-is)
└── RULES.md                                  ← NEW: library boundary enforcement

apps/cli-demo-db/                             ← NEW (ST05+ST06): app package, not library
├── src/
│   ├── import-curriculum.ts                  ← NEW (ST05): JSON → DB import
│   ├── learning-runner-db.ts                 ← NEW (ST06, ST07): DB-backed runner + callbacks wired
│   ├── learning-io.ts                        ← NEW (ST06, ST07): app copy of IO helpers + callbacks
│   ├── config.ts                             ← NEW (ST06): app config (no ENABLE_MOCK_DB)
│   ├── db-tools.ts                           ← NEW (ST06): clear/reset/seed utilities
│   ├── db-fixtures.ts                        ← NEW (ST06): learner state fixtures
│   ├── auto-answer-strategy.ts               ← NEW (ST06): CorrectAutoAnswerStrategy
│   ├── db-query.ts                           ← NEW (ST06): buildQuizItems, buildSentenceCorpus
│   └── __tests__/
│       ├── db-query.test.ts                  ← NEW (ST06)
│       ├── db-tools.test.ts                  ← NEW (ST06)
│       ├── import-curriculum.test.ts         ← NEW (ST06)
│       └── learning-io.test.ts               ← NEW (ST07): callback + write-on-answer tests
└── package.json

data/
└── learning-state.db                         ← GENERATED at runtime (gitignored)
```

---

## 7. Next Steps

| Step | Story | Status |
|---|---|---|
| ✅ Return `SentenceRunState` from loop | ST01 | COMPLETE |
| ✅ Schema definition & migrations | ST02 + ST02b | COMPLETE |
| ✅ `LearningStore` + `SqliteLearningStore` in `@gll/db` | ST04 | COMPLETE |
| ✅ Curriculum import (JSON → DB) | ST05 | COMPLETE |
| ✅ DB-backed runner + tools | ST06 | COMPLETE |
| ✅ Write-on-answer callbacks | ST07 | COMPLETE |
| ✅ Graduation hook | ST08 | COMPLETE |
| ✅ Runner resume fix — skip mastered words on session start | post-ST08 | COMPLETE |

### Post-ST08 fix: runner resume (2026-06-23)

During manual verification of ST08, mastered words were reappearing at the start of every new session, forcing users through a recheck batch before reaching unmastered words.

**Root cause**: `initAdaptiveSession` takes the first `wordsPerBatch` words from the full word list. Mastered words (the first 3 in DB insertion order) always occupied all active slots, leaving no room for unmastered words in batch 1. Users had to complete the recheck batch and answer `y` before seeing any new vocabulary.

**Fix** (`commit 321c1e7`):
- `learning-runner-db.ts`: filter mastered words out of the session word list before passing to `runAdaptiveLoop`; `wordPool` (for distractors) still includes all words
- `learning-runner-db.ts`: remove unused `recheckIds` construction (mastered words no longer need recheck on every launch)
- `learning-io.ts`: add Ctrl+C (`\x03`) exit handling in raw-mode stdin
