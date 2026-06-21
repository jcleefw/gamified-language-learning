# EP30 — Persistent Storage Layer

**Created**: 2026-06-20
**Status**: Draft

<!-- Status: Draft | Accepted | In Progress | Impl-Complete | BDD Pending | Completed | Shelved | Withdrawn -->

**Type**: Epic Plan
**Depends on**: EP25 (ST01–ST12 complete)
**Parallel with**: N/A
**Predecessor**: N/A

---

## Problem Statement

`srs-engine-v2` is stateless between sessions. `RunState` and `SentenceRunState` live only in memory — when the process exits, all learning history is lost. The demo runner has a hand-rolled `ENABLE_MOCK_DB` shim that serialises only `RunState` to a JSON flat file; `SentenceRunState` is never persisted and is recreated empty each run.

EP21 (Review Phase / FSRS) is **blocked** until persistence is solid: `review_cards.due <= now` is meaningless if word history never survives a session.

Beyond learner state, the system has no schema for its content domain — decks, sentences, and words currently live in hardcoded mock files. EP30 establishes the full DB schema across all domains and wires learner state persistence into the CLI demo.

---

## Schema Authority

The complete schema is defined in:

**[`product-documentation/architecture/20260620T000000Z-engineering-database-schema.md`](../../product-documentation/architecture/20260620T000000Z-engineering-database-schema.md)**

All story-level DDL in this epic plan is derived from that ADR. If there is a conflict, the ADR wins.

---

## Scope

**In scope**:

- DB initialisation helper — creates all tables on first run (idempotent `CREATE TABLE IF NOT EXISTS`)
- `LearningStore` interface — domain-owned, no storage technology implied
- `SqliteLearningStore` implementation — `better-sqlite3`, covering `user_word_states` and `user_sentence_states`
- Serialisation helpers for `Map` / `Set` in the engine package
- Wire `learning-runner.ts` to `SqliteLearningStore` — load and save `RunState` + `SentenceRunState`; write-on-answer per answered word/sentence
- `runAdaptiveLoop` returns `SentenceRunState` alongside `RunState` — currently `sentenceRunState` is a local variable never returned
- `GraduationHook` stub — seam for EP21 to attach FSRS seeding
- Replace `ENABLE_MOCK_DB` JSON shim; delete `STATE_FILE`, `loadRunState`, `saveRunState`
- SQLite schema is D1-compatible

**Out of scope**:

- Content domain tables (`decks`, `sentences`, `words`, `sentence_components`, `deck_words`) — schema defined in ADR but import tooling is a separate epic
- `foundational_words` import flow — separate epic
- `users` table and auth — app layer concern
- `review_cards` table — EP21
- Remote / D1 persistence — EP21 or later
- Hono API wiring — separate epic
- Sense-level mastery (`word_senses` table) — deferred per schema ADR OQ1

---

## Package Structure

This epic spans two packages:

- **`@gll/db`** — Database initialization, migrations, and schema (ST02, ST02b)
  - Application-owned: DB setup is not a library concern
  - Contains Drizzle config, migrations, and DB client initialization
  - Exported for use by applications (CLI, servers) that need persistence
  
- **`@gll/srs-engine-v2`** — Learning engine, serialization helpers, learning store interface (ST01, ST03, ST04, ST05, ST06, ST07)
  - DB-agnostic: engine has no direct DB dependencies
  - `LearningStore` interface allows different persistence backends
  - Serialization helpers are engine concerns (type conversions)

---

## Key Design Points

**`SentenceRunState` is currently never returned by `runAdaptiveLoop`.**
`sentenceRunState` is a local `new Map()` created at line 311 of `learning-io.ts` and discarded when the function returns. EP30-ST01 adds it to the return value before any persistence story touches it.

**Write-on-answer**: `user_word_states` and `user_sentence_states` are upserted after every answered question. The engine loop calls the store after each answer — not at batch end, not at session end. This requires the store to be passed into or accessible from the loop.

**Session resume via reconstruction**: on next launch, `active[]` and `queue[]` are rebuilt from `user_word_states` — no session snapshot table.

**Multi-user from day one**: `user_id` on all learner state tables. CLI hardcodes `'cli-user'`. No code change needed when Hono/auth arrives.

---

## Stories

### EP30-ST01: Return `SentenceRunState` from `runAdaptiveLoop`

**Why first**: every downstream story that persists sentence state depends on having access to it. This is a pure engine change with no DB involved.

**Scope**: Change `runAdaptiveLoop` in `demo/learning-io.ts` to return both `RunState` and `SentenceRunState`. Update the call site in `learning-runner.ts` to destructure the new return value. No DB, no schema, no serialisation — just plumbing.

**Files changed**:
- `packages/srs-engine-v2/demo/learning-io.ts` — change return type to `{ runState: RunState; sentenceRunState: SentenceRunState }`
- `packages/srs-engine-v2/demo/learning-runner.ts` — destructure new return; update `saveRunState` call

**Acceptance criteria**:
- [ ] `runAdaptiveLoop` returns `{ runState, sentenceRunState }`
- [ ] `learning-runner.ts` compiles and `pnpm learnv2` runs without error
- [ ] All existing tests pass: `pnpm --filter @gll/srs-engine-v2 test`
- [ ] `pnpm --filter @gll/srs-engine-v2 typecheck` clean

---

### EP30-ST02: Drizzle Schema Definition

**Scope**: Define all tables from the schema ADR using Drizzle ORM TypeScript schema. This story does not wire any persistence or migrations — it only defines the schema in code. **Schema lives in `@gll/db` package, not the engine**, since DB setup is an application concern, not a library concern.

**Tables covered** (via Drizzle schema):
- `users`, `decks`, `words`, `foundational_words`
- `sentences`, `sentence_components`, `deck_words`
- `user_word_states`, `user_sentence_states`
- `review_cards`

**Files added/changed**:
- `packages/db/src/schema.ts` — Drizzle schema definition for all tables (TypeScript)
- `packages/srs-engine-v2/package.json` — add `drizzle-orm` as dependency

**Acceptance criteria**:
- [ ] `schema.ts` maps all tables from schema ADR exactly — no missing columns, correct types
- [ ] Schema lives in `@gll/db` package, not `@gll/srs-engine-v2` (engine is DB-agnostic)
- [ ] Drizzle schema compiles and passes typecheck
- [ ] All table schemas use `sqliteTable` (SQLite dialect)
- [ ] `pnpm --filter @gll/db typecheck` clean

---

### EP30-ST02b: Migration Infrastructure + Init DB Helper

**Scope**: Set up Drizzle migration infrastructure and create `initDb` helper that applies all pending migrations idempotently. **All files live in `@gll/db` package.**

**Files added/changed**:
- `packages/db/src/db.ts` — Database client initialization for better-sqlite3
- `packages/db/drizzle.config.ts` — Drizzle config pointing to schema + migrations directory
- `packages/db/drizzle/migrations/` *(new directory)* — generated .sql migration files
- `packages/db/src/init-db.ts` — `initDb(db: DatabaseConnection)` applies all pending migrations
- `packages/db/package.json`:
  - Add `drizzle-kit` as devDependency
  - Add `db:generate` script: `drizzle-kit generate`
  - Add `db:push` script: applies pending migrations to local DB for verification

**Migration workflow**:
- After `schema.ts` changes, run `pnpm --filter @gll/db db:generate` to generate a new numbered `.sql` migration file (e.g., `0001_initial_schema.sql`)
- `pnpm --filter @gll/db db:push` applies pending migrations locally (optional verification step)
- Same `.sql` files are pushed to Cloudflare D1 via `wrangler d1 migrations apply`

**Acceptance criteria**:
- [ ] `drizzle.config.ts` is valid and points to correct schema + migrations directory
- [ ] `pnpm --filter @gll/db db:generate` creates a numbered `.sql` migration file that is D1-compatible (no `AUTOINCREMENT`, no SQLite-only syntax)
- [ ] First migration includes all tables from `schema.ts`
- [ ] `initDb` applies all pending migrations idempotently — safe to call on a DB that already has tables
- [ ] `pnpm --filter @gll/db db:push` runs without error and applies migrations to temp test DB
- [ ] `pnpm --filter @gll/db typecheck` clean
- [ ] `@gll/srs-engine-v2` has no drizzle-orm or drizzle-kit dependencies

---

### EP30-ST03: Serialisation Helpers for `Map` and `Set`

**Scope**: Pure serialisation/deserialisation helpers for types that don't survive `JSON.stringify`. These convert engine types ↔ JSON for persistence. Unit-tested with round-trip assertions. **Stays in `@gll/srs-engine-v2`** — these are engine concerns, not DB concerns.

**Files added**:
- `packages/srs-engine-v2/src/persistence/serialise.ts`
  - `serialiseRunState` / `deserialiseRunState` — `Map<string, WordState>` ↔ JSON
  - `serialiseSentenceRunState` / `deserialiseSentenceRunState` — `Map<string, SentenceState>` ↔ JSON
  - `serialiseSet` / `deserialiseSet` — `Set<string>` ↔ JSON (for future use; recheck sets not persisted in EP30)
- `packages/srs-engine-v2/src/__tests__/unit/serialise.test.ts`

**Acceptance criteria**:
- [ ] Round-trip: `deserialise(serialise(x))` equals `x` for all types
- [ ] Empty `Map` / `Set` serialises cleanly
- [ ] All `WordState` fields preserved (including `lapses`)
- [ ] `SentenceState` `active: false` and `lastBatchSeen: -1` sentinel preserved
- [ ] Serialised output is valid JSON
- [ ] Tests pass: `pnpm --filter @gll/srs-engine-v2 test`
- [ ] `pnpm --filter @gll/srs-engine-v2 typecheck` clean

---


### EP30-ST05: New `learning-runner-db.ts` and DB Management Scripts

**Scope**: Create a new `demo/learning-runner-db.ts` that initializes the DB and loads learner state. `learning-runner.ts` is **not changed** — it stays exactly as-is with `ENABLE_MOCK_DB` and the JSON shim intact. Add DB management utilities (clear/reset/seed) and rename scripts in `package.json`.

**Script names**:
- `engine:mock-db` — runs `learning-runner.ts` (existing, unchanged)
- `engine:real-db` — runs `learning-runner-db.ts` (new)
- `engine:real-db:clear` — delete all learner state (user_word_states, user_sentence_states) for 'cli-user'
- `engine:real-db:reset` — drop DB file and reinitialize schema from migrations
- `engine:real-db:seed:<name>` — seed DB to a known fixture state (e.g., "word A at mastery 1, word B at mastery 2")

**Files changed/added**:
- `packages/srs-engine-v2/demo/learning-runner-db.ts` *(new)*:
  - Initialize Drizzle DB client and apply migrations via `initDb`
  - Load `RunState` + `SentenceRunState` via `store.getAllWordStates('cli-user')` / `store.getAllSentenceStates('cli-user')`
  - Call `runAdaptiveLoop` (callbacks wired in ST06)
  - Call `store.close()` on exit
- `packages/srs-engine-v2/demo/db-tools.ts` *(new)*:
  - `clearUserState(userId: string)` — DELETE from learner tables for that user
  - `resetDb()` — drop DB file, reinitialize from migrations
  - `seedDb(fixtureName: string)` — apply named fixture (e.g., "initial-mastery-1", "mid-session")
- `packages/srs-engine-v2/demo/db-fixtures.ts` *(new)*:
  - Named fixture objects: `{ name, description, wordStates: [...], sentenceStates: [...] }`
  - At least 2 fixtures: baseline (empty), mid-session (some words at various mastery levels)
- `packages/srs-engine-v2/package.json`:
  - Rename existing script to `engine:mock-db`
  - Add `engine:real-db`, `engine:real-db:clear`, `engine:real-db:reset`, `engine:real-db:seed` scripts

**Acceptance criteria**:
- [ ] `pnpm engine:real-db` runs (will not persist yet — ST06 adds callbacks)
- [ ] `pnpm engine:real-db:clear` removes all learner state for 'cli-user'; exits cleanly
- [ ] `pnpm engine:real-db:reset` deletes DB file and reinitializes; exits cleanly
- [ ] `pnpm engine:real-db:seed:<name>` loads fixture; exits cleanly
- [ ] `pnpm engine:mock-db` still works — `learning-runner.ts` is unchanged
- [ ] `ENABLE_MOCK_DB` remains in `learning-runner.ts` and `config.ts` — not deleted
- [ ] `pnpm --filter @gll/srs-engine-v2 typecheck` clean

---

### EP30-ST06: `LearningStore` + Write-on-Answer Callbacks

**Scope**: Define the `LearningStore` domain interface, implement it using Drizzle ORM, and wire write-on-answer callbacks in `runAdaptiveLoop`. Covers `user_word_states` and `user_sentence_states` only — content tables are out of scope for this story. Integration-tested with a temp DB.

**`LearningStore` interface**:
```ts
export interface LearningStore {
  getAllWordStates(userId: string): Map<string, WordState>;
  upsertWordState(userId: string, state: WordState): void;

  getAllSentenceStates(userId: string): Map<string, SentenceState>;
  upsertSentenceState(userId: string, state: SentenceState): void;

  close(): void;
}
```

**Write-on-answer callbacks**:
```ts
// Added to runAdaptiveLoop signature:
onWordAnswer?: (state: WordState) => void;
onSentenceAnswer?: (state: SentenceState) => void;
```

Callbacks are invoked after each answered word/sentence inside the batch loop. `learning-runner-db.ts` passes closures that call `store.upsertWordState` / `store.upsertSentenceState`.

**Files added/changed**:
- `packages/srs-engine-v2/src/persistence/learning-store.ts` — `LearningStore` interface
- `packages/srs-engine-v2/src/persistence/drizzle-learning-store.ts` — `DrizzleLearningStore` implementing `LearningStore`; uses Drizzle query builder
- `packages/srs-engine-v2/src/__tests__/integration/drizzle-learning-store.test.ts`
- `packages/srs-engine-v2/src/index.ts` — export `LearningStore`, `DrizzleLearningStore`
- `packages/srs-engine-v2/demo/learning-io.ts`:
  - Add `onWordAnswer?: (state: WordState) => void` and `onSentenceAnswer?: (state: SentenceState) => void` to `runAdaptiveLoop` signature
  - Invoke callbacks after each answer is processed inside the batch loop
- `packages/srs-engine-v2/demo/learning-runner-db.ts`:
  - Wire callbacks: pass closures to `runAdaptiveLoop` that call `store.upsertWordState` / `store.upsertSentenceState`

**Acceptance criteria**:
- [ ] `upsert` then `getAll` returns the same `WordState` / `SentenceState`
- [ ] Second upsert with same `(userId, wordId)` overwrites — no duplicate rows
- [ ] `getAllWordStates` returns every row persisted in the session
- [ ] `SentenceState` `active: false` and `lastBatchSeen: -1` preserved through DB round-trip
- [ ] `user_id` column present and populated correctly
- [ ] Temp DB file deleted in `afterAll`
- [ ] Drizzle queries use type-safe schema (no raw SQL in store implementation)
- [ ] `pnpm engine:real-db` now persists — exit and re-run shows prior mastery restored
- [ ] Mid-session quit (Ctrl-C after answering) — answered words are already in DB on next launch
- [ ] All integration tests pass: `pnpm --filter @gll/srs-engine-v2 test`
- [ ] `pnpm --filter @gll/srs-engine-v2 typecheck` clean

---

### EP30-ST07: Graduation Hook Stub

**Scope**: At the end of `runAdaptiveLoop`, identify words that reached mastery this session and pass them to an optional `onGraduation` callback. This is the seam EP21 attaches `FsrsScheduler.seed` to. No FSRS logic here.

```ts
export type GraduationHook = (
  graduatedWordIds: string[],
  runState: RunState,
) => void;

// Added to runAdaptiveLoop signature:
onGraduation?: GraduationHook;
```

The hook compares the initial `RunState` (before the session) with the final `RunState` to identify words that crossed `masteryThreshold` this session.

**Files changed**:
- `packages/srs-engine-v2/demo/learning-io.ts` — add `onGraduation` param; call after loop exits with newly mastered IDs
- `packages/srs-engine-v2/demo/learning-runner.ts` — pass `(ids) => console.log('[INFO] Graduated:', ids)`
- `packages/srs-engine-v2/src/index.ts` — export `GraduationHook` type

**Acceptance criteria**:
- [ ] Running `pnpm learnv2` in auto mode logs graduated word IDs at session end
- [ ] Omitting `onGraduation` does not throw
- [ ] `GraduationHook` importable from `@gll/srs-engine-v2`
- [ ] All existing tests pass

---

## Story Order

```
ST01 → ST02 → ST02b → ST03 → ST04 → ST05 → ST06 → ST07
```

**Dependency breakdown**:
- ST01 (return `SentenceRunState`) — no dependencies, pure engine change
- ST02 (Drizzle schema def) — depends on ST01 (no hard dep, but logically prior)
- ST02b (migrations + initDb) — depends on ST02 (schema must be defined first)
- ST03 (serialisation helpers) — independent, can run parallel with ST02/ST02b
- ST04 (LearningStore) — depends on ST02b (needs migrations) + ST03 (needs serialisation)
- ST05 (learning-runner-db + DB tools) — depends on ST01, ST04
- ST06 (write-on-answer callbacks) — no hard dep, can parallel with ST04/ST05
- ST07 (graduation hook) — depends on ST05 (learning-runner-db must exist to wire the hook)

---

## Overall Acceptance Criteria

- [ ] Schema defined in Drizzle TypeScript (ST02), with migrations in `drizzle/migrations/*.sql` — D1-compatible (ST02b)
- [ ] `drizzle-orm` and `drizzle-kit` are new runtime/dev dependencies; `better-sqlite3` stays
- [ ] `LearningStore` interface exported from `@gll/srs-engine-v2` — EP21 can import and extend (ST06)
- [ ] Write-on-answer callbacks in `runAdaptiveLoop` (ST06)
- [ ] `pnpm engine:real-db` persists `RunState` and `SentenceRunState` between sessions (ST06)
- [ ] Re-launching restores prior mastery and sentence history — no data lost on clean exit (ST06)
- [ ] Mid-session quit does not lose answered progress (ST06)
- [ ] `pnpm engine:real-db:clear/reset/seed:<name>` provide test isolation utilities (ST05)
- [ ] `pnpm engine:mock-db` still works — `learning-runner.ts` and `ENABLE_MOCK_DB` shim unchanged (ST05)
- [ ] `GraduationHook` contract in place — EP21 can wire `FsrsScheduler.seed` with no change to the Learning runner (ST07)

---

## Dependencies

- EP25 complete (ST01–ST12) — `SentenceRunState`, `resolveEligibleContexts`, `updateSentenceRunState` must be in the engine

## References

- [Schema ADR](../../product-documentation/architecture/20260620T000000Z-engineering-database-schema.md) — canonical DDL and all schema decisions
- [Review Phase ADR](../../product-documentation/architecture/20260321T145300Z-engineering-srs-engine-v2-review-phase.md) — `review_cards` shape; write-on-answer; FSRS interface
- [EP21 Epic Plan](EP21-srs-engine-v2-revision-phase.md) — primary epic this unlocks
- [EP25 Epic Plan](EP25-srs-engine-composer-registry.md) — dependency
- `packages/srs-engine-v2/demo/learning-runner.ts` — current JSON shim being replaced
- `packages/srs-engine-v2/demo/learning-io.ts` — `runAdaptiveLoop` entry point
