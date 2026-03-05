# EP02-DS01: Mastery + Phase Transitions Specification

**Date**: 2026-03-05
**Status**: Draft
**Epic**: [EP02 - SRS Engine: Mastery + Phase Transitions](../../plans/epics/EP02-srs-engine-mastery.md)

---

## 1. Feature Overview

Two files created inside `packages/srs-engine/src/`:

1. **`types.ts`** — all engine-owned types (`WordState`, `MasteryPhase`, `WordCategory`, `SrsConfig`, `QuizAnswer`). Defines the full `SrsConfig` shape even though only mastery/lapse fields are consumed in EP02; later epics reference this same type.
2. **`mastery.ts`** — single pure function `updateMastery` implementing mastery counting, floor-at-0, threshold-triggered Learning→ANKI transition, and 3-lapse ANKI→Learning reset. No I/O, no class, no side effects.

Strict TDD: tests are written before implementation.

---

## 2. Core Requirements

| Requirement | Decision | Rationale |
|---|---|---|
| `WordState` owns category | `category: WordCategory` field | Engine receives only `WordState[]`; must know category to apply correct threshold |
| FSRS state in `WordState` | `fsrsState?: FsrsCardState` (optional) | Undefined for Learning-phase words; populated by FsrsScheduler in EP03 |
| Function style | Pure function, not class method | Mastery logic is stateless; easier to test in isolation |
| Immutability | `updateMastery` returns a new `WordState` | No mutation; enables safe use in batch loops |
| Mastery floor | `Math.max(0, masteryCount - 1)` on wrong | Mastery never goes below 0 |
| Lapse reset | `lapseCount >= config.lapseThreshold` → reset `masteryCount` to 0, `phase` to `'learning'`, `lapseCount` to 0 | Clean re-entry to Learning |
| Phase transition | `masteryCount >= threshold(category)` → `phase = 'anki_review'`, `masteryCount` stays at threshold | Threshold is not a "cap" — mastery stays at threshold value on transition |
| Full `SrsConfig` defined here | Yes | Single source of config shape; later epics reference the same type |

---

## 3. Data Structures

```typescript
// src/types.ts

export type MasteryPhase = 'learning' | 'anki_review'

export type WordCategory = 'curated' | 'foundational'

export interface FsrsCardState {
  stability: number
  difficulty: number
  elapsedDays: number
  scheduledDays: number
  reps: number
  lapses: number
  lastReview: Date | null
}

export interface WordState {
  wordId: string
  category: WordCategory
  masteryCount: number      // 0..masteryThreshold
  phase: MasteryPhase
  lapseCount: number        // increments on wrong answer in anki_review phase
  correctCount: number      // lifetime correct answers
  wrongCount: number        // lifetime wrong answers
  fsrsState?: FsrsCardState // undefined until first ANKI review
}

export interface QuizAnswer {
  wordId: string
  isCorrect: boolean
}

export interface SrsConfig {
  masteryThreshold: {
    curated: number        // default: 10
    foundational: number   // default: 5
  }
  lapseThreshold: number   // default: 3 — ANKI lapses before reset to Learning
  batchSize: number        // default: 15
  activeWordLimit: number  // default: 8
  newWordsPerBatch: number // default: 4
  shelveAfterBatches: number      // default: 3
  maxShelved: number              // default: 2
  continuousWrongThreshold: number // default: 3 — foundational-specific
  questionTypeSplit: {
    mc: number         // default: 0.7
    wordBlock: number  // default: 0.2
    audio: number      // default: 0.1
  }
  foundationalAllocation: {
    active: number        // default: 0.2
    postDepletion: number // default: 0.05
  }
  desiredRetention: number  // default: 0.9 — passed to FsrsScheduler
  maxIntervalDays: number   // default: 90  — passed to FsrsScheduler
}
```

```typescript
// src/mastery.ts

export function updateMastery(
  state: WordState,
  isCorrect: boolean,
  config: SrsConfig,
): WordState
```

---

## 4. User Workflows

### Mastery counting (Learning phase)
```
isCorrect=true  → masteryCount + 1
isCorrect=false → masteryCount - 1 (floor 0)
masteryCount >= threshold → phase = 'anki_review', masteryCount stays at threshold
```

### Lapse handling (ANKI phase)
```
isCorrect=false in anki_review → lapseCount + 1, wrongCount + 1
lapseCount >= lapseThreshold  → phase = 'learning', masteryCount = 0, lapseCount = 0
```

### Correct answer in ANKI phase
```
isCorrect=true in anki_review → correctCount + 1
(interval scheduling is handled by FsrsScheduler in EP03, not here)
```

---

## 5. Stories

### EP02-ST01: Engine types

**Scope**: Define all engine-owned types in `src/types.ts`; export from `src/index.ts`
**Read List**: `product-documentation/architecture/20260302T160536Z-engineering-srs-engine-package.md`
**Tasks**:
- [ ] Create `packages/srs-engine/src/types.ts` with all types from §3 above
- [ ] Re-export all types from `packages/srs-engine/src/index.ts`
- [ ] Run `pnpm build` (srs-engine) — verify no type errors

**Acceptance Criteria**:
- [ ] `MasteryPhase`, `WordCategory`, `FsrsCardState`, `WordState`, `QuizAnswer`, `SrsConfig` all exported from `@gll/srs-engine`
- [ ] `pnpm build` exits 0 with no TypeScript errors
- [ ] No `any` types used

---

### EP02-ST02: Mastery counting + phase transition

**Scope**: Implement `src/mastery.ts` with full unit test coverage (strict TDD)
**Read List**: `packages/srs-engine/src/types.ts`, `packages/srs-engine/src/index.ts`
**Tasks**:
- [ ] Write tests first in `packages/srs-engine/__tests__/unit/mastery/mastery.test.ts`
- [ ] Implement `updateMastery` in `packages/srs-engine/src/mastery.ts`
- [ ] Export `updateMastery` from `src/index.ts`
- [ ] Run `pnpm test` — all tests pass

**Test cases to cover**:
- Correct answer increments mastery
- Wrong answer decrements mastery (floor at 0, not negative)
- Wrong answer at mastery=0 stays at 0
- Mastery reaching curated threshold (10) transitions to `anki_review`
- Mastery reaching foundational threshold (5) transitions to `anki_review`
- Mastery one below threshold does NOT transition
- Wrong answer in `anki_review` increments lapseCount
- lapseCount reaching lapseThreshold (3) resets: phase=`learning`, masteryCount=0, lapseCount=0
- lapseCount one below threshold does NOT reset
- Correct answer in `anki_review` increments correctCount, does NOT change phase
- `updateMastery` does NOT mutate the input `WordState`

**Acceptance Criteria**:
- [ ] All test cases above pass
- [ ] `pnpm test` (srs-engine package) exits 0
- [ ] No `any` types; `updateMastery` returns a new `WordState` object

---

## 6. Success Criteria

1. `WordState`, `SrsConfig`, and all engine types are exported from `@gll/srs-engine`
2. `updateMastery` passes all unit tests
3. `pnpm test` exits green (all tests pass, 0 failures)
4. No TypeScript errors, no `any` types
