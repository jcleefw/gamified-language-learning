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
pnpm learnv2
  └── tsx demo/learning-runner.ts
        ├── SqliteLearningStore.open("data/learning-state.db")  ← initDb runs schema.sql
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

`better-sqlite3` writes directly to a local `.db` file — no network, no server. The schema is D1-compatible, making it a config swap (not a migration) when the app moves to Cloudflare.

No Knex. 5 SQL statements in EP30 do not justify a query builder. Knex deferred to the Hono wiring epic.

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

### EP30-ST02: DB Initialisation Helper + Full Schema DDL

**Scope**: Create `schema.sql` covering all 10 tables from the schema ADR and an `initDb` helper that applies it idempotently. No persistence wiring — this story only defines the schema and the initialisation entry point.

**Read list**:
- `product-documentation/architecture/20260620T000000Z-engineering-database-schema.md` — canonical DDL

**Tasks**:
- [ ] Create `packages/srs-engine-v2/src/persistence/schema.sql` — all 10 tables, `CREATE TABLE IF NOT EXISTS`, D1-compatible (no `AUTOINCREMENT`, no `PRAGMA`)
- [ ] Create `packages/srs-engine-v2/src/persistence/init-db.ts` — `initDb(db: Database): void`; reads and executes `schema.sql` as a single statement batch

**Acceptance criteria**:
- [ ] `schema.sql` matches schema ADR exactly for all 10 tables
- [ ] `initDb` is idempotent — calling twice on the same DB does not error
- [ ] `pnpm --filter @gll/srs-engine-v2 typecheck` clean

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

**Scope**: Define `LearningStore` interface and implement it with `better-sqlite3`. All methods use prepared statements. Integration-tested with a temp DB.

**Read list**:
- `packages/srs-engine-v2/src/persistence/schema.sql` (ST02 output)
- `packages/srs-engine-v2/src/persistence/init-db.ts` (ST02 output)
- `packages/srs-engine-v2/src/types/word-state.ts`
- `packages/srs-engine-v2/src/types/sentence-state.ts`
- `packages/srs-engine-v2/package.json`

**Tasks**:
- [ ] Add `better-sqlite3` + `@types/better-sqlite3` to `package.json`
- [ ] Create `packages/srs-engine-v2/src/persistence/learning-store.ts` — `LearningStore` interface
- [ ] Create `packages/srs-engine-v2/src/persistence/sqlite-learning-store.ts` — `SqliteLearningStore`:
  - [ ] Constructor: accepts DB path; calls `initDb`; prepares all statements
  - [ ] `getAllWordStates(userId)`: `SELECT * FROM user_word_states WHERE user_id = ?` → `Map<string, WordState>`
  - [ ] `upsertWordState(userId, state)`: `INSERT OR REPLACE INTO user_word_states`
  - [ ] `getAllSentenceStates(userId)`: `SELECT * FROM user_sentence_states WHERE user_id = ?` → `Map<string, SentenceState>`
  - [ ] `upsertSentenceState(userId, state)`: `INSERT OR REPLACE INTO user_sentence_states`
  - [ ] `close()`: `db.close()`
- [ ] Create `packages/srs-engine-v2/src/__tests__/integration/sqlite-learning-store.test.ts`:
  - [ ] Upsert then getAll returns same `WordState` (all fields including `lapses`)
  - [ ] Upsert then getAll returns same `SentenceState` (`active: false`, `lastBatchSeen: -1` preserved)
  - [ ] Second upsert with same `(userId, wordId)` overwrites — no duplicate rows
  - [ ] `getAll*` returns all rows after multiple upserts
  - [ ] `user_id` column populated correctly
  - [ ] Temp DB file deleted in `afterAll`
- [ ] Export `LearningStore`, `SqliteLearningStore` from `packages/srs-engine-v2/src/index.ts`

**Acceptance criteria**:
- [ ] All integration tests pass: `pnpm --filter @gll/srs-engine-v2 test`
- [ ] `pnpm --filter @gll/srs-engine-v2 typecheck` clean

---

### EP30-ST05: Wire `learning-runner.ts` — Load, Write-on-Answer, Close

**Scope**: Replace the `ENABLE_MOCK_DB` JSON shim with `SqliteLearningStore`. Load state on startup. Pass `onWordAnswer` / `onSentenceAnswer` callbacks for write-on-answer. Delete the shim entirely.

**Read list**:
- `packages/srs-engine-v2/demo/learning-runner.ts`
- `packages/srs-engine-v2/demo/learning-io.ts` (ST01 output)
- `packages/srs-engine-v2/demo/config.ts`
- `packages/srs-engine-v2/src/persistence/sqlite-learning-store.ts` (ST04 output)

**Tasks**:
- [ ] `demo/learning-io.ts`: add `onWordAnswer?: (state: WordState) => void` and `onSentenceAnswer?: (state: SentenceState) => void` to `runAdaptiveLoop` signature; call `onWordAnswer` after each word answer is processed inside the batch loop; call `onSentenceAnswer` after each sentence answer
- [ ] `demo/learning-runner.ts`:
  - [ ] Remove `ENABLE_MOCK_DB`, `STATE_FILE`, `loadRunState()`, `saveRunState()`
  - [ ] Open `SqliteLearningStore('data/learning-state.db')` at startup
  - [ ] Load `RunState` via `store.getAllWordStates('cli-user')`
  - [ ] Load `SentenceRunState` via `store.getAllSentenceStates('cli-user')`
  - [ ] Pass `onWordAnswer: (ws) => store.upsertWordState('cli-user', ws)` to `runAdaptiveLoop`
  - [ ] Pass `onSentenceAnswer: (ss) => store.upsertSentenceState('cli-user', ss)` to `runAdaptiveLoop`
  - [ ] Call `store.close()` after loop exits
  - [ ] Add `data/learning-state.db` to `.gitignore`
- [ ] `demo/config.ts`: remove `ENABLE_MOCK_DB`

**Acceptance criteria**:
- [ ] `pnpm learnv2` runs; exit and re-run — prior word mastery levels restored
- [ ] Re-run — `SentenceRunState` (streak, `lastBatchSeen`) also restored
- [ ] Mid-session quit after answering some words — those words are in DB on next launch (write-on-answer)
- [ ] `sqlite3 data/learning-state.db "SELECT * FROM user_word_states"` shows rows with `user_id = 'cli-user'`
- [ ] `ENABLE_MOCK_DB` does not appear anywhere in the codebase
- [ ] All existing tests pass: `pnpm --filter @gll/srs-engine-v2 test`
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

## 7. Open Questions

| # | Question | Severity | Status |
|---|---|---|---|
| OQ1 | Where exactly in the batch loop does `onWordAnswer` fire — after `finishBatch` or per-answer inside `runInteractive`/`runAuto`? Needs reading into `runBatch` internals to identify the right hook point. | Medium | Open — resolve in ST05 |
| OQ2 | `lapses` field: does `WordState` already have it (per Review Phase ADR §7) or does ST04 need to add it? | Low | Open — check `word-state.ts` in ST03/ST04 read list |
| OQ3 | `data/learning-state.db` path — relative to repo root or `packages/srs-engine-v2/`? Decide in ST05 and add to `.gitignore` accordingly. | Low | Open — resolve in ST05 |

---

## 8. Success Criteria

1. `pnpm learnv2` persists `RunState` and `SentenceRunState` to `data/learning-state.db` between sessions
2. Re-launching restores prior mastery and sentence history — no data lost on clean exit
3. Mid-session quit does not lose answered progress
4. `ENABLE_MOCK_DB` and JSON flat-file helpers deleted
5. `LearningStore`, `SqliteLearningStore`, `GraduationHook` exported from `@gll/srs-engine-v2`
6. Full 10-table schema in `schema.sql`, D1-compatible
7. All existing EP25 / EP20 unit tests pass unchanged
8. `better-sqlite3` is the only new runtime dependency
