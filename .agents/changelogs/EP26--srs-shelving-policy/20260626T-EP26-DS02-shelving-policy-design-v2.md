# EP26-DS02: Shelving Policy Design Specification v2

**Date**: 20260626T
**Status**: Draft
**Epic**: [EP26 - SRS Shelving Policy](../../plans/epics/EP26-srs-shelving-policy.md)
**Supersedes**: [DS01](20260626T004213Z-EP26-DS01-shelving-policy-design.md)

---

## 1. Feature Overview

A shelving system that detects words a learner is stuck on and temporarily removes them from quizzing, keeping the session engaging. Shelving is **deck-scoped** — a word shelved in one deck does not affect another deck. Stagnation is tracked via **persistent counters** on a per-user-per-deck-per-word basis.

**Package dependency graph:**
```
Host (srs-demo / CLI)
  ├── @gll/srs-engine-v2   (batch assembly, mastery, session)
  ├── @gll/srs-shelving     (shelving policy types + cap enforcement)
  └── @gll/db               (persistence: stagnation counters, shelved state)
```

`@gll/srs-shelving` contains only policy types and the cap-enforcement function. Stagnation detection is the DB layer's responsibility (counter comparison on write).

---

## 2. Design Decisions

These were resolved during planning and supersede DS01 assumptions.

| Decision | DS01 | DS02 (this doc) | Rationale |
| --- | --- | --- | --- |
| Stagnation tracking | In-memory `MasteryHistory` map + pure `detectStagnantWords` function | Persistent `stagnation_count` + `last_boundary_mastery` counters on `user_deck_word_tracking` table | Leaner — same detection accuracy, no row accumulation, BDD-seedable, survives mid-session refresh |
| Shelving scope | Per-user (no deck awareness) | Per-user-per-deck | Mastery is global but stagnation context is deck-local. Shelving in deck A shouldn't leak to deck B |
| `MasteryHistory` persistence | Ephemeral (in-memory, lost on refresh) | N/A — replaced by counters | Counters persist by design. No separate history lifecycle to manage |
| `@gll/srs-shelving` surface | Types + `recordMasterySnapshot` + `detectStagnantWords` + `evaluateShelving` + `unshelveAll` | Types + `evaluateShelving` + `unshelveAll` only | Detection moves to DB layer (counter increment/reset). Package shrinks to pure policy |

---

## 3. Core Requirements

| Requirement | Decision | Rationale |
| --- | --- | --- |
| Stagnation trigger | `stagnation_count >= stagnationBatchWindow` (default: 3) | Catches words that oscillate without climbing |
| Stagnation tracking | Counter incremented at batch boundary when mastery unchanged; reset when mastery changes | Minimal state — two columns, updated in place |
| Shelving cap | Configurable `maxShelved` (default: 2) per deck | Prevents session from thinning too much |
| Slot consumption | Shelved words hold their active slot | Prevents new-word flooding when struggling |
| Unshelving | Session-scoped — all shelved words unshelve on new session start (per deck) | Spacing effect comes from real time between sessions |
| Engine change | `assembleBatch` accepts `excludeIds: Set<string>` | Minimal invasion; engine skips excluded IDs during question generation but keeps them in active array |
| Persistence | Deck-scoped tables: `user_deck_word_tracking` for counters, `user_shelved_words` for shelved state | Survives app restart; host reconstructs shelved set on session resume |
| Library boundary | Policy types + cap enforcement in `@gll/srs-shelving`; counter logic in `@gll/db` | Engine remains pure; shelving package stays lean |

---

## 4. Data Structures

### 4.1 Shelving package types (`@gll/srs-shelving`)

```typescript
// packages/srs-shelving/src/types.ts

export interface ShelvingConfig {
  /** Number of batches without mastery progress before shelving. Default: 3 */
  stagnationBatchWindow: number;
  /** Maximum words shelved simultaneously per deck. Default: 2 */
  maxShelved: number;
}

export const DEFAULT_SHELVING_CONFIG: ShelvingConfig = {
  stagnationBatchWindow: 3,
  maxShelved: 2,
};

/** Output of the shelving policy evaluation */
export interface ShelvingDecision {
  toShelve: string[];
  toUnshelve: string[];
}

/** Represents a currently shelved word */
export interface ShelvedWord {
  wordId: string;
  shelvedAtBatch: number;
}
```

**Removed from DS01**: `MasterySnapshot`, `MasteryHistory` — replaced by DB counters.

### 4.2 Shelving policy function (`@gll/srs-shelving`)

```typescript
// packages/srs-shelving/src/policy.ts

/**
 * Applies shelving policy: shelve stagnant words up to maxShelved cap.
 * Does not unshelve — unshelving is session-boundary only.
 */
export function evaluateShelving(
  stagnantWordIds: string[],
  currentlyShelved: Set<string>,
  config: ShelvingConfig,
): ShelvingDecision;

/**
 * Called at session start. Returns empty shelved set (all unshelved).
 */
export function unshelveAll(): Set<string>;
```

**Removed from DS01**: `recordMasterySnapshot`, `detectStagnantWords` — detection is now the DB layer's responsibility via counter logic.

### 4.3 Engine change (`@gll/srs-engine-v2`) — unchanged from DS01

```typescript
export interface AssembleBatchOptions {
  shuffle?: boolean;
  extraThunks?: (() => QuizQuestion[])[];
  /** Word IDs to exclude from batch composition (shelved words). */
  excludeIds?: Set<string>;
}
```

### 4.4 Persistence (`@gll/db`)

**New table: `user_deck_word_tracking`** — deck-scoped stagnation counters

```sql
CREATE TABLE user_deck_word_tracking (
  user_id               TEXT NOT NULL,
  deck_id               TEXT NOT NULL,
  word_id               TEXT NOT NULL,
  stagnation_count      INTEGER NOT NULL DEFAULT 0,
  last_boundary_mastery INTEGER,
  PRIMARY KEY (user_id, deck_id, word_id)
);
```

**Modified table: `user_shelved_words`** — add `deck_id` for deck-scoped shelving

```sql
CREATE TABLE user_shelved_words (
  user_id         TEXT NOT NULL,
  deck_id         TEXT NOT NULL,
  word_id         TEXT NOT NULL,
  shelved_at_batch INTEGER NOT NULL,
  PRIMARY KEY (user_id, deck_id, word_id)
);
```

**Extended `LearningStore` interface:**

```typescript
export interface LearningStore {
  // ... existing methods ...

  // --- Stagnation tracking ---
  /** 
   * Called at batch boundary. For each active word:
   * - Reads current mastery from user_word_states
   * - Compares to last_boundary_mastery
   * - If unchanged: increment stagnation_count
   * - If changed: reset stagnation_count to 0, update last_boundary_mastery
   */
  updateStagnationCounters(userId: string, deckId: string, activeWordIds: string[]): void;

  /** Returns word IDs where stagnation_count >= threshold. */
  getStagnantWords(userId: string, deckId: string, threshold: number): string[];

  /** Resets all stagnation counters for a user+deck (session start). */
  resetStagnationCounters(userId: string, deckId: string): void;

  // --- Shelving ---
  getShelvedWords(userId: string, deckId: string): ShelvedWord[];
  shelveWord(userId: string, deckId: string, wordId: string, batchNum: number): void;
  unshelveWord(userId: string, deckId: string, wordId: string): void;
  unshelveAllWords(userId: string, deckId: string): void;
}
```

---

## 5. User Workflows

### 5.1 Within-session shelving flow

```
advanceAdaptiveSession(state, batchOutput, config)
  → updated RunState, active[], queue[]
  ↓
store.updateStagnationCounters(userId, deckId, activeWordIds)
  → compares mastery to last_boundary_mastery, increments/resets counters
  ↓
store.getStagnantWords(userId, deckId, config.stagnationBatchWindow)
  → stagnantWordIds[]
  ↓
evaluateShelving(stagnantWordIds, currentlyShelved, config)
  → { toShelve, toUnshelve }
  ↓
store.shelveWord(userId, deckId, wordId, batchNum)  // for each toShelve
  ↓
assembleBatch(active, wordPool, foundationalPool, wordsPerBatch, {
  excludeIds: updatedShelvedSet
})
  → QuizQuestion[]  (shelved words excluded, but slots held)
```

### 5.2 Session start (resume) flow

```
store.unshelveAllWords(userId, deckId)           // clear shelved state for this deck
store.resetStagnationCounters(userId, deckId)    // fresh counters
  ↓
store.getAllWordStates(userId)                    // reconstruct RunState
  ↓
initAdaptiveSession(words, config)               // fresh active/queue
  ↓
shelvedSet = new Set()                           // empty — all unshelved
```

### 5.3 Edge cases

**3rd word stagnates, cap already at 2**: Word stays active, continues to be quizzed. The cap prevents the session from thinning too much.

**All active words stagnate**: Only `maxShelved` get shelved. Remaining stagnant words keep getting quizzed. The session continues with a reduced effective pool.

**Word stagnates then progresses before window**: Counter resets to 0 on any mastery change. No shelving.

**User switches deck**: Stagnation and shelving are deck-scoped. Deck B is unaffected by deck A's state.

**Mid-session refresh**: Counters and shelved state are persisted. Host reconstructs `shelvedSet` from `store.getShelvedWords(userId, deckId)` on resume. No progress lost.

---

## 6. Migration from DS01

DS01 was partially implemented across 5 isolated worktrees (none merged to main). DS02 changes the stagnation tracking approach and adds deck-scoping. The recommended migration path:

### What exists in DS01 worktrees

| DS01 Story | Worktree contents | DS02 status |
| --- | --- | --- |
| DS01-ST01 | `@gll/srs-shelving` scaffold + `recordMasterySnapshot` + `detectStagnantWords` + `MasterySnapshot` + `MasteryHistory` + `ShelvingConfig` + `DEFAULT_SHELVING_CONFIG` + `ShelvedWord` + `ShelvingDecision` | **Partial reuse** — keep scaffold, types, config; drop stagnation detection functions and types |
| DS01-ST02 | `evaluateShelving` + `unshelveAll` | **Reuse as-is** |
| DS01-ST03 | Exports verification tests | **Rework** — update to match reduced exports (no snapshot types/functions) |
| DS01-ST04 | `excludeIds` filter in `assembleBatch` | **Reuse as-is** — maps directly to DS02-ST02 |
| DS01-ST05 | `user_shelved_words` table (no `deck_id`) + 4 `LearningStore` methods | **Rework** — add `deck_id` to table, all method signatures, migration SQL |

### Implementation approach

1. **Create `feat/ep26-shelving` branch from main**
2. **Merge all 5 DS01 worktrees in order** (ST01 → ST05, they are sequential dependencies)
3. **Apply corrective commit** to align with DS02:
   - Delete `recordMasterySnapshot`, `detectStagnantWords` from `stagnation.ts` (or delete the file entirely)
   - Delete `MasterySnapshot`, `MasteryHistory` from `types.ts`
   - Update `index.ts` — remove stagnation function/type exports
   - Rewrite `exports.test.ts` — verify reduced export surface
   - Delete `stagnation.test.ts` (tests for removed functions)
   - Add `deck_id` to `user_shelved_words` schema + update migration SQL
   - Update all `LearningStore` shelving method signatures to include `deckId: string`
   - Update `SqliteLearningStore` implementation — add `deck_id` to queries
   - Update `sqlite-learning-store.test.ts` — deck isolation tests
4. **Continue with DS02-ST03** (stagnation counters) as a new commit — fresh work
5. **DS02-ST04** is now done (shelving persistence already corrected in step 3)
6. **DS02-ST05** (host wiring) — fresh work
7. **DS02-ST06** (BDD) — fresh work

### What to verify after corrective commit

- `pnpm --filter @gll/srs-shelving test` — reduced test suite passes
- `pnpm --filter @gll/srs-shelving typecheck` — no stale type references
- `pnpm --filter @gll/db test` — deck-scoped shelving tests pass
- `pnpm typecheck` — monorepo clean

---

## 7. Stories (DS02)

### Phase 1: Policy Package (EP26-PH01)

### EP26-ST01: Package scaffold + policy types

**Scope**: `packages/srs-shelving` — scaffold + types + `evaluateShelving` + `unshelveAll`

**Changed from DS01**: Stagnation detection functions (`recordMasterySnapshot`, `detectStagnantWords`) and their types (`MasterySnapshot`, `MasteryHistory`) are removed. Package contains only policy types and cap-enforcement function.

**Tasks**:
- [ ] Create `packages/srs-shelving` with package.json, tsconfig, vitest config
- [ ] Implement `ShelvingConfig`, `DEFAULT_SHELVING_CONFIG`, `ShelvedWord`, `ShelvingDecision` types
- [ ] Implement `evaluateShelving` — applies `maxShelved` cap to stagnant candidates
- [ ] Implement `unshelveAll` — returns empty `Set<string>` for session start
- [ ] Export all public types and functions from package index

**Acceptance Criteria**:
- [ ] `evaluateShelving` respects `maxShelved` cap, filters already-shelved, preserves input order
- [ ] `unshelveAll` returns empty `Set<string>`
- [ ] `import { evaluateShelving, DEFAULT_SHELVING_CONFIG } from '@gll/srs-shelving'` works
- [ ] `pnpm typecheck` clean

---

### Phase 2: Engine Integration (EP26-PH02)

### EP26-ST02: `excludeIds` filter in `assembleBatch`

**Scope**: `packages/srs-engine-v2/src/engine/assemble-batch.ts` — unchanged from DS01

**Tasks**:
- [ ] Add `excludeIds?: Set<string>` to `AssembleBatchOptions`
- [ ] Filter `active` items through `excludeIds` before foundational/vocabulary partitioning
- [ ] Do NOT modify `nextActivePool` — shelved words remain in `active` array

**Acceptance Criteria**:
- [ ] `assembleBatch(active, ..., { excludeIds: new Set(['w1']) })` produces no questions for `w1`
- [ ] `active` array passed to `nextActivePool` still contains `w1` (slot held)
- [ ] When `excludeIds` is undefined or empty, behavior is unchanged
- [ ] Existing tests pass unchanged

---

### Phase 3: Persistence (EP26-PH03)

### EP26-ST03: Stagnation tracking schema + LearningStore extension

**Scope**: `packages/db` — new `user_deck_word_tracking` table, stagnation counter methods

**Tasks**:
- [ ] Add `user_deck_word_tracking` table to schema
- [ ] Add migration SQL
- [ ] Implement `updateStagnationCounters(userId, deckId, activeWordIds)` in `SqliteLearningStore`
- [ ] Implement `getStagnantWords(userId, deckId, threshold)` in `SqliteLearningStore`
- [ ] Implement `resetStagnationCounters(userId, deckId)` in `SqliteLearningStore`

**Acceptance Criteria**:
- [ ] Counter increments when mastery unchanged at batch boundary
- [ ] Counter resets to 0 when mastery changes
- [ ] `getStagnantWords` returns word IDs with `stagnation_count >= threshold`
- [ ] `resetStagnationCounters` zeroes all counters for user+deck
- [ ] `pnpm --filter db test` green

### EP26-ST04: Shelving persistence (deck-scoped)

**Scope**: `packages/db` — modify `user_shelved_words` to include `deck_id`, update shelving methods

**Tasks**:
- [ ] Add `deck_id` to `user_shelved_words` schema and migration
- [ ] Update `getShelvedWords(userId, deckId)` — deck-scoped query
- [ ] Update `shelveWord(userId, deckId, wordId, batchNum)` — deck-scoped upsert
- [ ] Update `unshelveWord(userId, deckId, wordId)` — deck-scoped delete
- [ ] Update `unshelveAllWords(userId, deckId)` — deck-scoped clear
- [ ] Update `clearUserState` to also clear stagnation tracking and shelving

**Acceptance Criteria**:
- [ ] `shelveWord` + `getShelvedWords` round-trips with deck isolation
- [ ] `unshelveAllWords` clears only the target deck
- [ ] Shelving a word already shelved is idempotent (upsert)
- [ ] `clearUserState` clears both tables
- [ ] `pnpm --filter db test` green

---

### Phase 4: Host Integration (EP26-PH04)

### EP26-ST05: Host integration wiring

**Scope**: Host layer (srs-demo + CLI demo) — wire shelving pipeline into session flow

**Tasks**:
- [ ] Initialize shelved set from `store.getShelvedWords(userId, deckId)` on session resume
- [ ] Call `store.unshelveAllWords(userId, deckId)` + `store.resetStagnationCounters(userId, deckId)` on new session start
- [ ] After each `advanceAdaptiveSession`:
  - Call `store.updateStagnationCounters(userId, deckId, activeWordIds)`
  - Call `store.getStagnantWords(userId, deckId, config.stagnationBatchWindow)`
  - Call `evaluateShelving(stagnantWordIds, shelvedSet, config)`
  - Persist decisions via `store.shelveWord`
- [ ] Pass `excludeIds: shelvedSet` to `assembleBatch`
- [ ] Add shelving API routes to Hono server (thin persistence proxy)
- [ ] Wire Vue app to call shelving pipeline via API

**Acceptance Criteria**:
- [ ] A word with no mastery progress over 3 batches gets shelved and stops appearing in questions
- [ ] Shelved word still holds its active slot (new words don't enter from queue)
- [ ] Starting a new session unshelves all words for that deck
- [ ] Max 2 (or configured) words shelved simultaneously per deck
- [ ] Shelving in deck A does not affect deck B

### EP26-ST06: BDD scenarios for srs-demo

**Scope**: `apps/srs-demo/e2e/` — Playwright + Cucumber feature files

**Scenarios**:
- [ ] Word shelved after N stagnant batches stops appearing in questions
- [ ] Shelved word holds active slot — no new words enter from queue
- [ ] New session unshelves all words
- [ ] `maxShelved` cap enforced — only N words shelved simultaneously

**BDD seeding strategy**: Seed `user_deck_word_tracking.stagnation_count` and `user_shelved_words` via test API endpoints (`POST /api/test/seed-stagnation`, `POST /api/test/seed-shelved`) to set up preconditions without driving N batches through the UI.

---

## 8. Success Criteria

1. Stagnant words detected and shelved within a session without manual intervention
2. Shelved words excluded from batches but hold active slots
3. New session unshelves all words (per deck)
4. `maxShelved` cap enforced per deck
5. Shelving is deck-scoped — no cross-deck leakage
6. Stagnation state survives mid-session refresh
7. Engine purity preserved — no shelving logic in `@gll/srs-engine-v2`
8. BDD scenarios pass for all shelving acceptance criteria
9. No type errors across monorepo
10. All existing engine tests pass unchanged
