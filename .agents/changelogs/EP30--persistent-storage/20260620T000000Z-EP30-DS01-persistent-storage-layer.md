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
  └── tsx demo/learning-runner-db.ts
        ├── getDb("data/learning-state.db")       ← from @gll/db; runs initDb
        ├── store.getAllWordStates('cli-user')     → RunState (Map)
        ├── store.getAllSentenceStates('cli-user') → SentenceRunState (Map)
        ├── initAdaptiveSession(words, config, recheckIds, runState)
        ├── runAdaptiveLoop(words, ..., initialRunState, initialSentenceRunState,
        │     onWordAnswer:     (ws) => store.upsertWordState('cli-user', ws),
        │     onSentenceAnswer: (ss) => store.upsertSentenceState('cli-user', ss),
        │     onGraduation:     (ids) => console.log('[INFO] Graduated:', ids),
        │   )
        │     └── returns { runState, sentenceRunState }   ← ST01 fixes this gap
        └── store.close()
```

**Architecture**:
- **`@gll/db`** (application layer): DB setup, migrations, schema definition, Drizzle config
- **`@gll/srs-engine-v2`** (library layer): DB-agnostic; owns `LearningStore` interface + serialization helpers

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
| Serialisation boundary | Engine-owned helpers in `src/persistence/serialise.ts` | `Map`/`Set` don't survive `JSON.stringify`; engine owns the types |
| Graduation hook | `onGraduation?: GraduationHook` on `runAdaptiveLoop` | No-op default; EP21 wires FSRS seed here with zero changes to the runner |
| JSON shim removal | Delete `ENABLE_MOCK_DB`, `loadRunState`, `saveRunState`, `STATE_FILE` | No backward-compat needed — CLI demo only; clean cut |
| D1 compatibility | Standard SQL only — no `AUTOINCREMENT`, no `PRAGMA foreign_keys` | Schema must apply without change to D1 |
| Knex | Not introduced in EP30 | 5 SQL statements; defer to Hono wiring epic |

---

## 4. Data Structures

### `LearningStore` interface

```ts
// packages/srs-engine-v2/src/persistence/learning-store.ts

import type { WordState } from '../types/word-state.js';
import type { SentenceState } from '../types/sentence-state.js';

export interface LearningStore {
  getAllWordStates(userId: string): Map<string, WordState>;
  upsertWordState(userId: string, state: WordState): void;

  getAllSentenceStates(userId: string): Map<string, SentenceState>;
  upsertSentenceState(userId: string, state: SentenceState): void;

  close(): void;
}
```

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

### Serialisation helpers

```ts
// packages/srs-engine-v2/src/persistence/serialise.ts

export function serialiseRunState(state: RunState): string;
export function deserialiseRunState(json: string): RunState;

export function serialiseSentenceRunState(state: SentenceRunState): string;
export function deserialiseSentenceRunState(json: string): SentenceRunState;

export function serialiseSet(set: Set<string>): string;
export function deserialiseSet(json: string): Set<string>;
// serialiseSet / deserialiseSet included for completeness; recheck sets are not persisted in EP30
```

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
  onWordAnswer?: (state: WordState) => void,     // ← ST05: write-on-answer callback
  onSentenceAnswer?: (state: SentenceState) => void, // ← ST05
  onGraduation?: GraduationHook,                 // ← ST06
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
- [ ] `demo/learning-io.ts`: add `initialSentenceRunState?: SentenceRunState` parameter; initialise `sentenceRunState` from it (fallback `new Map()`); change return to `{ runState: state.runState, sentenceRunState }`
- [ ] `demo/learning-runner.ts`: destructure `{ runState, sentenceRunState }` from `runAdaptiveLoop`; pass `sentenceRunState` back into next loop iteration; update `saveRunState` call (still JSON shim for now — ST05 replaces it)

**Acceptance criteria**:
- [ ] `runAdaptiveLoop` return type is `Promise<{ runState: RunState; sentenceRunState: SentenceRunState }>`
- [ ] `pnpm learnv2` runs without error
- [ ] All existing tests pass: `pnpm --filter @gll/srs-engine-v2 test`
- [ ] `pnpm --filter @gll/srs-engine-v2 typecheck` clean

---

### EP30-ST02: Drizzle Schema Definition

**Scope**: Define all 11 tables from the schema ADR using Drizzle ORM TypeScript. Schema lives in `@gll/db` (application layer, not library layer).

**Read list**:
- `product-documentation/architecture/20260620T000000Z-engineering-database-schema.md` — canonical DDL

**Tasks**:
- [ ] Create `packages/db/src/schema.ts` — Drizzle schema for all 11 tables (users, words, foundational_words, decks, sentences, sentence_components, deck_words, user_word_states, user_sentence_states, review_cards)
- [ ] Use `sqliteTable` (SQLite dialect)
- [ ] Add `drizzle-orm` to `@gll/db/package.json`

**Acceptance criteria**:
- [ ] `schema.ts` matches schema ADR exactly for all 11 tables
- [ ] All columns, types, and constraints present
- [ ] Drizzle schema compiles with `pnpm --filter @gll/db typecheck`

---

### EP30-ST02b: Migration Infrastructure + Init DB Helper

**Scope**: Set up Drizzle migrations and `initDb` helper in `@gll/db`. Generates and tracks `.sql` migration files.

**Tasks**:
- [ ] Create `packages/db/drizzle.config.ts` — Drizzle config pointing to schema and migrations directory
- [ ] Create `packages/db/src/init-db.ts` — `initDb(db: DatabaseConnection)` reads `.sql` files from `drizzle/migrations/`, tracks applied migrations in `__drizzle_migrations__` table, applies pending migrations idempotently
- [ ] Create `packages/db/src/db.ts` — `getDb(path)` initializes better-sqlite3 + Drizzle + runs `initDb`
- [ ] Run `pnpm --filter @gll/db db:generate` to create initial `0001_initial_schema.sql`
- [ ] Add `drizzle-kit` as devDep; add `db:generate` and `db:push` scripts to `package.json`

**Acceptance criteria**:
- [ ] Migration files in `packages/db/drizzle/migrations/*.sql` are D1-compatible (no `AUTOINCREMENT`, standard SQL)
- [ ] `initDb` is idempotent — calling twice on the same DB does not error
- [ ] `pnpm --filter @gll/db db:generate` creates `.sql` files without error
- [ ] `pnpm --filter @gll/db typecheck` clean

---

### EP30-ST03: Serialisation Helpers

**Scope**: Pure serialisation/deserialisation helpers for `RunState`, `SentenceRunState`, and `Set<string>`. Unit-tested with round-trip assertions.

**Read list**:
- `packages/srs-engine-v2/src/types/word-state.ts`
- `packages/srs-engine-v2/src/types/sentence-state.ts`

**Tasks**:
- [ ] Create `packages/srs-engine-v2/src/persistence/serialise.ts` — 6 functions
- [ ] Create `packages/srs-engine-v2/src/__tests__/unit/serialise.test.ts`:
  - [ ] `RunState`: empty map; partial state; all `WordState` fields including `lapses`
  - [ ] `SentenceRunState`: empty map; `active: false` preserved; `lastBatchSeen: -1` sentinel preserved
  - [ ] `Set<string>`: empty set; populated set
- [ ] Export helpers from `packages/srs-engine-v2/src/index.ts`

**Acceptance criteria**:
- [ ] All round-trip tests pass: `pnpm --filter @gll/srs-engine-v2 test`
- [ ] `pnpm --filter @gll/srs-engine-v2 typecheck` clean

---

### EP30-ST04: `LearningStore` Interface + `SqliteLearningStore`

**Scope**: Define `LearningStore` interface and implement it with better-sqlite3 + Drizzle. Constructor takes a Database connection (DB init is application responsibility, not library responsibility).

**Read list**:
- `packages/db/src/schema.ts` (ST02 output)
- `packages/srs-engine-v2/src/types/word-state.ts`
- `packages/srs-engine-v2/src/types/sentence-state.ts`

**Tasks**:
- [ ] Create `packages/srs-engine-v2/src/persistence/learning-store.ts` — `LearningStore` interface
- [ ] Create `packages/srs-engine-v2/src/persistence/sqlite-learning-store.ts` — `SqliteLearningStore`:
  - [ ] Constructor: accepts `Database` connection (not file path)
  - [ ] Uses Drizzle queries (type-safe)
  - [ ] `getAllWordStates(userId)`: `SELECT * FROM user_word_states WHERE user_id = ?` → `Map<string, WordState>`
  - [ ] `upsertWordState(userId, state)`: `INSERT OR REPLACE INTO user_word_states`
  - [ ] `getAllSentenceStates(userId)`: `SELECT * FROM user_sentence_states WHERE user_id = ?` → `Map<string, SentenceState>`
  - [ ] `upsertSentenceState(userId, state)`: `INSERT OR REPLACE INTO user_sentence_states`
  - [ ] `close()`: close the connection
- [ ] Create `packages/srs-engine-v2/src/__tests__/integration/sqlite-learning-store.test.ts`:
  - [ ] Pass a test Database connection (caller responsibility)
  - [ ] Upsert then getAll returns same `WordState` (all fields including `lapses`)
  - [ ] Upsert then getAll returns same `SentenceState` (`active: false`, `lastBatchSeen: -1` preserved)
  - [ ] Second upsert with same `(userId, wordId)` overwrites — no duplicate rows
- [ ] Export `LearningStore`, `SqliteLearningStore` from `packages/srs-engine-v2/src/index.ts`
- [ ] Add `@types/better-sqlite3` as devDep (types only, not runtime)

**Acceptance criteria**:
- [ ] All integration tests pass: `pnpm --filter @gll/srs-engine-v2 test`
- [ ] `pnpm --filter @gll/srs-engine-v2 typecheck` clean
- [ ] Constructor signature is `SqliteLearningStore(db: Database)` — no file path

---

### EP30-ST05: New `learning-runner-db.ts` and DB Management Scripts

**Scope**: Create second CLI runner (`learning-runner-db.ts`) that uses real DB. Keep original `learning-runner.ts` unchanged for mock testing. Add clear/reset/seed utilities.

**Read list**:
- `packages/db/src/db.ts` (ST02b output)
- `packages/srs-engine-v2/demo/learning-io.ts` (ST01 output)
- `packages/srs-engine-v2/src/persistence/sqlite-learning-store.ts` (ST04 output)

**Tasks**:
- [ ] Create `packages/srs-engine-v2/demo/learning-runner-db.ts` (new):
  - [ ] Import `getDb, closeDb` from `@gll/db`
  - [ ] Call `getDb()` at startup
  - [ ] Load `RunState` via `store.getAllWordStates('cli-user')`
  - [ ] Load `SentenceRunState` via `store.getAllSentenceStates('cli-user')`
  - [ ] Call `runAdaptiveLoop` (callbacks wired in ST06)
  - [ ] Call `closeDb()` on exit
- [ ] Create `packages/srs-engine-v2/demo/db-tools.ts` (new):
  - [ ] `clearUserState(userId)` — DELETE from learner tables
  - [ ] `resetDb()` — drop DB file, reinitialize
  - [ ] `seedDb(fixtureName)` — insert fixture data
- [ ] Create `packages/srs-engine-v2/demo/db-fixtures.ts` (new):
  - [ ] Named fixtures: baseline (empty), mid-session (words at mastery 0-2)
- [ ] Update `packages/srs-engine-v2/package.json`:
  - [ ] Rename `learnv2` to `engine:mock-db` (unchanged runner)
  - [ ] Add `engine:real-db` pointing to `learning-runner-db.ts`
  - [ ] Add `engine:real-db:clear`, `engine:real-db:reset`, `engine:real-db:seed` scripts

**Acceptance criteria**:
- [ ] `pnpm engine:real-db` runs (will not persist — ST06 adds callbacks)
- [ ] `pnpm engine:real-db:clear` exits cleanly
- [ ] `pnpm engine:real-db:reset` deletes DB file cleanly
- [ ] `pnpm engine:real-db:seed:baseline` loads fixture
- [ ] `pnpm engine:mock-db` still works unchanged
- [ ] `pnpm --filter @gll/srs-engine-v2 typecheck` clean

---

### EP30-ST06: Graduation Hook Stub

**Scope**: Add `onGraduation?: GraduationHook` to `runAdaptiveLoop`. At loop exit, compare initial `RunState` with final `RunState` to identify words that crossed `masteryThreshold` this session. Call the hook with those IDs. Pass a console-log hook in `learning-runner.ts`.

**Read list**:
- `packages/srs-engine-v2/demo/learning-io.ts` (ST05 output)
- `packages/srs-engine-v2/src/index.ts`

**Tasks**:
- [ ] Export `GraduationHook` type from `packages/srs-engine-v2/src/index.ts`
- [ ] `demo/learning-io.ts`: add `onGraduation?: GraduationHook` to `runAdaptiveLoop`; after loop exits, derive `graduatedWordIds` by comparing initial vs final `RunState` against `masteryThreshold`; call `onGraduation(graduatedWordIds, finalRunState)` if provided
- [ ] `demo/learning-runner.ts`: pass `(ids, _rs) => console.log('[INFO] Graduated:', ids)`

**Acceptance criteria**:
- [ ] Running `pnpm learnv2` in auto mode logs graduated word IDs at session end
- [ ] Omitting `onGraduation` does not throw
- [ ] `GraduationHook` importable from `@gll/srs-engine-v2`
- [ ] All existing tests pass: `pnpm --filter @gll/srs-engine-v2 test`
- [ ] `pnpm --filter @gll/srs-engine-v2 typecheck` clean

---

## 6. File Map After EP30

```
packages/srs-engine-v2/
├── src/
│   ├── persistence/
│   │   ├── schema.sql                        ← NEW (ST02): full DDL, all 10 tables
│   │   ├── init-db.ts                        ← NEW (ST02): initDb helper
│   │   ├── serialise.ts                      ← NEW (ST03): Map/Set helpers
│   │   ├── learning-store.ts                 ← NEW (ST04): LearningStore interface
│   │   └── sqlite-learning-store.ts          ← NEW (ST04): SqliteLearningStore
│   ├── __tests__/
│   │   ├── unit/
│   │   │   └── serialise.test.ts             ← NEW (ST03)
│   │   └── integration/
│   │       └── sqlite-learning-store.test.ts ← NEW (ST04)
│   └── index.ts                              ← MODIFIED (ST03, ST04, ST06): new exports
└── demo/
    ├── learning-io.ts                        ← MODIFIED (ST01, ST05, ST06): return type, callbacks, hook
    ├── learning-runner.ts                    ← MODIFIED (ST01, ST05, ST06): replace shim, wire store
    └── config.ts                             ← MODIFIED (ST05): remove ENABLE_MOCK_DB

data/
└── learning-state.db                         ← GENERATED at runtime (gitignored)
```

---

## 7. Completed Work (ST01, ST02 + ST02b ✅)

**Status**: Engine plumbing (ST01), schema definition, and migration infrastructure complete and tested.

**Delivered (ST01)**:

- [x] `runAdaptiveLoop` signature updated to accept `initialSentenceRunState?: SentenceRunState`
- [x] `runAdaptiveLoop` return type changed from `Promise<RunState>` to `Promise<{ runState: RunState; sentenceRunState: SentenceRunState }>`
- [x] `sentenceRunState` no longer discarded at function exit — properly returned to caller
- [x] Call site in `learning-runner.ts` updated to destructure both `runState` and `sentenceRunState`
- [x] `learning-runner.ts` passes `sentenceRunState` to next loop iteration
- [x] Auto scenarios tests pass with new return type
- [x] `pnpm --filter @gll/srs-engine-v2 test` passes

**Delivered (ST02 + ST02b)**:

- [x] `@gll/db` package created with proper structure (package.json, tsconfig, drizzle.config.ts)
- [x] Drizzle schema in TypeScript (`packages/db/src/schema.ts`) — all 11 tables with correct types and constraints
- [x] Migration runner (`packages/db/src/init-db.ts`) — applies `.sql` files idempotently, tracks in `__drizzle_migrations__` table
- [x] Database client (`packages/db/src/db.ts`) — `getDb()` and `closeDb()` functions for connection management
- [x] Initial migration generated (`packages/db/drizzle/migrations/0001_initial_schema.sql`) — D1-compatible SQL
- [x] Migration tested end-to-end — creates all 10 tables successfully
- [x] Both `@gll/db` and `@gll/srs-engine-v2` typecheck clean
- [x] Engine package cleaned: removed drizzle-orm, drizzle-kit, better-sqlite3 runtime deps; kept @types/better-sqlite3 as devDep
- [x] `SqliteLearningStore` refactored to accept Database connection (not file path) — DB init is application responsibility
- [x] Epic plan condensed to template format; technical details moved to DS01 task lists

**Test Results**:
```
$ pnpm node test-init-db.mjs
Found 1 migration files
Applying 0001_initial_schema...
✓ Created 10 tables: users, words, foundational_words, decks, sentences, sentence_components, deck_words, user_word_states, user_sentence_states, review_cards
```

---

## 8. Next Steps

| Step | Story | Status |
|---|---|---|
| ✅ Return `SentenceRunState` from loop | ST01 | COMPLETE |
| ✅ Schema definition & migrations | ST02 + ST02b | COMPLETE |
| Serialisation helpers | ST03 | Ready — independent, no dependencies |
| Create `LearningStore` impl | ST04 | Ready — depends on ST03 |
| New DB runner + tools | ST05 | Ready — depends on ST04 |
| Wire write-on-answer callbacks | ST06 | Ready — depends on ST05 |
| Add graduation hook | ST07 | Ready — depends on ST06 |

**Recommended order**: ST03 (independent) → ST04 → ST05 → ST06 → ST07
