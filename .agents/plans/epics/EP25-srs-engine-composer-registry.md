# EP25 - SRS Engine v2: Composer Registry & Batch Execution

**Created**: 20260515T080015Z
**Status**: Draft

<!-- Status: Draft | Accepted | In Progress | Impl-Complete | BDD Pending | Completed | Shelved | Withdrawn -->

**Type**: Epic Plan
**Depends on**: EP23
**Parallel with**: N/A
**Predecessor**: N/A

---

## Problem Statement

`runBatch()` in `demo/learning-io.ts` calls `composeWordBatchMulti` (×2) and `composeSentenceBatch` directly — hardcoded. ADR D5 (`20260513T000000Z-engineering-batch-execution-mechanics.md`) specifies a registry of pre-bound thunks so adding a future composer is a registration, not a change to session logic.

Beyond wiring, the current batch loop has two gaps: (1) a learner can finish a batch never having answered a word correctly in that batch; (2) sentence questions have no guaranteed re-appearance. ADR D1/D2 define the re-serve caps that close the first gap. D13 + D6/D7/D10 define `SentenceState` and the spacing rules that close the second.

---

## Scope

**In scope**:

- `ComposerRegistry` + `assembleBatchQuestions` in `srs-engine-v2` (D5)
- Wire `learning-io.ts` `runBatch()` to use the registry instead of direct composer calls (D5)
- Within-batch re-serve loop with `maxRetryPerWord` / `maxRetryPerSession` caps (D1/D2)
- `SentenceState` type (D13)
- Sentence eligibility, streak-based exit, daily cap, batch spacing, auto-shelve (D6/D7/D10)

**Out of scope**:

- `SentenceState.reviewCard` / FSRS handoff — deferred (ADR OQ5)
- Ingestion script / corpus pipeline (ADR OQ6)
- `srs-demo` app — stub only on this branch

---

## Stories

### Phase 1: Registry (EP25-PH01)

### EP25-DS01: Design — Registry API + `SentenceState` type shape

**Scope**: Confirm `ComposerRegistry` interface, `assembleBatchQuestions` signature, and `SentenceState` field set before any implementation. Covers ADR D5 (OQ1/OQ3 already resolved) and D13. Output: agreed interfaces written into this epic as a locked contract.

Agreed registry API:
```ts
// packages/srs-engine-v2/src/engine/compose-registry.ts
export interface ComposerRegistry {
  add(thunk: () => QuizQuestion[]): void;
}
export function createComposerRegistry(): ComposerRegistry;
export function assembleBatchQuestions(registry: ComposerRegistry): QuizQuestion[];
```

Agreed `SentenceState` (D13):
```ts
// packages/srs-engine-v2/src/types/sentence-state.ts
export interface SentenceState {
  sentenceId: string;
  sentenceStreak: number;      // consecutive correct — streak-based exit (D7)
  lastBatchSeen: number;       // batch sequence number — batch spacing (D7)
  dailyCount: number;          // times served today — daily cap (D7)
  sessionWrongStreak: number;  // consecutive wrong this session — shelving (D10)
  active: boolean;             // in active pool (D10 / manual re-activation)
}
export type SentenceRunState = Map<string, SentenceState>;
```

### EP25-ST01: Implement `compose-registry.ts` (TDD) + export

**Scope**: New `packages/srs-engine-v2/src/engine/compose-registry.ts` with `createComposerRegistry` + `assembleBatchQuestions`; unit tests at `src/__tests__/unit/compose-registry.test.ts`; export from `src/index.ts`.

### EP25-ST02: Wire `learning-io.ts` to registry

**Scope**: Replace the three hardcoded composer calls in `runBatch()` (lines 203–216) with registry registrations; update imports to use `composeWordBatchItems` alias and `createComposerRegistry` / `assembleBatchQuestions`.

---

### Phase 2: Re-serve loop (EP25-PH02)

### EP25-ST03: Within-batch re-serve loop (D1/D2)

**Scope**: Add `maxRetryPerWord` + `maxRetryPerSession` to `LEARNING_CONFIG` (`demo/config.ts`); implement inner re-serve loop in `runBatch()` — batch does not close until every active word has been answered correctly at least once (within caps); session-level retry counter; unit tests for cap exhaustion and carry-over behaviour. Re-serves replay the identical question (D11).

---

### Phase 3: Sentence state & spacing (EP25-PH03)

### EP25-ST04: `SentenceState` type + initialization

**Scope**: New `packages/srs-engine-v2/src/types/sentence-state.ts` (per DS01 contract); `SentenceRunState` map alias; factory / initializer; unit tests for default values and field semantics.

### EP25-ST05: Sentence spacing rules (D6/D7/D10)

**Scope**: Update `resolveEligibleContexts` in `learning-io.ts` to gate on `SentenceState.active` + `lastBatchSeen` batch gap (D7); track `sentenceStreak` and exit when `sentenceCorrectStreakThreshold` reached (D7); increment `dailyCount` and enforce `sentenceDailyMax` cap (D7); auto-shelve (`active = false`) when `sessionWrongStreak >= sentenceWrongStreakThreshold` (D10); add constants to `LEARNING_CONFIG`; unit tests for each gating rule.

**Open (to discuss before DS):**

- `dailyCount` has no real clock — session = day boundary, same pattern as `maxRetryPerSession`. Need a mock clock / carry-over fixture (similar to how word carry-over is tested) to drive tests for daily cap exhaustion across simulated sessions. Approach TBD.
- Phase 3 scope (D6/D7/D10) still under discussion — stories above capture current understanding; may be revised before DS.

---

## Overall Acceptance Criteria

- [ ] `assembleBatchQuestions(registry)` returns flat merged `QuizQuestion[]` from all registered thunks
- [ ] `runBatch()` no longer contains direct imports or calls to `composeWordBatchMulti` or `composeSentenceBatch`
- [ ] A batch does not close until every active word has been answered correctly at least once (within `maxRetryPerWord` cap)
- [ ] Words exceeding `maxRetryPerSession` do not appear again for the session
- [ ] `SentenceState` is tracked per sentence across batches in `runAdaptiveLoop`
- [ ] A sentence question is not served in back-to-back batches (`sentenceBatchGap`)
- [ ] A sentence question auto-shelves after `sentenceWrongStreakThreshold` consecutive wrong answers
- [ ] `pnpm --filter srs-engine-v2 test` exits green; `pnpm typecheck` clean across monorepo

---

## Dependencies

- EP23 (completed): `composeSentenceBatch`, `SentenceContext`, `MCQQuestion`/`QuizQuestion` union, `composeWordBatchItems` alias

## ADRs

- `product-documentation/architecture/20260513T000000Z-engineering-batch-execution-mechanics.md` — D1, D2, D4, D5, D6, D7, D10, D11, D13

## Next Steps

1. Review and approve this epic plan
2. Begin DS01 — confirm registry API + `SentenceState` shape
3. Implement ST01 → ST02 → ST03 → ST04 → ST05 in order
