# EP25-DS02: Re-serve Loop + `wordsPerBatch` Rename

**Date**: 20260515T091534Z
**Status**: Draft
**Epic**: [EP25 - SRS Engine v2: Composer Registry & Batch Execution](.agents/plans/epics/EP25-srs-engine-composer-registry.md)

---

## 1. Feature Overview

DS02 covers Phase 2 of EP25 — two concerns delivered together because the `wordsPerBatch` rename is a prerequisite for the re-serve loop (ST03 introduces batch-level variable-length behaviour that makes `questionLimit` semantically wrong at the session layer).

**ST03 — `questionLimit` → `wordsPerBatch` rename**
Renames the session-layer parameter and config key. `questionLimit` on the engine composer (`composeWordBatchItems`) is unchanged — it remains accurate there.

**ST04 — Feature flag + re-serve loop**
Adds `enableReserveLoop` flag to `LEARNING_CONFIG` (off by default). When on, `runBatch` runs an inner loop: wrong answers re-queue the identical question (D11); caps `maxRetryPerWord` (per-batch) and `maxRetryPerSession` (session-wide) guard against infinite loops.

> **Note**: ST04 and ST05 were originally EP25-ST04/ST05 in Phase 3 (sentence state). Those are **renumbered** here as DS02 concerns. The sentence state stories move to EP25-DS03.

---

## 2. Core Requirements

| Requirement | Decision | Rationale |
|---|---|---|
| `questionLimit` in session layer | Rename to `wordsPerBatch` | Post-ST04, a batch contains variable questions (re-serves add extra); `wordsPerBatch` describes slots in the active window, not question count |
| `questionLimit` in `composeWordBatchItems` | Unchanged | Accurately describes max questions from that composer call; lives in engine layer, not session layer |
| `nextActivePool` parameter | Rename to `wordsPerBatch` | Same concept — slot ceiling for the active window |
| `wordsPerBatch` default value | `3` (was `8`) | Smaller active window makes re-serve loop behaviour easier to observe and test |
| Feature flag | `enableReserveLoop: false` in `LEARNING_CONFIG` | Off by default so existing integration tests and manual runs are unaffected until explicitly enabled |
| Re-serve identity | Identical question replayed (D11) — no recompose | Cache the question on first serve; retry from cache |
| Retry caps | `maxRetryPerWord: 2`, `maxRetryPerSession: 6` | ADR D2 defaults |
| Session retry tracking | `Map<wordId, number>` owned by `runAdaptiveLoop` | Survives across batches; reset on `runAdaptiveLoop` init |
| Cap-exhausted words | Silent carry-over (D7 / ADR OQ7) | No UI signal; word stays in `active` pool, appears next batch |
| Session-shelved words | Excluded from `nextActivePool` slot fills | Passed as `sessionShelved: Set<string>` alongside `recheckExempt`; never promoted back during session |

---

## 3. Data Structures

### `LEARNING_CONFIG` changes (`demo/config.ts`)

```ts
export const LEARNING_CONFIG = {
  wordsPerBatch: 3,          // renamed from questionLimit; active window size
  masteryThreshold: 2,
  maxMastery: 2,
  correctStreakThreshold: 2,
  wrongStreakThreshold: 2,
  minSeenForSentence: 2,
  debugSentenceEligibility: false,
  enableReserveLoop: false,  // NEW — gates ST04 re-serve behaviour
  maxRetryPerWord: 2,        // NEW — per-batch retry cap
  maxRetryPerSession: 6,     // NEW — session retry cap
};
```

### Re-serve loop internal types (`demo/learning-io.ts`)

```ts
// local to runBatch — discarded when batch ends
type QuestionCache = Map<string, QuizQuestion>; // wordId/sentenceId → first-served question

// owned by runAdaptiveLoop — survives across batches
type SessionRetryCount = Map<string, number>;   // wordId → total re-serves this session
```

### `runAdaptiveLoop` signature change

```ts
// before
export async function runAdaptiveLoop(
  words: QuizItem[],
  wordPool: QuizItem[],
  foundationalPool: QuizItem[],
  questionLimit: number,      // ← rename
  ...
)

// after
export async function runAdaptiveLoop(
  words: QuizItem[],
  wordPool: QuizItem[],
  foundationalPool: QuizItem[],
  wordsPerBatch: number,      // ← renamed
  ...
)
```

---

## 4. Re-serve Loop Flow

```
runBatch starts
  → build questions via registry (first pass)
  → build QuestionCache (wordId/sentenceId → question)
  → pending = Set of all wordIds in batch

  loop:
    serve next question from queue
    record result

    if wrong AND enableReserveLoop:
      if sessionRetryCount[wordId] < maxRetryPerSession:
        if batchRetryCount[wordId] < maxRetryPerWord:
          re-enqueue identical question from cache
          increment batchRetryCount[wordId]
          increment sessionRetryCount[wordId]
        else:
          // maxRetryPerWord exhausted — carry over silently
      else:
          // maxRetryPerSession exhausted — add to sessionShelved

    if correct:
      remove wordId from pending

  batch ends when queue is empty

runAdaptiveLoop:
  nextActivePool excludes sessionShelved words from slot fills
```

---

## 5. File Map After DS02

```
packages/srs-engine-v2/
├── src/
│   └── engine/
│       └── session.ts             ← ST03: rename questionLimit → wordsPerBatch in nextActivePool
└── demo/
    ├── config.ts                  ← ST03: rename + ST04: new constants + flag
    ├── learning-io.ts             ← ST03: rename params + ST04: re-serve loop in runBatch,
    │                                       sessionRetryCount + sessionShelved in runAdaptiveLoop
    └── learning-runner.ts         ← ST03: update call site
```

Tests updated:
```
src/__tests__/integration/auto-scenarios.test.ts  ← ST03: rename config key
```

---

## 5. Stories

### EP25-ST03: Rename `questionLimit` → `wordsPerBatch` + set default to 3

**Scope**: Mechanical rename in session layer only. No logic changes. `composeWordBatchItems({ questionLimit })` option untouched.

**Read List**:
- `packages/srs-engine-v2/demo/config.ts`
- `packages/srs-engine-v2/demo/learning-io.ts`
- `packages/srs-engine-v2/demo/learning-runner.ts`
- `packages/srs-engine-v2/src/engine/session.ts`
- `packages/srs-engine-v2/src/__tests__/integration/auto-scenarios.test.ts`

**Tasks**:
- [ ] `demo/config.ts`: rename `questionLimit → wordsPerBatch`, set value to `3`
- [ ] `demo/learning-io.ts`: rename parameter `questionLimit → wordsPerBatch` in `runBatch` and `runAdaptiveLoop`; update all internal usages
- [ ] `demo/learning-runner.ts`: update call site (`LEARNING_CONFIG.questionLimit → LEARNING_CONFIG.wordsPerBatch`)
- [ ] `src/engine/session.ts`: rename `nextActivePool` parameter `questionLimit → wordsPerBatch`
- [ ] `src/__tests__/integration/auto-scenarios.test.ts`: rename config key `questionLimit → wordsPerBatch`

**Acceptance Criteria**:
- [ ] `grep -r "questionLimit" demo/` returns no results (engine composer option excluded)
- [ ] `pnpm --filter @gll/srs-engine-v2 test` green — all 164 tests pass
- [ ] `pnpm typecheck` clean

---

### EP25-ST04: Feature flag + re-serve loop in `runBatch`

**Scope**: Add `enableReserveLoop`, `maxRetryPerWord`, `maxRetryPerSession` to `LEARNING_CONFIG`. Implement inner re-serve loop in `runBatch` (gated by `enableReserveLoop`). Add `sessionRetryCount` + `sessionShelved` to `runAdaptiveLoop`. Unit tests via auto-answer strategy with `enableReserveLoop: true`.

**Read List**:
- `packages/srs-engine-v2/demo/learning-io.ts` (full)
- `packages/srs-engine-v2/demo/config.ts`
- `packages/srs-engine-v2/demo/auto-answer-strategy.ts`
- `packages/srs-engine-v2/src/__tests__/integration/auto-scenarios.test.ts` — test fixture pattern

**Tasks**:
- [ ] Add `enableReserveLoop: false`, `maxRetryPerWord: 2`, `maxRetryPerSession: 6` to `LEARNING_CONFIG`
- [ ] `runBatch`: when `enableReserveLoop`, build `QuestionCache` on first pass; run inner loop; re-enqueue from cache on wrong answer within caps
- [ ] `runAdaptiveLoop`: initialise `sessionRetryCount: Map<string, number>` and `sessionShelved: Set<string>`; pass `sessionRetryCount` into `runBatch`; update `sessionShelved` after each batch; exclude `sessionShelved` from `nextActivePool` slot fills
- [ ] Unit tests (`auto-scenarios.test.ts` or new file):
  - [ ] `enableReserveLoop: false` (default) — batch behaviour unchanged, existing tests still pass
  - [ ] Wrong word re-served up to `maxRetryPerWord` times in one batch then carries over
  - [ ] Word at `maxRetryPerSession` excluded from subsequent batches
  - [ ] Batch with all correct on first attempt — no re-serves, same length as before

**Acceptance Criteria**:
- [ ] When `enableReserveLoop: false`, all 164 existing tests pass unchanged
- [ ] When `enableReserveLoop: true`, wrong words re-appear within the batch up to `maxRetryPerWord`
- [ ] Words exhausting `maxRetryPerSession` do not appear in subsequent active pools
- [ ] `pnpm --filter @gll/srs-engine-v2 test` green; `pnpm typecheck` clean

---

## 6. Open Questions

| # | Question | Severity | Status |
|---|----------|----------|--------|
| OQ1 | `runBatch` currently returns `{ correct, total, results }` — re-serve loop needs to also return `sessionRetryCount` updates back to `runAdaptiveLoop`. Consider returning `retryDeltas: Map<string, number>` alongside results, or mutating a passed-in ref. | Low | Open — resolved in ST04 |
| OQ2 | Sentence questions in the re-serve loop — `sentenceId` is the cache key; retry cap shared with words (ADR OQ6 resolved: uniform caps). Confirm `QuestionCache` key is `wordId \| sentenceId` discriminated by result type. | Low | Open — resolved in ST04 |

---

## 7. Success Criteria

1. `questionLimit` absent from `demo/` layer after ST03; `composeWordBatchItems` option unchanged
2. `wordsPerBatch: 3` in `LEARNING_CONFIG`
3. `enableReserveLoop: false` by default — zero behaviour change for existing tests
4. Re-serve loop correctly caps at `maxRetryPerWord` per batch and `maxRetryPerSession` per session when enabled
5. `pnpm --filter @gll/srs-engine-v2 test` green; `pnpm typecheck` clean
