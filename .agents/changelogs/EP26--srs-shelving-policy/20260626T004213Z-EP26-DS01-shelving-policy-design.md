# EP26-DS01: Shelving Policy Design Specification

**Date**: 20260626T004213Z
**Status**: Superseded by DS02
**Epic**: [EP26 - SRS Shelving Policy](../../plans/epics/EP26-srs-shelving-policy.md)

---

## 1. Feature Overview

A separate `@gll/srs-shelving` package provides pure policy functions for detecting stagnant words and deciding shelve/unshelve actions. The engine (`@gll/srs-engine-v2`) receives an `excludeIds` set to skip shelved words during batch assembly while preserving their active slot. The host (CLI/app) orchestrates calls between engine, shelving, and persistence.

**Package dependency graph:**
```
Host (srs-demo / CLI)
  ├── @gll/srs-engine-v2   (batch assembly, mastery, session)
  ├── @gll/srs-shelving     (stagnation detection, shelving policy)
  └── @gll/db               (persistence, implements ShelvingStore)
```

`@gll/srs-shelving` depends on engine types only (imports `WordState`, `RunState` from `@gll/srs-engine-v2`). No dependency on `@gll/db`.

---

## 2. Core Requirements

| Requirement | Decision | Rationale |
| --- | --- | --- |
| Stagnation trigger | No mastery delta over `stagnationBatchWindow` batches (default: 3) | Catches words that oscillate without climbing — wrong-streak alone misses right-wrong-right-wrong patterns |
| Stagnation tracking | Snapshot `mastery` per word at batch boundaries; compare current vs N batches ago | Minimal new state; pure function over batch history |
| Shelving cap | Configurable `maxShelved` (default: 2) | Prevents session from becoming all-shelved; PRD §5.9 |
| Slot consumption | Shelved words hold their active slot | Prevents new-word flooding when struggling; PRD §5.9 |
| Unshelving | Session-scoped — all shelved words unshelve on new session start | Preserves engine purity (no clock); spacing effect comes from real time between sessions |
| Engine change | `assembleBatch` accepts `excludeIds: Set<string>` | Minimal invasion; engine skips excluded IDs during question generation but keeps them in active array |
| Persistence | `shelved_at` nullable column on `user_word_states`, or separate `user_shelved_words` table | Survives app restart; host reconstructs shelved set on session resume |
| Library boundary | Shelving logic lives in `@gll/srs-shelving`, not in engine | Engine remains pure; shelving is policy, not core scheduling |

---

## 3. Data Structures

### 3.1 Shelving package types (`@gll/srs-shelving`)

```typescript
// packages/srs-shelving/src/types.ts

import type { RunState } from '@gll/srs-engine-v2';

export interface ShelvingConfig {
  /** Number of batches without mastery progress before shelving. Default: 3 */
  stagnationBatchWindow: number;
  /** Maximum words shelved simultaneously. Default: 2 */
  maxShelved: number;
}

export const DEFAULT_SHELVING_CONFIG: ShelvingConfig = {
  stagnationBatchWindow: 3,
  maxShelved: 2,
};

/** Per-word mastery snapshot taken at a batch boundary */
export interface MasterySnapshot {
  wordId: string;
  mastery: number;
  batchNum: number;
}

/** Tracks mastery history for stagnation detection */
export type MasteryHistory = Map<string, MasterySnapshot[]>;

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

### 3.2 Shelving policy functions (`@gll/srs-shelving`)

```typescript
// packages/srs-shelving/src/stagnation.ts

/**
 * Records current mastery for all active words. Called once per batch
 * boundary (after advanceAdaptiveSession).
 */
export function recordMasterySnapshot(
  history: MasteryHistory,
  runState: RunState,
  activeWordIds: string[],
  batchNum: number,
): MasteryHistory;

/**
 * Returns IDs of active words whose mastery has not changed
 * over the last `stagnationBatchWindow` batches.
 */
export function detectStagnantWords(
  history: MasteryHistory,
  batchNum: number,
  config: ShelvingConfig,
): string[];
```

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

### 3.3 Engine change (`@gll/srs-engine-v2`)

```typescript
// Extend AssembleBatchOptions in assemble-batch.ts
export interface AssembleBatchOptions {
  shuffle?: boolean;
  extraThunks?: (() => QuizQuestion[])[];
  /** Word IDs to exclude from batch composition (shelved words). */
  excludeIds?: Set<string>;
}
```

The `assembleBatch` function filters `active` through `excludeIds` before partitioning into foundational/vocabulary — but does **not** remove them from the `active` array returned by `nextActivePool`. They hold their slot.

### 3.4 Persistence (`@gll/db`)

```typescript
// Extend LearningStore interface
export interface LearningStore {
  // ... existing methods ...

  /** Returns all currently shelved words for a user. */
  getShelvedWords(userId: string): ShelvedWord[];
  /** Mark a word as shelved. */
  shelveWord(userId: string, wordId: string, batchNum: number): void;
  /** Remove shelved status from a word. */
  unshelveWord(userId: string, wordId: string): void;
  /** Remove all shelved statuses for a user (session start). */
  unshelveAllWords(userId: string): void;
}
```

Schema option — new table (preferred over column on `user_word_states` to keep concerns separate):

```sql
CREATE TABLE user_shelved_words (
  user_id    TEXT NOT NULL,
  word_id    TEXT NOT NULL,
  shelved_at_batch INTEGER NOT NULL,
  PRIMARY KEY (user_id, word_id)
);
```

---

## 4. User Workflows

### 4.1 Within-session shelving flow

```
advanceAdaptiveSession(state, batchOutput, config)
  → updated RunState, active[], queue[]
  ↓
recordMasterySnapshot(history, runState, activeWordIds, batchNum)
  → updated MasteryHistory
  ↓
detectStagnantWords(history, batchNum, shelvingConfig)
  → stagnantWordIds[]
  ↓
evaluateShelving(stagnantWordIds, currentlyShelved, shelvingConfig)
  → { toShelve, toUnshelve }
  ↓
db.shelveWord(userId, wordId, batchNum)  // for each toShelve
  ↓
assembleBatch(active, wordPool, foundationalPool, wordsPerBatch, {
  excludeIds: updatedShelvedSet
})
  → QuizQuestion[]  (shelved words excluded, but slots held)
```

### 4.2 Session start (resume) flow

```
db.unshelveAllWords(userId)           // clear all shelved state
  ↓
db.getAllWordStates(userId)            // reconstruct RunState
  ↓
initAdaptiveSession(words, config)    // fresh active/queue
  ↓
shelvedSet = new Set()                // empty — all unshelved
masteryHistory = new Map()            // fresh — no prior batch context
```

### 4.3 Edge cases

**3rd word stagnates, cap already at 2**: Word stays active, continues to be quizzed. Not ideal, but the cap prevents session from thinning too much. If one of the 2 shelved words would unshelve mid-session (not in current design), the 3rd could take its place — but with session-scoped unshelving, this doesn't happen.

**All active words stagnate**: Only `maxShelved` get shelved. Remaining stagnant words keep getting quizzed. The session continues with a reduced effective pool.

**Word stagnates then progresses before shelving window**: `detectStagnantWords` checks the full window — if mastery changed at any point within the window, the word is not stagnant. No shelving.

**Shelved word is also in recheckPending/recheckReentered**: Shelving takes precedence. The word is excluded from batch assembly. Recheck sets are not affected — when the word unshelves next session, recheck state is reset anyway (new session = fresh `recheckPending`/`recheckReentered`).

---

## 5. Stories

### Phase 1: Policy Package (EP26-PH01)

### EP26-ST01: Package scaffold + stagnation detection

**Scope**: `packages/srs-shelving` — tsconfig, vitest, package.json
**Read List**: `packages/srs-engine-v2/package.json`, `packages/srs-engine-v2/tsconfig.json` (scaffold reference), `packages/srs-engine-v2/src/types/word-state.ts` (RunState, WordState types)
**Tasks**:

- [ ] Create `packages/srs-shelving` with package.json (`@gll/srs-shelving`), tsconfig, vitest config
- [ ] Add `README.md` describing package responsibility (pure shelving policy functions), boundary (no I/O, no DB, no engine mutation), and dependency relationship (imports engine types only, host orchestrates)
- [ ] Implement `ShelvingConfig`, `MasterySnapshot`, `MasteryHistory`, `ShelvedWord`, `ShelvingDecision` types
- [ ] Implement `recordMasterySnapshot` — records current mastery per active word
- [ ] Implement `detectStagnantWords` — compares current mastery vs N batches ago
      **Acceptance Criteria**:
- [ ] `recordMasterySnapshot` appends snapshot for each active word at given batchNum
- [ ] `detectStagnantWords` returns word IDs with zero mastery delta over `stagnationBatchWindow`
- [ ] Words with fewer than `stagnationBatchWindow` snapshots are not flagged
- [ ] Words whose mastery changed at any point within the window are not flagged

### EP26-ST02: Shelving policy function

**Scope**: `packages/srs-shelving/src/policy.ts`
**Read List**: `packages/srs-shelving/src/stagnation.ts` (ST01 output), `packages/srs-shelving/src/types.ts`
**Tasks**:

- [ ] Implement `evaluateShelving` — applies `maxShelved` cap to stagnant candidates
- [ ] Implement `unshelveAll` — returns empty set for session start
      **Acceptance Criteria**:
- [ ] When stagnant candidates <= `maxShelved` - currently shelved count, all candidates shelve
- [ ] When stagnant candidates exceed available slots, only first N shelve (by word order in active pool)
- [ ] Already-shelved words are not re-shelved
- [ ] `unshelveAll` returns empty `Set<string>`

### EP26-ST03: Configuration types + defaults + package exports

**Scope**: `packages/srs-shelving/src/index.ts`
**Read List**: `packages/srs-engine-v2/src/index.ts` (export pattern reference)
**Tasks**:

- [ ] Export all public types and functions from package index
- [ ] `DEFAULT_SHELVING_CONFIG` exported with `stagnationBatchWindow: 3`, `maxShelved: 2`
      **Acceptance Criteria**:
- [ ] `import { evaluateShelving, detectStagnantWords, DEFAULT_SHELVING_CONFIG } from '@gll/srs-shelving'` works
- [ ] `pnpm typecheck` clean

---

### Phase 2: Engine Integration (EP26-PH02)

### EP26-ST04: `excludeIds` filter in `assembleBatch`

**Scope**: `packages/srs-engine-v2/src/engine/assemble-batch.ts`
**Read List**: `packages/srs-engine-v2/src/engine/assemble-batch.ts`, `packages/srs-engine-v2/src/engine/session.ts` (`nextActivePool`)
**Tasks**:

- [ ] Add `excludeIds?: Set<string>` to `AssembleBatchOptions`
- [ ] Filter `active` items through `excludeIds` before foundational/vocabulary partitioning
- [ ] Do NOT modify `nextActivePool` — shelved words remain in `active` array
      **Acceptance Criteria**:
- [ ] `assembleBatch(active, ..., { excludeIds: new Set(['w1']) })` produces no questions for `w1`
- [ ] `active` array passed to `nextActivePool` still contains `w1` (slot held)
- [ ] When `excludeIds` is undefined or empty, behavior is unchanged (no regression)
- [ ] Existing tests pass unchanged

---

### Phase 3: Persistence (EP26-PH03)

### EP26-ST05: Schema + LearningStore extension

**Scope**: `packages/db/src/schema.ts`, `packages/db/src/learning-store.ts`, `packages/db/src/sqlite-learning-store.ts`
**Read List**: `packages/db/src/schema.ts`, `packages/db/src/learning-store.ts`, `packages/db/src/sqlite-learning-store.ts`
**Tasks**:

- [ ] Add `user_shelved_words` table to schema
- [ ] Extend `LearningStore` interface with `getShelvedWords`, `shelveWord`, `unshelveWord`, `unshelveAllWords`
- [ ] Implement methods in `SqliteLearningStore`
- [ ] Add migration for new table
      **Acceptance Criteria**:
- [ ] `shelveWord` + `getShelvedWords` round-trips correctly
- [ ] `unshelveAllWords` clears all shelved words for a user
- [ ] Shelving a word that's already shelved is idempotent (upsert)
- [ ] `pnpm --filter db test` green

### EP26-ST06: Host integration wiring

**Scope**: Host layer (srs-demo or CLI demo)
**Read List**: `apps/srs-demo/` or `packages/srs-engine-v2/demo/` (whichever is current host), EP26-ST01 through ST05 outputs
**Tasks**:

- [ ] Initialize `MasteryHistory` at session start
- [ ] Call `unshelveAllWords` at session start
- [ ] After each `advanceAdaptiveSession`, call `recordMasterySnapshot` → `detectStagnantWords` → `evaluateShelving`
- [ ] Persist shelving decisions via `LearningStore`
- [ ] Pass `excludeIds` to `assembleBatch`
      **Acceptance Criteria**:
- [ ] A word with no mastery progress over 3 batches gets shelved and stops appearing in questions
- [ ] Shelved word still holds its active slot (new words don't enter from queue)
- [ ] Starting a new session unshelves all words
- [ ] Max 2 (or configured) words shelved simultaneously

---

## 6. Success Criteria

1. Stagnant words detected and shelved within a session without manual intervention
2. Shelved words excluded from batches but hold active slots
3. New session unshelves all words
4. `maxShelved` cap enforced
5. Engine purity preserved — no shelving logic in `@gll/srs-engine-v2`
6. No type errors across monorepo
7. All existing engine tests pass unchanged
