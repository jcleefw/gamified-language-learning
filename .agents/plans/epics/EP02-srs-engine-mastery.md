# EP02 - SRS Engine Core: Mastery + ANKI Scheduling

**Created**: 2026-03-05
**Status**: Impl-Complete
<!-- Status: Draft | Accepted | In Progress | Impl-Complete | BDD Pending | Completed | Shelved | Withdrawn -->
**Type**: Epic Plan
**Depends on**: EP01
**Parallel with**: N/A
**Predecessor**: N/A

---

## Problem Statement

The SRS engine has no mastery tracking, phase transition logic, or interval scheduling. Without these, the engine cannot determine when a word is learned well enough to enter ANKI review, calculate its next review interval, or detect a lapse back to active learning.

## Scope

### Phase 1: Mastery + Phase Transitions (EP02-PH01)

**In scope**:
- `packages/srs-engine/src/types.ts` — `WordState`, `MasteryPhase`, `WordCategory`, `SrsConfig`, `QuizAnswer`, `FsrsCardState`, and all engine-owned types
- `packages/srs-engine/src/mastery.ts` — `updateMastery(state, isCorrect, config)`: mastery counting (+1 correct / -1 wrong, floor 0), configurable thresholds (5 foundational, 10 curated), Learning → ANKI transition, 3-lapse ANKI → Learning reset
- Unit tests for all mastery functions (strict TDD)

### Phase 2: ANKI Scheduling (EP02-PH02)

**In scope**:
- `packages/srs-engine/src/scheduling/scheduler.interface.ts` — `SpacedRepetitionScheduler` interface + `ReviewResult` type
- `packages/srs-engine/src/scheduling/FsrsScheduler.ts` — `ts-fsrs` adapter implementing the interface; FSRS desired retention 0.90, 90-day max interval cap
- `ts-fsrs` added as a runtime dependency
- Unit tests: correct interval increases, wrong answer triggers lapse, 90-day cap enforced

### Phase 3: Demo Checkpoint (EP02-PH03)

**In scope**:
- `scripts/demo-srs.ts` — minimal `tsx` script exercising `updateMastery` + `FsrsScheduler` directly on 1 word; shows mastery count incrementing, Learning → ANKI transition, and first ANKI interval printed to stdout
- No batch composition, no active window, no wiring beyond the two engine functions

**Out of scope**:
- Batch composition — EP03
- Active window + stuck words — EP04
- Foundational deck mechanics — EP05
- `SrsEngine` class orchestration — EP06

---

## Stories

### Phase 1: Mastery + Phase Transitions (EP02-PH01)

### EP02-ST01: Engine types
**Scope**: Define all engine-owned types in `src/types.ts`; export from `src/index.ts`

### EP02-ST02: Mastery counting + phase transition
**Scope**: Implement `src/mastery.ts` — `updateMastery` pure function with full unit test coverage (strict TDD)

### Phase 2: ANKI Scheduling (EP02-PH02)

### EP02-ST03: SpacedRepetitionScheduler interface + ReviewResult type
**Scope**: Define `scheduler.interface.ts` and `src/scheduling/types.ts`; export from `index.ts`

### EP02-ST04: FsrsScheduler adapter
**Scope**: Implement `FsrsScheduler` wrapping `ts-fsrs`; unit tests for all review paths and 90-day cap

### Phase 3: Demo Checkpoint (EP02-PH03)

### EP02-ST05: SRS core demo script
**Scope**: `scripts/demo-srs.ts` — direct calls to `updateMastery` + `FsrsScheduler`; human can run `tsx scripts/demo-srs.ts` and observe a word progressing Learning → ANKI with interval output

---

## Overall Acceptance Criteria

- [ ] `WordState`, `SrsConfig`, and all engine types exported from `@gll/srs-engine`; no `any` types
- [ ] Correct answer increments mastery; wrong answer decrements (floor 0)
- [ ] Mastery reaching threshold transitions phase from Learning → ANKI
- [ ] 3 lapses in ANKI resets phase to Learning and mastery to 0
- [ ] `FsrsScheduler` produces increasing intervals on correct answers; lapse on wrong
- [ ] No interval exceeds 90 days
- [ ] `tsx scripts/demo-srs.ts` runs without errors and prints observable output
- [ ] All unit tests pass; `pnpm test` (srs-engine package) exits green

---

## Dependencies

- EP01 (monorepo scaffold — package must exist before implementation)

## Next Steps

1. DS01 (mastery types + function signatures) — Approved
2. Create DS02 covering ANKI scheduling signatures and ts-fsrs mapping
3. Begin ST01
