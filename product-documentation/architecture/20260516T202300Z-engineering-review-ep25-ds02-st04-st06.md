# ADR: Engineering Review — EP25-DS02 ST04–ST06 Implementation Details

**Status:** Proposed

**Date:** 2026-05-16

**Reviewed by:** Antigravity

---

## Context

This review covers the design and task specifications for EP25-DS02 Stories 04–06 (Adaptive Session Orchestrator):

- **ST04** — Session State Manager (`adaptive-session.ts`)
- **ST05** — Batch Assembler (`assemble-batch.ts`)
- **ST06** — Batch Queue Manager (`batch-queue.ts`)

Source material reviewed:
- DS02 changelog task specifications
- Orchestrator ADR (`20260516T113156Z-engineering-adaptive-session-orchestrator.md`)
- Batch Execution Mechanics ADR (`20260513T000000Z-engineering-batch-execution-mechanics.md`)
- `src/engine/session.ts` — functions ST04 wraps
- `src/engine/compose-registry.ts` — existing assembly mechanism
- `apps/srs-demo/src/App.vue` — primary consumer (ST07)

---

## Findings

### Critical (fix before shipping)

*No critical findings after full ADR review.*

> **Previously flagged C1** (ST05 `assembleBatch` conflicts with `assembleBatchQuestions`) was a **false alarm**. The Batch Mechanics ADR (D5, OQ1, OQ10) is the definitive spec for the assembly layer. The function name `assembleBatch(activeItems, composers)` in the Orchestrator ADR is loose architectural prose, not a literal new function signature. The Batch Mechanics ADR explicitly rejected registry-receives-inputs alternatives (OQ1) and locked the contract as `assembleBatchQuestions(registry)` with pre-bound thunks — already shipped in `compose-registry.ts`. ST05 does not need a new file or function.

---

### High (fix before assigning stories)

#### H1 — `AdaptiveSessionState` is missing `batchNum` and the interface is undefined in DS02

**Files**: `DS02 §ST04`, Orchestrator ADR §Decision, Batch Mechanics ADR OQ9

The Orchestrator ADR names the five encapsulated fields in prose (`activeItems`, `queue`, `runState`, `recheckPending`, `recheckReentered`). DS02 §3 defers to the ADR without providing a TypeScript interface.

However, both ADRs together reveal a **sixth required field**: `batchNum`. The Batch Mechanics ADR (OQ9) resolves `lastBatchSeen` as sourced from the `batchNum` counter in `runAdaptiveLoop`. When `runAdaptiveLoop` is absorbed into `advanceAdaptiveSession`, `batchNum` must be carried in `AdaptiveSessionState` for sentence spacing (D7) to work correctly.

Required interface before ST04 starts:

```ts
// Phase 2 (ST04)
interface AdaptiveSessionState {
  active: QuizItem[];
  queue: QuizItem[];
  runState: RunState;
  recheckPending: Set<string>;
  recheckReentered: Set<string>;
  batchNum: number;           // required for sentence spacing (D7/OQ9)
}

// Phase 3 addition (ST08) — sentenceRunState added here when sentence track is implemented
// interface AdaptiveSessionState extends above with:
//   sentenceRunState: SentenceRunState;
```

Additionally, `initAdaptiveSession` inputs are unspecified. From `runAdaptiveLoop`'s current signature:

```ts
function initAdaptiveSession(
  words: QuizItem[],
  wordsPerBatch: number,
  recheckIds?: Set<string>,
  initialRunState?: RunState,
): AdaptiveSessionState
```

**Resolution**: Add the full `AdaptiveSessionState` interface and both function signatures to DS02 §3 before ST04 is assigned.

---

#### H2 — `advanceAdaptiveSession` input type — **Resolved: Option A**

**Files**: `DS02 §ST04`, Orchestrator ADR OQ1

**Resolved.** `advanceAdaptiveSession` accepts `QuizResult[]` (mixed). The engine filters and routes internally:

```ts
function advanceAdaptiveSession(
  state: AdaptiveSessionState,
  results: QuizResult[],   // mixed — engine filters to WordQuizResult internally
  config: SessionConfig,
): AdaptiveSessionState
```

**Rationale**: The engine is the single point of routing for all platforms (CLI demo, Vue app, future mobile). Requiring consumers to filter by result type before calling leaks engine internals to every host. Multi-platform consistency requires the engine to own routing.

**Phase 2 behaviour**: sentence results are silently ignored (no `SentenceRunState` yet).

**Phase 3 behaviour**: `advanceAdaptiveSession` internal implementation evolves to also process sentence results and update `sentenceRunState` within `AdaptiveSessionState`. **Consumer call site is unchanged** — no breaking API change.

**Vue app sequencing**: Vue app (`App.vue`) is accepted as broken/behind during Phase 2 and Phase 3. ST07 wires the Vue app after both phases complete — it adopts the full engine API in one pass.

---

#### H3 — `BatchQueueManager` API — **Resolved: `BatchOutput` pattern**

**Files**: `DS02 §ST06`, Batch Mechanics ADR D1, D2, D8, D11, OQ4, OQ6

**Resolved.** Three gaps identified and addressed:

**Gap 1 — `maxRetryPerSession` is cross-batch**: `AdaptiveSessionState` carries `sessionRetryCounts: Map<string, number>`. Passed into `BatchQueueManager` constructor; returned via `batch.output.sessionRetryCounts`; merged back into state by `advanceAdaptiveSession`.

**Gap 2 — D11 question cache**: `BatchQueueManager` maintains an internal `Map<id, QuizQuestion>` cache built from the initial question list. Retries replay from cache — no recompose.

**Gap 3 — D8 early exit**: `batch.finish()` terminates the queue early and produces a valid `output` with results up to that point. Unresolved retries silently carry to next batch via `sessionRetryCounts`.

**Pattern chosen**: `BatchOutput` plain data interface decouples `adaptive-session.ts` from `batch-queue.ts`. `advanceAdaptiveSession` receives `batchOutput: BatchOutput` — no class import.

Full contract in DS02 §3.

---

#### H4 — `App.vue` imports `composeWordBatchMulti` — **Resolved: added to ST07 tasks**

**Files**: `apps/srs-demo/src/App.vue:4`, Batch Mechanics ADR D5

`App.vue` imports `composeWordBatchMulti` and calls it directly in `startBatch()`, bypassing the registry. Batch Mechanics ADR D5 prohibits this. Added explicitly to ST07 task list: retire `composeWordBatchMulti` import and replace with registry-based thunk registration.

---

#### H5 — `wordsPerBatch` home in `advanceAdaptiveSession` — **Resolved: `SessionConfig`**

**Files**: `DS02 §ST04`

Resolved via `SessionConfig` type (defined in DS02 §3). `advanceAdaptiveSession(state, batchOutput, config)` receives `config.wordsPerBatch` and passes it to `nextActivePool` internally. Config stays out of state.


---

### Medium (address before or during implementation)

#### M1 — Orchestrator ADR Open Questions untracked in DS02 — **Resolved: OQ section added**

**File**: DS02, Orchestrator ADR §Open Questions

All three Orchestrator ADR OQs have been resolved or tracked:
- OQ1 (sentence routing) — **Resolved above (Option A)**
- OQ2 (Map/Set serialization) — Open — tracked in DS02 §5, target before ST07
- OQ3 (global mastery isolation) — **Resolved: `initAdaptiveSession` clones the passed-in `RunState` internally**

---

#### M2 — ST05 scope — **Resolved: no new file, thunk boundary move**

**Files**: `DS02 §ST05`, Batch Mechanics ADR D5

ST05 reframed. No `assemble-batch.ts`. No new function. Scope is: extract thunk registration from `runBatch` up to the consumer call site. DS02 ST05 updated accordingly.

---

### Low / Observations

#### L1 — Acceptance criteria are identical across ST04, ST05, ST06

Each story's criteria ends identically with *"`pnpm test` green"* and *"`pnpm typecheck` clean"*. These are necessary but not sufficient — each story needs a behavioural criterion unique to its concern.

Suggested additions:
- ST04: *"`initAdaptiveSession` + `advanceAdaptiveSession` round-trip produces identical state to current `runAdaptiveLoop` for a deterministic auto-answer scenario"*
- ST05: *"`runBatch` contains no thunk registration code — all `registry.add()` calls are at the consumer level"*
- ST06: *"A word answered wrong twice in one batch is re-served exactly twice (capped by `maxRetryPerWord: 2`); a word that hits `maxRetryPerSession` is excluded from the next batch"*

---

## Decision

All findings have been resolved through the review discussion. Changes applied to DS02 and the Orchestrator ADR:

1. **OQ1 resolved — Option A** (H2): `advanceAdaptiveSession` accepts `QuizResult[]`; engine filters internally; Phase 2 ignores sentence results; Phase 3 routes them. Updated in Orchestrator ADR.
2. **`AdaptiveSessionState` interface defined** (H1, C2): 6 fields including `batchNum` and `sessionRetryCounts`. Added to DS02 §3. Phase 3 `sentenceRunState` addition annotated.
3. **`SessionConfig` type defined** (H5): `wordsPerBatch`, `masteryThreshold`, `streakThresholds`, `maxRetryPerSession`. Added to DS02 §3.
4. **`BatchOutput` + `BatchQueueManager` contract defined** (H3): D1/D2/D8/D11 gaps addressed. Added to DS02 §3 and ST06 tasks.
5. **ST05 scope corrected** (M2): No new file/function. Thunk registration boundary move only. Updated in DS02 ST05.
6. **ST07 task added** (H4): Retire `composeWordBatchMulti`; adopt registry + `BatchQueueManager`. Updated in DS02 ST07.
7. **OQ3 resolved** (M1): `initAdaptiveSession` clones `RunState` internally. Serialization OQ (Orchestrator ADR OQ2) tracked as open pending ST07.

---

## Rationale

The two ADRs are internally consistent and well-reasoned. The implementation risk is entirely in the DS02 spec not being specific enough about API contracts at the engine/consumer boundary — the same boundary the ADRs were written to protect.

---

## Consequences

**Positive**: Implementation proceeds from unambiguous contracts. ST07 becomes a straightforward wiring task with no architectural surprises.

**Negative/Risks**: Pre-implementation contract discussion adds one planning round. OQ1 resolution required before ST04 can start.

**Neutral**: `session.ts` (`processRecheckResult`, `nextActivePool`, `updateMasteryState`) is unchanged — ST04 wraps these, not replaces them. `compose-registry.ts` is unchanged.

---

## Open Questions

| # | Question | Severity | Status | Target |
|---|---|---|---|---|
| OQ1 | Does `advanceAdaptiveSession` accept `QuizResult[]` (mixed) or `WordQuizResult[]` only? | High | **Resolved — Option A. Engine filters internally.** | — |
| OQ2 | Does `AdaptiveSessionState` include `batchNum` and `sessionRetryCounts`? | High | **Resolved — yes, both fields in interface.** | — |
| OQ3 | Should the engine provide Map/Set serialization helpers for browser persistence? | Medium | Open — decision before ST07 | Before ST07 |
| OQ4 | Does `initAdaptiveSession` clone the passed-in `RunState`? | Medium | **Resolved — yes, cloned internally.** | — |
