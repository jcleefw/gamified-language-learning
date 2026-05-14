# EP25-DS03: Sentence State & Spacing Rules

**Date**: 20260515T091946Z
**Status**: Draft
**Epic**: [EP25 - SRS Engine v2: Composer Registry & Batch Execution](.agents/plans/epics/EP25-srs-engine-composer-registry.md)

---

## 1. Feature Overview

DS03 implements the per-sentence tracking and spacing rules from ADR D6/D7/D10/D13. It builds on DS01 (registry, `SentenceState` type shape agreed) and DS02 (re-serve loop, `wordsPerBatch` rename complete).

The original EP25-ST05 is broken into three smaller independently testable stories:

| Story | Concern | What it touches |
|---|---|---|
| ST05 | `SentenceState` type + `SentenceRunState` + `defaultSentenceState` | `src/types/sentence-state.ts` (new) |
| ST06 | Eligibility gates: `active` + batch gap (`lastBatchSeen`) | `resolveEligibleContexts` + `runAdaptiveLoop` |
| ST07 | Streak tracking: correct streak exit + wrong streak shelving | `resolveEligibleContexts` + `runAdaptiveLoop` |

`dailyCount` / `sentenceDailyMax` (D7 daily cap) is **deferred** — no real clock in the demo, and the mock fixture approach needs a separate discussion. It is recorded in Open Questions.

---

## 2. Core Requirements

| Requirement | Decision | Rationale |
|---|---|---|
| `SentenceState` location | `src/types/sentence-state.ts` — exported from engine | Consumed by demo session layer; needs to be importable from `@gll/srs-engine-v2` |
| `SentenceRunState` ownership | `runAdaptiveLoop` in `demo/learning-io.ts` | Session concern; mirrors `RunState` ownership. Not in engine core. |
| `SentenceRunState` init | `new Map()` default; first-access creates via `defaultSentenceState` | Same pattern as `RunState` |
| `lastBatchSeen` sentinel | `-1` (never seen); `batchNum` starts at `1` | Gap check: `batchNum - lastBatchSeen > sentenceBatchGap` |
| Batch gap gate | `batchNum - lastBatchSeen > sentenceBatchGap` (default: 1) | Prevents back-to-back appearances; first appearance always passes (−1 sentinel) |
| `active` gate | `active: true` required to be returned by `resolveEligibleContexts` | Shelved sentences silently excluded |
| Correct streak exit | When `sentenceStreak >= sentenceCorrectStreakThreshold` (default: 3), `active` set to `false` | Sentence graduated from session pool — no FSRS handoff yet (ADR OQ5 deferred) |
| Wrong streak shelving | When `sessionWrongStreak >= sentenceWrongStreakThreshold` (default: 3), `active` set to `false` | Auto-shelve for session; resets at next `runAdaptiveLoop` call |
| `dailyCount` | Deferred — see OQ1 | No real clock; mock fixture pattern TBD |
| `resolveEligibleContexts` signature | Add `sentenceRunState: SentenceRunState` + `batchNum: number` params | Gates need both; tiles resolution unchanged |
| State update timing | After `runBatch` results processed, before `nextActivePool` | Mirrors `RunState` update timing |

---

## 3. Data Structures

### `SentenceState` (`src/types/sentence-state.ts` — new)

```ts
export interface SentenceState {
  sentenceId: string;
  sentenceStreak: number;       // consecutive correct — exit gate (D7)
  lastBatchSeen: number;        // batch number — spacing gate (D7); -1 = never seen
  dailyCount: number;           // times served this session/day — daily cap (D7); deferred
  sessionWrongStreak: number;   // consecutive wrong this session — shelve gate (D10)
  active: boolean;              // false = shelved or graduated
}

export type SentenceRunState = Map<string, SentenceState>;

export function defaultSentenceState(sentenceId: string): SentenceState {
  return {
    sentenceId,
    sentenceStreak: 0,
    lastBatchSeen: -1,
    dailyCount: 0,
    sessionWrongStreak: 0,
    active: true,
  };
}
```

### `LEARNING_CONFIG` additions (`demo/config.ts`)

```ts
sentenceBatchGap: 1,                // D7 — min batches between appearances
sentenceCorrectStreakThreshold: 3,  // D7 — correct streak for graduation
sentenceWrongStreakThreshold: 3,    // D10 — wrong streak for shelving
```

### `resolveEligibleContexts` signature change

```ts
// before
function resolveEligibleContexts(
  runState: RunState,
  allPool: QuizItem[],
): { ctx: SentenceContext; tiles: SentenceTile[] }[]

// after
function resolveEligibleContexts(
  runState: RunState,
  allPool: QuizItem[],
  sentenceRunState: SentenceRunState,
  batchNum: number,
): { ctx: SentenceContext; tiles: SentenceTile[] }[]
```

### State update helper (internal to `learning-io.ts`)

```ts
function updateSentenceRunState(
  sentenceRunState: SentenceRunState,
  results: SentenceQuizResult[],
  batchNum: number,
  config: typeof LEARNING_CONFIG,
): SentenceRunState
```

Updates `sentenceStreak`, `sessionWrongStreak`, `lastBatchSeen`, and `active` for each sentence that appeared in the batch.

---

## 4. Gate Logic

### `resolveEligibleContexts` gate order (ST06 + ST07)

```
for each sentence in corpus:
  1. word-seen gate (existing):   all wordIds seen >= minSeenForSentence
  2. active gate (ST06):          sentenceState.active === true
  3. batch-gap gate (ST06):       batchNum - sentenceState.lastBatchSeen > sentenceBatchGap
  → if all pass: include in eligible list
```

### State update after batch (ST07)

```
for each SentenceQuizResult in batch results:
  if correct:
    sentenceStreak++
    sessionWrongStreak = 0
    if sentenceStreak >= sentenceCorrectStreakThreshold:
      active = false   // graduated
  if wrong:
    sessionWrongStreak++
    sentenceStreak = 0
    if sessionWrongStreak >= sentenceWrongStreakThreshold:
      active = false   // shelved

  lastBatchSeen = batchNum  (always — whether correct or wrong)
```

---

## 5. File Map After DS03

```
packages/srs-engine-v2/
├── src/
│   ├── types/
│   │   └── sentence-state.ts        ← NEW (ST05): SentenceState, SentenceRunState, defaultSentenceState
│   └── index.ts                     ← updated (ST05): export SentenceState types
└── demo/
    ├── config.ts                    ← updated (ST06): sentenceBatchGap + (ST07): streak thresholds
    └── learning-io.ts               ← updated (ST06): resolveEligibleContexts gates + runAdaptiveLoop
                                                (ST07): updateSentenceRunState + streak/shelve logic
```

Tests:
```
src/__tests__/unit/sentence-state.test.ts    ← NEW (ST05): defaultSentenceState unit tests
src/__tests__/unit/sentence-spacing.test.ts  ← NEW (ST06+ST07): gate and state-update unit tests
```

---

## 6. Stories

### EP25-ST05: `SentenceState` type + `defaultSentenceState`

**Scope**: New type file only. No wiring. No changes to `learning-io.ts`.

**Read List**:
- `packages/srs-engine-v2/src/types/word-state.ts` — structural reference

**Tasks**:
- [ ] Create `src/types/sentence-state.ts` — `SentenceState`, `SentenceRunState`, `defaultSentenceState`
- [ ] Export from `src/index.ts`
- [ ] Unit tests (`sentence-state.test.ts`):
  - [ ] `defaultSentenceState` returns correct zero-values
  - [ ] `lastBatchSeen` is `-1` (never seen sentinel)
  - [ ] `active` is `true` by default

**Acceptance Criteria**:
- [ ] `SentenceState`, `SentenceRunState`, `defaultSentenceState` importable from `@gll/srs-engine-v2`
- [ ] `pnpm typecheck` clean

---

### EP25-ST06: Eligibility gates — `active` + batch gap

**Scope**: Wire `SentenceRunState` into `runAdaptiveLoop`. Update `resolveEligibleContexts` to gate on `active` and `lastBatchSeen`. Update `lastBatchSeen` after each batch. No streak logic yet.

**Read List**:
- `packages/srs-engine-v2/demo/learning-io.ts` — `resolveEligibleContexts`, `runAdaptiveLoop`
- `packages/srs-engine-v2/demo/config.ts`
- `packages/srs-engine-v2/src/types/sentence-state.ts` (from ST05)

**Tasks**:
- [ ] Add `sentenceBatchGap: 1` to `LEARNING_CONFIG`
- [ ] `runAdaptiveLoop`: initialise `sentenceRunState: SentenceRunState = new Map()`; thread `batchNum` into `resolveEligibleContexts`; update `lastBatchSeen` for each sentence that appeared after each batch
- [ ] `resolveEligibleContexts`: add `sentenceRunState` + `batchNum` params; apply `active` gate + batch-gap gate after existing word-seen gate
- [ ] Unit tests (`sentence-spacing.test.ts`):
  - [ ] Sentence never seen (`lastBatchSeen: -1`) passes batch-gap gate
  - [ ] Sentence seen last batch (`lastBatchSeen = batchNum - 1`) fails batch-gap gate
  - [ ] Sentence seen 2 batches ago (`lastBatchSeen = batchNum - 2`) passes (gap = 1)
  - [ ] Sentence with `active: false` excluded regardless of batch gap

**Acceptance Criteria**:
- [ ] All 4 gate unit tests pass
- [ ] `pnpm --filter @gll/srs-engine-v2 test` green (all existing tests pass)
- [ ] `pnpm typecheck` clean

---

### EP25-ST07: Streak tracking — correct streak exit + wrong streak shelving

**Scope**: Implement `updateSentenceRunState`. Update `sentenceStreak`, `sessionWrongStreak`, and `active` from batch results. Wire into `runAdaptiveLoop` after each batch.

**Read List**:
- `packages/srs-engine-v2/demo/learning-io.ts` — `runAdaptiveLoop`, `runBatch`
- `packages/srs-engine-v2/demo/config.ts`
- `packages/srs-engine-v2/src/types/sentence-state.ts`

**Tasks**:
- [ ] Add `sentenceCorrectStreakThreshold: 3` + `sentenceWrongStreakThreshold: 3` to `LEARNING_CONFIG`
- [ ] Implement `updateSentenceRunState` per gate logic in §4
- [ ] `runAdaptiveLoop`: call `updateSentenceRunState` after word results processed, before `nextActivePool`
- [ ] Unit tests (`sentence-spacing.test.ts` additions):
  - [ ] Correct answer increments `sentenceStreak`, resets `sessionWrongStreak`
  - [ ] Wrong answer increments `sessionWrongStreak`, resets `sentenceStreak`
  - [ ] `sentenceStreak >= sentenceCorrectStreakThreshold` sets `active: false` (graduated)
  - [ ] `sessionWrongStreak >= sentenceWrongStreakThreshold` sets `active: false` (shelved)
  - [ ] Shelved sentence does not appear in next batch (integration via `resolveEligibleContexts`)

**Acceptance Criteria**:
- [ ] All 5 streak unit tests pass
- [ ] Integration: sentence graduated after 3 correct does not reappear
- [ ] Integration: sentence shelved after 3 consecutive wrong does not reappear
- [ ] `pnpm --filter @gll/srs-engine-v2 test` green; `pnpm typecheck` clean

---

## 7. Open Questions

| # | Question | Severity | Status |
|---|----------|----------|--------|
| OQ1 | `dailyCount` / `sentenceDailyMax` — no real clock in demo. Session = day boundary (same as `maxRetryPerSession`). Need to agree on mock fixture approach before implementation. Deferred from this DS. | Medium | Open — separate discussion before implementation |
| OQ2 | `resolveEligibleContexts` is called inside `runBatch` which runs before results are processed. `lastBatchSeen` is set after the batch. Confirm: a sentence eligible at start of batch N will correctly be excluded from batch N+1 because `lastBatchSeen = N` is written before `nextActivePool` runs. | Low | Open — verify in ST06 |

---

## 8. Success Criteria

1. `SentenceState`, `SentenceRunState`, `defaultSentenceState` importable from `@gll/srs-engine-v2` (ST05)
2. Sentences with `active: false` never returned by `resolveEligibleContexts` (ST06)
3. Sentences not served in back-to-back batches (ST06)
4. Sentence graduating after `sentenceCorrectStreakThreshold` correct answers sets `active: false` (ST07)
5. Sentence shelving after `sentenceWrongStreakThreshold` consecutive wrong answers sets `active: false` (ST07)
6. `pnpm --filter @gll/srs-engine-v2 test` green; `pnpm typecheck` clean
