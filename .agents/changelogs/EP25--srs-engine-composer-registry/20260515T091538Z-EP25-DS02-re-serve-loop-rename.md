# EP25-DS02: Adaptive Session Orchestrator

**Date**: 20260515T091534Z
**Status**: Draft
**Epic**: [EP25 - SRS Engine v2: Composer Registry & Batch Execution](.agents/plans/epics/EP25-srs-engine-composer-registry.md)

---

## 1. Feature Overview

DS02 covers Phase 2 of EP25 — the Adaptive Session Orchestrator. This aligns with the architectural decisions documented in `product-documentation/architecture/20260516T113156Z-engineering-adaptive-session-orchestrator.md`.

Phase 2 introduces a clean separation between the session state, the batch assembly process, and the within-batch retry mechanics.

**ST03 — `questionLimit` → `wordsPerBatch` rename** (Completed)
Renames the session-layer parameter and config key. `questionLimit` on the engine composer remains unchanged.

**ST04 — Session State Manager (`adaptive-session.ts`)**
Defines `AdaptiveSessionState` and `SessionConfig`. Provides `initAdaptiveSession` (starting state) and `advanceAdaptiveSession` (accepts mixed `QuizResult[]`; engine routes internally; sentence results silently ignored in Phase 2, active in Phase 3).

**ST05 — Thunk Registration Boundary**
No new engine file. Moves thunk registration out of `runBatch` and up to the consumer call site. `createComposerRegistry` and `assembleBatchQuestions` (ST01) are unchanged.

**ST06 — Batch Queue Manager (`batch-queue.ts`)**
Introduces `BatchQueueManager` and `BatchOutput`. Handles within-batch retries automatically (D1/D2/D11). Exposes `batch.output` as a plain data boundary for `advanceAdaptiveSession`.

---

## 2. Core Requirements

| Requirement | Decision | Rationale |
|---|---|---|
| `wordsPerBatch` | Renamed from `questionLimit` | `wordsPerBatch` describes slots in the active window |
| `AdaptiveSessionState` | Encapsulate all session state; consumer holds one object | Immutable replacement triggers Vue reactivity; CLI loop trivially driven |
| `advanceAdaptiveSession` accepts `QuizResult[]` | Engine filters internally (Option A) | Multi-platform: no consumer knows about result type discrimination |
| `BatchOutput` plain data type | Decouples `BatchQueueManager` from `adaptive-session.ts` | State manager must not import the queue manager class |
| `maxRetryPerSession` in `AdaptiveSessionState` | Cross-batch count cannot live inside a per-batch `BatchQueueManager` | Passed in at construction; returned via `batch.output` for state update |
| D8 early exit | `batch.finish()` drains queue; same output contract | Learner abort and natural completion produce identical output shape |

---

## 3. Data Structures

### `AdaptiveSessionState` (`src/engine/adaptive-session.ts`)

```ts
// Phase 2 (ST04)
export interface AdaptiveSessionState {
  active: QuizItem[];
  queue: QuizItem[];
  runState: RunState;
  recheckPending: Set<string>;
  recheckReentered: Set<string>;
  batchNum: number;             // sentence spacing counter (D7/OQ9)
  sessionRetryCounts: Map<string, number>; // cross-batch retry tracking (D2)
}
// Phase 3 addition (ST08): sentenceRunState: SentenceRunState
```

### `SessionConfig` (`src/engine/adaptive-session.ts`)

```ts
export interface SessionConfig {
  wordsPerBatch: number;
  masteryThreshold: number;
  streakThresholds: StreakThresholds;
  maxRetryPerSession: number;   // D2 — session cap threshold
}
```

### `initAdaptiveSession` signature

```ts
export function initAdaptiveSession(
  words: QuizItem[],
  config: SessionConfig,
  recheckIds?: Set<string>,
  initialRunState?: RunState,   // cloned internally — does not mutate the passed-in Map
): AdaptiveSessionState
```

### `advanceAdaptiveSession` signature

```ts
export function advanceAdaptiveSession(
  state: AdaptiveSessionState,
  batchOutput: BatchOutput,     // plain data — no BatchQueueManager import
  config: SessionConfig,
): AdaptiveSessionState
// Phase 2: sentence results in batchOutput.results are silently ignored
// Phase 3 (ST08): sentence results routed to updateSentenceRunState internally
```

### `BatchOutput` (`src/engine/batch-queue.ts`)

```ts
export interface BatchOutput {
  results: ReadonlyArray<QuizResult>;
  sessionRetryCounts: ReadonlyMap<string, number>; // updated counts for advanceAdaptiveSession
}
```

### `BatchQueueManager` (`src/engine/batch-queue.ts`)

```ts
export class BatchQueueManager {
  constructor(
    questions: QuizQuestion[],
    retryPerWordCap: number,              // maxRetryPerWord — per-batch cap (D2)
    sessionRetryCounts: Map<string, number>, // current session counts (in)
    retryPerSessionCap: number,          // maxRetryPerSession threshold (D2)
  );

  next(): QuizQuestion | null;           // null = queue exhausted (isDone)
  submitResult(result: QuizResult): void; // triggers re-queue if wrong + within caps (D1/D11)
  finish(): void;                        // D8 early exit — drains queue, produces output

  readonly isDone: boolean;
  readonly output: BatchOutput;          // valid only when isDone === true
  // Internal: question cache Map<wordId|sentenceId, QuizQuestion> for D11 replay
}
```

---

## 4. Stories

### EP25-ST03: Rename `questionLimit` → `wordsPerBatch` + set default to 3 (Completed)

**Scope**: Mechanical rename in session layer only. No logic changes. `composeWordBatchItems({ questionLimit })` option untouched.

**Read List**:
- `packages/srs-engine-v2/demo/config.ts`
- `packages/srs-engine-v2/demo/learning-io.ts`
- `packages/srs-engine-v2/demo/learning-runner.ts`
- `packages/srs-engine-v2/src/engine/session.ts`
- `packages/srs-engine-v2/src/__tests__/integration/auto-scenarios.test.ts`

**Tasks**:
- [x] `demo/config.ts`: rename `questionLimit → wordsPerBatch`, set value to `3`
- [x] `demo/learning-io.ts`: rename parameter `questionLimit → wordsPerBatch` in `runBatch` and `runAdaptiveLoop`; update all internal usages
- [x] `demo/learning-runner.ts`: update call site (`LEARNING_CONFIG.questionLimit → LEARNING_CONFIG.wordsPerBatch`)
- [x] `src/engine/session.ts`: rename `nextActivePool` parameter `questionLimit → wordsPerBatch`
- [x] `src/__tests__/integration/auto-scenarios.test.ts`: rename config key `questionLimit → wordsPerBatch`

**Acceptance Criteria**:
- [x] `grep -r "questionLimit" demo/` returns no results (engine composer option excluded)
- [x] `pnpm --filter @gll/srs-engine-v2 test` green — all 164 tests pass
- [x] `pnpm typecheck` clean

---

### EP25-ST04: Session State Manager (`adaptive-session.ts`)

**Scope**: Create `src/engine/adaptive-session.ts`. Define `AdaptiveSessionState` (6 fields including `batchNum` and `sessionRetryCounts`) and `SessionConfig`. Implement `initAdaptiveSession` (partitions `words` into `active`/`queue`, clones `RunState`) and `advanceAdaptiveSession` (wraps `updateMasteryState` + `nextActivePool`; accepts mixed `QuizResult[]`; filters to word results internally; sentence results silently ignored in Phase 2).

**Read List**:
- `product-documentation/architecture/20260516T113156Z-engineering-adaptive-session-orchestrator.md`
- `product-documentation/architecture/20260513T000000Z-engineering-batch-execution-mechanics.md` — D1, D2, D7, D8, OQ9
- `packages/srs-engine-v2/src/engine/session.ts` — `updateMasteryState`, `nextActivePool` signatures
- `packages/srs-engine-v2/src/types/word-state.ts` — `RunState`, `StreakThresholds`

**Tasks**:
- [ ] Create `packages/srs-engine-v2/src/engine/adaptive-session.ts`
- [ ] Define and export `AdaptiveSessionState` interface (6 fields per §3)
- [ ] Define and export `SessionConfig` interface (per §3)
- [ ] Implement `initAdaptiveSession`: partition words, clone `initialRunState` (prevents cross-deck mutation), initialise `batchNum: 0` and `sessionRetryCounts: new Map()`
- [ ] Implement `advanceAdaptiveSession`: filter `batchOutput.results` to `WordQuizResult[]`, call `updateMasteryState`, call `nextActivePool`, increment `batchNum`, merge `batchOutput.sessionRetryCounts` into state
- [ ] Export both from `src/index.ts`
- [ ] Unit tests:
  - [ ] `initAdaptiveSession` partitions `recheckIds` into `active`, remainder into `queue`
  - [ ] `initAdaptiveSession` clones `RunState` — mutations to the original do not affect session state
  - [ ] `advanceAdaptiveSession` round-trip produces same mastery outcome as calling `updateMasteryState` + `nextActivePool` directly
  - [ ] `batchNum` increments by 1 each `advanceAdaptiveSession` call
  - [ ] Sentence results (`SentenceQuizResult`) in `batchOutput.results` are silently ignored — `runState` unchanged

**Acceptance Criteria**:
- [ ] `initAdaptiveSession` + `advanceAdaptiveSession` round-trip over a deterministic auto-answer scenario produces identical `RunState` to current `runAdaptiveLoop`
- [ ] `batchNum` correctly reflects batch count across multiple `advanceAdaptiveSession` calls
- [ ] `pnpm --filter @gll/srs-engine-v2 test` green
- [ ] `pnpm typecheck` clean

---

### EP25-ST05: Thunk Registration Boundary

**Scope**: No new engine file or function. `createComposerRegistry` and `assembleBatchQuestions` (ST01) are already the correct implementation. This story moves thunk registration logic *out of* `runBatch` in `demo/learning-io.ts` and *up to* the consumer call site — so the consumer (not the batch loop) owns which composers run. Batch Mechanics ADR D5 is already satisfied; this is a demo-layer refactor.

**Read List**:
- `product-documentation/architecture/20260513T000000Z-engineering-batch-execution-mechanics.md` — D5, OQ1, OQ10
- `packages/srs-engine-v2/src/engine/compose-registry.ts`
- `packages/srs-engine-v2/demo/learning-io.ts` — lines 207–219 (current thunk registration site)

**Tasks**:
- [ ] Extract thunk registration block from `runBatch` into a helper or into the `runAdaptiveLoop` call site
- [ ] `runBatch` receives a pre-built `registry` (or the assembled `QuizQuestion[]`) as a parameter — it no longer calls `registry.add()` internally
- [ ] Update `demo/learning-runner.ts` call site accordingly
- [ ] No changes to `src/engine/compose-registry.ts`

**Acceptance Criteria**:
- [ ] `runBatch` contains no `registry.add()` calls — thunk registration is at the caller level
- [ ] `pnpm --filter @gll/srs-engine-v2 test` green (all existing tests pass)
- [ ] `pnpm typecheck` clean

---

### EP25-ST06: Batch Queue Manager (`batch-queue.ts`)

**Scope**: Create `src/engine/batch-queue.ts`. Implement `BatchOutput` (plain data interface) and `BatchQueueManager` class. The manager enforces `maxRetryPerWord` (per-batch cap) internally, receives `sessionRetryCounts` at construction to enforce `maxRetryPerSession` (cross-batch cap), caches first-served questions for D11 replay, and supports D8 early exit via `.finish()`. Refactor `runBatch` in `demo/learning-io.ts` to use `BatchQueueManager`.

**Read List**:
- `product-documentation/architecture/20260516T113156Z-engineering-adaptive-session-orchestrator.md`
- `product-documentation/architecture/20260513T000000Z-engineering-batch-execution-mechanics.md` — D1, D2, D8, D11, OQ4, OQ6
- `packages/srs-engine-v2/demo/learning-io.ts` — `runBatch` (current loop to replace)

**Tasks**:
- [ ] Create `packages/srs-engine-v2/src/engine/batch-queue.ts`
- [ ] Define and export `BatchOutput` interface (per §3)
- [ ] Implement `BatchQueueManager` class (per §3 contract)
  - [ ] Constructor: accept `questions`, `retryPerWordCap`, `sessionRetryCounts`, `retryPerSessionCap`
  - [ ] Internal question cache `Map<id, QuizQuestion>` built from initial questions (D11)
  - [ ] `.next()`: returns next question, or `null` when queue exhausted
  - [ ] `.submitResult()`: if wrong AND within both caps, re-enqueue from cache; update batch + session counts
  - [ ] `.finish()`: D8 early exit — marks done, returns same `output` contract
  - [ ] `.isDone` getter
  - [ ] `.output` getter: returns `BatchOutput` (valid only when `isDone`)
- [ ] Export `BatchOutput` and `BatchQueueManager` from `src/index.ts`
- [ ] Refactor `runBatch` in `demo/learning-io.ts` to use `BatchQueueManager` (pass pre-built questions from ST05)
- [ ] Unit tests:
  - [ ] All correct first-pass — no retries, `output.results` length equals initial question count
  - [ ] Wrong answer retried up to `retryPerWordCap` then not re-queued
  - [ ] Word at `retryPerSessionCap` in `sessionRetryCounts` is not re-queued (cap already exhausted from prior batch)
  - [ ] `output.sessionRetryCounts` reflects updated counts after batch
  - [ ] `.finish()` early exit produces valid `output` with results up to exit point
  - [ ] Sentence questions consume same caps as word questions (OQ6)

**Acceptance Criteria**:
- [ ] `runBatch` in `demo/learning-io.ts` contains no manual retry loop — batch logic fully delegated to `BatchQueueManager`
- [ ] Wrong word is re-served the identical cached question (not recomposed) — D11
- [ ] Word answered wrong 3 times in a batch (cap=2) is re-served exactly twice in that batch, then carries over
- [ ] Word at session cap is excluded from retry in subsequent batches
- [ ] `pnpm --filter @gll/srs-engine-v2 test` green
- [ ] `pnpm typecheck` clean

---

### EP25-ST07: Integrate Orchestrator in `srs-demo` Web App

**Scope**: Runs **after ST04–ST06 are complete**. Refactor `apps/srs-demo/src/App.vue` to replace its current legacy implementation (direct `composeWordBatchMulti` call, manual `recheckPending`/`recheckReentered` tracking) with the full Orchestrator API (`AdaptiveSessionState`, `BatchQueueManager`, registry-based assembly). The Vue app is deliberately left broken/stale during Phase 2 engine development; ST07 is the single integration pass once the engine is stable.

**Read List**:
- `product-documentation/architecture/20260516T113156Z-engineering-adaptive-session-orchestrator.md`
- `product-documentation/architecture/20260513T000000Z-engineering-batch-execution-mechanics.md` — D5, D8
- `apps/srs-demo/src/App.vue` — full file
- `apps/srs-demo/src/composables/useSession.ts` — persistence layer (OQ3: Map/Set serialization)
- `packages/srs-engine-v2/src/index.ts` — verify all new exports are present

**Tasks**:
- [ ] Replace `ref<RunState>`, `ref<Set>`, `ref<Set>` individual refs with a single `ref<AdaptiveSessionState>` holding the full session state
- [ ] Remove `composeWordBatchMulti` import (H4 — ADR D5 violation); replace `startBatch()` with registry-based thunk registration + `assembleBatchQuestions`
- [ ] Replace manual `recheckPending`/`recheckReentered` tracking in `finishBatch()` with `advanceAdaptiveSession(state, batch.output, config)` call
- [ ] Wire `BatchQueueManager` into the quiz rendering loop: `.next()` yields current question; `onAnswered()` calls `.submitResult()`; `isDone` triggers `finishBatch()`
- [ ] Handle D8 early exit: `onExitBatch()` calls `batch.finish()` before passing output to `advanceAdaptiveSession`
- [ ] Update `useSession` composable to serialize/deserialize `AdaptiveSessionState` (address OQ3: `Map`/`Set` → JSON; implement `serializeSessionState` / `deserializeSessionState` helpers if the engine does not provide them)
- [ ] Verify all computed properties (`masteredDeck`, `masteredGlobal`, `completedDeckIds`) re-evaluate correctly on `AdaptiveSessionState` reference swap
- [ ] `pnpm --filter @gll/srs-demo build` succeeds

**Acceptance Criteria**:
- [ ] `App.vue` contains no `composeWordBatchMulti` import or call
- [ ] `App.vue` holds a single `ref<AdaptiveSessionState>` — no standalone `recheckPending` / `recheckReentered` refs
- [ ] The web app runs a full learning session end-to-end using the new Orchestrator APIs
- [ ] Session persistence survives a page reload (load → resume flow works)
- [ ] `pnpm typecheck` clean
- [ ] `pnpm --filter @gll/srs-demo build` clean

---

## 5. Success Criteria

1. All consumer session state encapsulated in a single immutable `AdaptiveSessionState` object
2. `advanceAdaptiveSession` is the sole entry point for session state transitions — no raw calls to `updateMasteryState` / `nextActivePool` in consumer code
3. `BatchQueueManager` owns all within-batch retry logic — no manual retry loops in consumer code
4. Thunk registration is at the consumer call site, not inside the batch execution path
5. Phase 2 engine changes are verified against the CLI demo (`demo/learning-io.ts`) only; Vue app integration deferred to ST07
6. `pnpm --filter @gll/srs-engine-v2 test` green; `pnpm typecheck` clean after each story

---

## 6. Open Questions

| # | Question | Severity | Status | Target Story |
|---|---|---|---|---|
| OQ1 | Does `advanceAdaptiveSession` accept mixed `QuizResult[]` or `WordQuizResult[]`? | High | **Resolved — Option A. Engine filters internally. Sentence results silently ignored in Phase 2.** | — |
| OQ2 | Does `AdaptiveSessionState` include `batchNum` and `sessionRetryCounts`? | High | **Resolved — yes, both fields defined in §3.** | — |
| OQ3 | Should the engine provide Map/Set JSON serialization helpers for browser persistence? | Medium | Open — `useSession` composable currently handles serialization; decision whether to move helpers into the engine | ST07 |
| OQ4 | Does `initAdaptiveSession` clone the passed-in `RunState`? | Medium | **Resolved — yes, cloned internally to prevent cross-deck mastery mutation.** | — |
