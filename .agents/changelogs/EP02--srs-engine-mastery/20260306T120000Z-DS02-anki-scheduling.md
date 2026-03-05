# EP02-DS02: ANKI Scheduling Specification

**Date**: 2026-03-06
**Status**: Draft
**Epic**: [EP02 - SRS Engine Core: Mastery + ANKI Scheduling](../../plans/epics/EP02-srs-engine-mastery.md)
**Phase**: EP02-PH02

---

## 1. Feature Overview

Two files created inside `packages/srs-engine/src/scheduling/`:

1. **`scheduler.interface.ts`** — `SpacedRepetitionScheduler` interface + `ReviewResult` type. Defines the contract any scheduler must satisfy.
2. **`FsrsScheduler.ts`** — Concrete implementation wrapping `ts-fsrs`. Translates `WordState` + `isCorrect` into a `ReviewResult` with the next interval (capped at 90 days) and updated FSRS state.

**Lapse boundary clarification**: `mastery.ts` (EP02-PH01) owns the 3-lapse-then-reset-to-Learning rule. `FsrsScheduler` only calculates intervals — it does not track lapse counts or trigger phase resets. A wrong answer in ANKI phase maps to `Rating.Again` in ts-fsrs; the FSRS library handles its own internal stability/difficulty decay.

`ts-fsrs` is added as a runtime dependency of `packages/srs-engine`.

Strict TDD: tests written before implementation.

---

## 2. Core Requirements

| Requirement | Decision | Rationale |
|---|---|---|
| Scheduler interface | `SpacedRepetitionScheduler` with `scheduleReview` + `getNextInterval` | Abstraction allows swapping ts-fsrs without API change |
| `ReviewResult` location | `src/scheduling/types.ts` (domain-private) | Scheduling-domain type; exported from `index.ts` |
| FSRS correct rating | `Rating.Good` | Standard "correct" signal for FSRS; `Rating.Easy` would inflate intervals |
| FSRS wrong rating | `Rating.Again` | Standard lapse signal in FSRS |
| 90-day cap | `Math.min(result.scheduledDays, config.maxIntervalDays)` | Prevents words from disappearing for months |
| `FsrsCardState` updated by scheduler | Yes — `ReviewResult.updatedFsrsState` contains new ts-fsrs card state | Calling layer (EP07) writes this back to `WordState.fsrsState` |
| New word (no prior FSRS state) | Create a new `ts-fsrs` Card; initial interval = 1 day | First ANKI review always starts fresh |
| 3-lapse reset | **NOT** handled here — owned by `mastery.ts` (EP02-PH01) | Scheduler calculates intervals only |
| `ts-fsrs` desired retention | Read from `SrsConfig.desiredRetention` | Passed to `FSRS` constructor |
| Class naming | `FsrsScheduler` (PascalCase — class file) | Per RULES.md §Package Structure |

---

## 3. Data Structures

```typescript
// src/scheduling/types.ts

import type { FsrsCardState } from '../types.ts'

export interface ReviewResult {
  nextIntervalDays: number      // capped at SrsConfig.maxIntervalDays
  updatedFsrsState: FsrsCardState
  isLapse: boolean              // true when isCorrect=false (Rating.Again)
}
```

```typescript
// src/scheduling/scheduler.interface.ts

import type { WordState } from '../types.ts'
import type { ReviewResult } from './types.ts'

export interface SpacedRepetitionScheduler {
  /**
   * Process a review and return the next interval + updated FSRS state.
   * Only call for words in 'anki_review' phase.
   */
  scheduleReview(state: WordState, isCorrect: boolean): ReviewResult

  /**
   * Return days until next review without recording a review event.
   * Returns 1 for words with no prior FSRS state.
   */
  getNextInterval(state: WordState): number
}
```

```typescript
// src/scheduling/FsrsScheduler.ts

import type { SrsConfig, WordState } from '../types.ts'
import type { SpacedRepetitionScheduler } from './scheduler.interface.ts'
import type { ReviewResult } from './types.ts'

export class FsrsScheduler implements SpacedRepetitionScheduler {
  constructor(config: Pick<SrsConfig, 'desiredRetention' | 'maxIntervalDays'>)

  scheduleReview(state: WordState, isCorrect: boolean): ReviewResult

  getNextInterval(state: WordState): number
}
```

### `FsrsCardState` ↔ ts-fsrs `Card` mapping

No ts-fsrs types leak into `WordState` or any other engine type. `FsrsScheduler` translates internally.

| `FsrsCardState` field | ts-fsrs `Card` field |
|---|---|
| `stability` | `stability` |
| `difficulty` | `difficulty` |
| `elapsedDays` | `elapsed_days` |
| `scheduledDays` | `scheduled_days` |
| `reps` | `reps` |
| `lapses` | `lapses` |
| `lastReview` | `last_review` |

---

## 4. User Workflows

### First ANKI review (no prior FSRS state)
```
state.fsrsState = undefined
→ FsrsScheduler creates new ts-fsrs Card
→ scheduleReview: Rating.Good/Again → ReviewResult
→ nextIntervalDays = min(fsrs.scheduledDays, maxIntervalDays)
→ updatedFsrsState = mapped ts-fsrs Card
```

### Subsequent ANKI review (has FSRS state)
```
state.fsrsState = { stability, difficulty, ... }
→ FsrsScheduler maps FsrsCardState → ts-fsrs Card
→ scheduleReview: Rating.Good/Again → ReviewResult
→ nextIntervalDays = min(fsrs.scheduledDays, maxIntervalDays)
→ updatedFsrsState = mapped updated ts-fsrs Card
```

### `getNextInterval` (read-only, no review event)
```
state.fsrsState = undefined → return 1
state.fsrsState exists     → return min(state.fsrsState.scheduledDays, maxIntervalDays)
```

---

## 5. Stories

### Phase 2: ANKI Scheduling (EP02-PH02)

### EP02-ST03: SpacedRepetitionScheduler interface + ReviewResult type

**Scope**: Define `scheduler.interface.ts` and `src/scheduling/types.ts`; export from `index.ts`
**Read List**: `packages/srs-engine/src/types.ts`, `packages/srs-engine/src/index.ts`
**Tasks**:
- [ ] Create `packages/srs-engine/src/scheduling/types.ts` with `ReviewResult`
- [ ] Create `packages/srs-engine/src/scheduling/scheduler.interface.ts` with `SpacedRepetitionScheduler`
- [ ] Export `SpacedRepetitionScheduler` and `ReviewResult` from `src/index.ts`
- [ ] Run `pnpm build` — verify no type errors

**Acceptance Criteria**:
- [ ] `SpacedRepetitionScheduler` and `ReviewResult` exported from `@gll/srs-engine`
- [ ] `pnpm build` exits 0 with no TypeScript errors
- [ ] No `any` types

---

### EP02-ST04: FsrsScheduler adapter

**Scope**: Implement `FsrsScheduler` wrapping `ts-fsrs`; unit tests for all paths (strict TDD)
**Read List**:
- `packages/srs-engine/src/types.ts`
- `packages/srs-engine/src/scheduling/scheduler.interface.ts`
- `packages/srs-engine/src/scheduling/types.ts`
- `packages/srs-engine/package.json`

**Tasks**:
- [ ] Add `ts-fsrs` to `packages/srs-engine/package.json` as a runtime dependency
- [ ] Run `pnpm install` to resolve
- [ ] Write tests first in `packages/srs-engine/src/scheduling/__tests__/FsrsScheduler.test.ts`
- [ ] Implement `FsrsScheduler` in `packages/srs-engine/src/scheduling/FsrsScheduler.ts`
- [ ] Export `FsrsScheduler` from `src/index.ts`
- [ ] Run `pnpm test` — all tests pass

**Test cases to cover**:
- Correct answer (`isCorrect=true`) produces `isLapse=false`
- Correct answer produces increasing `nextIntervalDays` across sequential reviews
- Wrong answer (`isCorrect=false`) produces `isLapse=true`
- Wrong answer produces a shorter/reset `nextIntervalDays` (FSRS `Rating.Again` behavior)
- `nextIntervalDays` never exceeds `maxIntervalDays` (90-day cap enforced)
- Word with no prior `fsrsState` (first ANKI review) returns a valid `ReviewResult`
- `getNextInterval` returns 1 for word with no `fsrsState`
- `getNextInterval` returns `scheduledDays` (capped) for word with `fsrsState`
- `updatedFsrsState` is populated in every `ReviewResult`
- `scheduleReview` does NOT mutate the input `WordState`

**Acceptance Criteria**:
- [ ] All test cases above pass
- [ ] `pnpm test` (srs-engine package) exits 0
- [ ] No ts-fsrs types appear in `WordState` or public exports — only `FsrsCardState`
- [ ] No `any` types

---

### Phase 3: Demo Checkpoint (EP02-PH03)

### EP02-ST05: SRS core demo script

**Scope**: `scripts/demo-srs.ts` — direct calls to `updateMastery` + `FsrsScheduler` on one word; human observable output
**Read List**:
- `packages/srs-engine/src/types.ts`
- `packages/srs-engine/src/mastery.ts`
- `packages/srs-engine/src/scheduling/FsrsScheduler.ts`

**Tasks**:
- [ ] Create `scripts/demo-srs.ts` using `tsx`
- [ ] Instantiate a hardcoded `WordState` (curated, masteryCount=0, phase=`learning`) and `SrsConfig` (defaults)
- [ ] Loop correct answers until Learning → ANKI transition; print mastery count each iteration
- [ ] Call `FsrsScheduler.scheduleReview` on the transitioned word; print `nextIntervalDays`
- [ ] Add `"demo": "tsx scripts/demo-srs.ts"` script to root `package.json`

**Acceptance Criteria**:
- [ ] `pnpm demo` (or `tsx scripts/demo-srs.ts`) runs without errors
- [ ] Stdout shows mastery count incrementing each iteration
- [ ] Stdout shows phase flipping to `anki_review` at threshold
- [ ] Stdout shows `nextIntervalDays` from first ANKI scheduling
- [ ] No imports from outside `@gll/srs-engine` (other than `tsx` runtime)

---

## 6. Success Criteria

1. `SpacedRepetitionScheduler`, `FsrsScheduler`, and `ReviewResult` exported from `@gll/srs-engine`
2. All unit tests pass; `pnpm test` exits green
3. 90-day cap enforced — no test produces `nextIntervalDays > 90`
4. `FsrsCardState` is the only ts-fsrs-adjacent type in the engine's public surface
5. `pnpm demo` runs and prints observable Learning → ANKI progression with interval
6. No TypeScript errors, no `any` types
