# EP30-ST06: `cli-demo-db` DB-backed Runner

**Date**: 2026-06-21
**Status**: Ready — depends on ST05
**Epic**: EP30 — Persistent Storage Layer
**DS01 ref**: §5 Story EP30-ST06

---

## Summary

Create `apps/cli-demo-db/src/learning-runner-db.ts` that queries vocabulary and sentence curriculum from the DB (populated by ST05 import), loads learner state via `SqliteLearningStore`, and passes both into a duplicated `runAdaptiveLoop`. Add DB management utilities (`db-tools.ts`), fixture seeding (`db-fixtures.ts`), and app config (`config.ts`). Rename `learnv2` → `engine:mock-db` in the original package. No write-on-answer persistence in ST06 — callbacks are no-op stubs (wired in ST07).

---

## Data Mapping: DB → Engine Types

| DB table | Engine type | Notes |
|---|---|---|
| `words` | `MockWord` | UUID as `id`; parse `senses[0]` JSON for `romanization`/`english`/`type` |
| `foundational_words` | `MockFoundational` | Loaded from TS source (`thai-full-foundations.ts`), not DB — DB lacks `class` field needed for `MockConsonant` |
| `sentences` + `sentence_components` | `SentenceContext` | `sentenceId` = sentence UUID; `wordOrder` = component word_ids ordered by position |
| `user_word_states` | `RunState` | Via `store.getAllWordStates('cli-user')` — already correct in `SqliteLearningStore` |
| `user_sentence_states` | `SentenceRunState` | Via `store.getAllSentenceStates('cli-user')` |

**`wordPool`**: all rows from `words` table (full pool for MCQ distractor generation).

**`words` arg to `runAdaptiveLoop`**: same as `wordPool` — all vocabulary, no deck filtering in ST06.

**`recheckIds`**: words in `initialRunState` where `mastery >= masteryThreshold`.

---

## Key Design Decisions

### 1. Corpus injection via parameter

The duplicated `learning-io.ts` removes the module-level `mockCorpus` constant (which was built from the mock deck files). Instead, `runAdaptiveLoop` in the duplicate accepts a `corpus: SentenceContext[]` parameter and passes it into `resolveEligibleContexts`. The original `srs-engine-v2/demo/learning-io.ts` is untouched.

### 2. Foundational words loaded from TS source, not DB

`foundational_words` in the DB lacks the `class: 'middle' | 'high' | 'low'` field required by `MockConsonant`. The DB column was intentionally omitted in the schema (not in scope for EP30). The runner loads foundational words via dynamic import of `thai-full-foundations.ts` directly from `packages/srs-engine-v2/data/seed-data/`, identical to how ST05's `importCurriculumWithFoundations` works. This is acceptable because foundations are static curriculum.

### 3. No-op callbacks in ST06

`runAdaptiveLoop` in ST06's duplicate does not have `onWordAnswer`/`onSentenceAnswer` parameters yet — those are added in ST07. The ST06 runner calls `runAdaptiveLoop` without callbacks; learner state is loaded at startup but not written back during the session.

### 4. Fixture UUID resolution at seed time

`db-fixtures.ts` exports fixture definitions as functions `(db: DbClient) => WordState[]`. The functions look up word UUIDs by `(language='th', text)` at the time `seedDb()` is called — not hardcoded. This means fixtures require curriculum to be imported first (ST05 must have run).

### 5. `resetDb` schema-only

`resetDb(dbPath)` calls `closeDb()`, deletes the file, then `getDb(dbPath)` (which runs `initDb`). Curriculum is not re-imported — user must run `engine:import-curriculum` again after reset.

---

## Fixtures

### `baseline`
Empty — calls `clearUserState('cli-user')` only. No `user_word_states` rows.

### `mid-session`
4 words from the "let's eat something" conversation at mixed mastery levels. Resolve UUIDs by `(language='th', text)` lookup.

| Thai | English | seen | correct | mastery | correctStreak | wrongStreak | lapses |
|---|---|---|---|---|---|---|---|
| หิว | hungry | 3 | 2 | 1 | 1 | 0 | 0 |
| กิน | eat | 2 | 2 | 2 | 2 | 0 | 0 |
| ไป | go | 2 | 1 | 0 | 0 | 1 | 0 |
| ดี | good | 1 | 0 | 0 | 0 | 1 | 0 |

### `sentence-ready`
All 6 component words of the first sentence in the "let's eat something" conversation (`หิวแล้ว ไปกินอะไรกัน?`), each with `seen=2, correct=2, mastery=2`. This meets `minSeenForSentence: 2`, triggering sentence eligibility.

| Thai | English |
|---|---|
| หิว | hungry |
| แล้ว | already |
| ไป | go |
| กิน | eat |
| อะไร | what |
| กัน | together |

---

## Files to Create

| File | Purpose |
|---|---|
| `apps/cli-demo-db/src/config.ts` | Duplicate of `srs-engine-v2/demo/config.ts` — no `ENABLE_MOCK_DB` |
| `apps/cli-demo-db/src/auto-answer-strategy.ts` | Verbatim copy of `srs-engine-v2/demo/auto-answer-strategy.ts` (imports changed to `@gll/srs-engine-v2`) |
| `apps/cli-demo-db/src/auto-answerer.ts` | Verbatim copy of `srs-engine-v2/demo/auto-answerer.ts` (imports changed to `@gll/srs-engine-v2`) |
| `apps/cli-demo-db/src/db-query.ts` | `buildQuizItems(db)`, `buildFoundationalPool()`, `buildSentenceCorpus(db)` |
| `apps/cli-demo-db/src/learning-io.ts` | Duplicate of `srs-engine-v2/demo/learning-io.ts` — corpus injected via parameter |
| `apps/cli-demo-db/src/db-fixtures.ts` | `baseline`, `mid-session`, `sentence-ready` fixture definitions |
| `apps/cli-demo-db/src/db-tools.ts` | `clearUserState`, `resetDb`, `seedDb` |
| `apps/cli-demo-db/src/db-tools-cli.ts` | Thin CLI wrapper — parses argv and calls db-tools |
| `apps/cli-demo-db/src/learning-runner-db.ts` | Main DB-backed runner entrypoint |

## Files to Modify

| File | Change |
|---|---|
| `apps/cli-demo-db/package.json` | Add all `engine:real-db*` and `engine:mock-db` scripts |
| `packages/srs-engine-v2/package.json` | Rename `learnv2` → `engine:mock-db` |
| Root `package.json` | Rename `learnv2` → `engine:mock-db` |

## Files to Leave Untouched

| File | Why |
|---|---|
| `packages/srs-engine-v2/demo/learning-runner.ts` | Original mock runner — must stay working |
| `packages/srs-engine-v2/demo/learning-io.ts` | Library boundary — duplicated, not modified |
| `packages/srs-engine-v2/demo/config.ts` | Original config — duplicated |
| `packages/db/src/*` | ST04 output — no changes |
| `apps/cli-demo-db/src/import-curriculum.ts` | ST05 output — no changes |

---

## Test Plan (in order)

All tests live in `apps/cli-demo-db/src/__tests__/`.

### `db-query.test.ts`

1. **`buildQuizItems` returns `MockWord[]` with UUID ids and required fields** — import curriculum into in-memory DB, call `buildQuizItems(db)`, verify: `id` matches UUID regex, `native` / `romanization` / `english` / `type` / `language` all non-empty.

2. **`buildQuizItems` returns distinct items — no duplicates** — count items, compare to `new Set(items.map(i => i.id)).size`.

3. **`buildSentenceCorpus` returns `SentenceContext[]` with non-empty `wordOrder`** — import curriculum, call `buildSentenceCorpus(db)`, verify each entry has `sentenceId` (UUID regex), `englishSentence` non-empty, `wordOrder.length > 0`.

4. **`buildSentenceCorpus` wordOrder entries are word UUIDs that exist in words table** — cross-reference all `wordOrder` values against `buildQuizItems(db)` ids.

5. **`buildSentenceCorpus` skips conversations with empty breakdown** — only 2 of 5 conversations have breakdowns; verify corpus count matches sentence rows in DB.

### `db-tools.test.ts`

6. **`clearUserState` removes all learner state for the given userId** — upsert a `WordState`, call `clearUserState(db, 'cli-user')`, verify `getAllWordStates('cli-user')` returns empty map.

7. **`clearUserState` does not remove state for a different userId** — upsert state for `'other-user'`, clear `'cli-user'`, verify `'other-user'` state untouched.

8. **`seedDb('baseline', db)` leaves zero word state rows** — import curriculum, seed baseline, verify `user_word_states` count = 0.

9. **`seedDb('mid-session', db)` inserts 4 word states with correct mastery values** — import curriculum, seed mid-session, verify 4 rows; check mastery values match fixture definition.

10. **`seedDb('sentence-ready', db)` inserts 6 word states all with `seen >= 2`** — import curriculum, seed sentence-ready, verify 6 rows all have `seen >= 2` and `mastery >= 2`.

11. **`seedDb` is idempotent — calling twice gives same row count** — seed mid-session twice, verify same 4 rows.

12. **`seedDb('unknown-fixture', db)` throws** — expect `Error` with message containing fixture name.

---

## Implementation Steps (in order)

1. **`config.ts`** — copy `LEARNING_CONFIG` and `STREAK_THRESHOLDS` from `srs-engine-v2/demo/config.ts`; set `AUTO_MODE = false`; omit `ENABLE_MOCK_DB`.

2. **`auto-answer-strategy.ts`** — copy verbatim; change `from '../src/index.js'` → `from '@gll/srs-engine-v2'`.

3. **`auto-answerer.ts`** — copy verbatim; change `from '../src/index.js'` → `from '@gll/srs-engine-v2'`.

4. **`db-query.ts`** — implement:
   ```ts
   export function buildQuizItems(db: DbClient): MockWord[]
   export async function buildFoundationalPool(): Promise<MockFoundational[]>
   export function buildSentenceCorpus(db: DbClient): SentenceContext[]
   ```
   - `buildQuizItems`: `db.select().from(schema.words).all()` → parse `senses` JSON → `MockWord[]`
   - `buildFoundationalPool`: dynamic import `thai-full-foundations.ts` → flatten consonants + vowels + tones
   - `buildSentenceCorpus`: query `sentences`, then for each sentence query `sentence_components` ordered by `position` → `SentenceContext[]`

5. **`learning-io.ts`** — copy `srs-engine-v2/demo/learning-io.ts` verbatim then:
   - Change all `from '../src/index.js'` imports → `from '@gll/srs-engine-v2'`
   - Remove `import { mockDecks } from '../data/mock/mock-decks.js'`
   - Remove `const mockCorpus: SentenceContext[] = ...` module-level constant
   - Add `corpus: SentenceContext[]` parameter to `runAdaptiveLoop` (before `strategy?`)
   - Replace `mockCorpus` references in `runBatch` with the passed `corpus`
   - Pass `corpus` through from `runAdaptiveLoop` → `runBatch`

6. **`db-fixtures.ts`** — define:
   ```ts
   type FixtureFn = (db: DbClient) => WordState[]
   export const fixtures: Record<string, FixtureFn> = { baseline, 'mid-session': midSession, 'sentence-ready': sentenceReady }
   ```
   Each fixture function resolves word UUIDs via `db.select().from(schema.words).where(and(eq(schema.words.language, 'th'), eq(schema.words.text, thaiText))).get()`.

7. **`db-tools.ts`** — implement:
   ```ts
   export function clearUserState(db: DbClient, userId: string): void
   export function resetDb(dbPath: string): void   // closeDb + unlink + getDb
   export function seedDb(fixtureName: string, db: DbClient, userId: string = 'cli-user'): void
   ```
   `seedDb`: look up fixture in `fixtures` map, throw if missing, call `clearUserState`, then `store.upsertWordState` for each returned `WordState`.

8. **`db-tools-cli.ts`** — parse `process.argv[2]` (`clear` | `reset` | `seed`) and `process.argv[3]` (fixture name for seed). Wire to `db-tools` functions. Use `GLL_DB_PATH` env var.

9. **`learning-runner-db.ts`** — main entrypoint:
   ```ts
   const DB_PATH = process.env.GLL_DB_PATH ?? './data/learning-state.db'
   const db = getDb(DB_PATH)
   const store = new SqliteLearningStore(db)
   const words = buildQuizItems(db)
   const wordPool = words          // same pool
   const foundationalPool = await buildFoundationalPool()
   const corpus = buildSentenceCorpus(db)
   const initialRunState = store.getAllWordStates('cli-user')
   const initialSentenceRunState = store.getAllSentenceStates('cli-user')
   const recheckIds = new Set([...initialRunState.entries()]
     .filter(([, ws]) => ws.mastery >= LEARNING_CONFIG.masteryThreshold)
     .map(([id]) => id))
   const strategy = AUTO_MODE ? new CorrectAutoAnswerStrategy() : undefined
   await runAdaptiveLoop(words, wordPool, foundationalPool, LEARNING_CONFIG.wordsPerBatch,
     LEARNING_CONFIG.masteryThreshold, STREAK_THRESHOLDS,
     initialRunState, initialSentenceRunState, recheckIds, strategy, corpus)
   closeDb()
   ```

10. **`apps/cli-demo-db/package.json`** — add scripts:
    ```json
    "engine:real-db":                  "tsx src/learning-runner-db.ts",
    "engine:real-db:clear":            "tsx src/db-tools-cli.ts clear",
    "engine:real-db:reset":            "tsx src/db-tools-cli.ts reset",
    "engine:real-db:seed:baseline":    "tsx src/db-tools-cli.ts seed baseline",
    "engine:real-db:seed:mid-session": "tsx src/db-tools-cli.ts seed mid-session",
    "engine:real-db:seed:sentence-ready": "tsx src/db-tools-cli.ts seed sentence-ready"
    ```

11. **`packages/srs-engine-v2/package.json`** — rename `"learnv2"` → `"engine:mock-db"`.

12. **Root `package.json`** — rename `"learnv2"` → `"engine:mock-db"`.

---

## Acceptance Criteria

- [ ] `pnpm engine:import-curriculum && pnpm --filter cli-demo-db engine:real-db` runs — loads zero learner state on fresh DB, enters session
- [ ] `pnpm --filter cli-demo-db engine:real-db:seed:mid-session` then `engine:real-db` — loaded word states passed into `runAdaptiveLoop` as `initialRunState`; session reflects partial progress
- [ ] `pnpm --filter cli-demo-db engine:real-db:seed:sentence-ready` then `engine:real-db` — sentence question appears in first batch
- [ ] `pnpm --filter cli-demo-db engine:real-db:clear` exits cleanly; `user_word_states` count = 0
- [ ] `pnpm --filter cli-demo-db engine:real-db:reset` deletes DB file and reinitialises schema
- [ ] `pnpm --filter @gll/srs-engine-v2 engine:mock-db` still works unchanged (renamed script)
- [ ] `pnpm --filter cli-demo-db test` — all 12 tests pass
- [ ] `pnpm --filter cli-demo-db typecheck` clean

---

## Risks and Unknowns

1. **`printWordSummary` displays raw UUIDs** — the original strips `'th::'` prefix for display. DB words use UUID ids; the summary will show raw UUIDs. Acceptable for ST06 — display improvement is post-MVP.

2. **Distractor pool thinness** — only 49 words in the DB. MCQ needs 4 choices (1 correct + 3 distractors). `composeWordBatch` already handles pools < 4 gracefully — it takes as many distractors as available. No action needed.

3. **Sentence corpus coverage** — 3 of 5 conversations have empty `breakdown`, so `buildSentenceCorpus` will return sentences only for `let's eat something`, `The weather is hot today`, and `Where is the post office`. The `sentence-ready` fixture targets the first sentence of `let's eat something` — this is verified to have 6 components in the DB.

4. **`foundationalPool` type cast** — `ThaiConsonant` (from foundations TS file) is structurally compatible with `MockConsonant` but TypeScript may complain about the nominal difference. A `as MockFoundational[]` cast may be needed.

5. **`resetDb` file path** — `unlinkSync` on a non-existent file throws. Should guard with `existsSync` before deleting.
