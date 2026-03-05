# EP02 - SRS Engine: Mastery + Phase Transitions

**Created**: 2026-03-05
**Status**: Accepted
<!-- Status: Draft | Accepted | In Progress | Impl-Complete | BDD Pending | Completed | Shelved | Withdrawn -->
**Type**: Epic Plan
**Depends on**: EP01
**Predecessor**: N/A

---

## Problem Statement

The SRS engine has no mastery tracking or phase transition logic. Without this, the engine cannot determine when a word has been learned well enough to enter ANKI scheduling or when an ANKI word has lapsed back to active learning.

## Scope

**In scope**:
- `packages/srs-engine/src/types.ts` — `WordState`, `MasteryPhase`, `SrsConfig`, and all engine-owned types
- `packages/srs-engine/src/mastery.ts` — mastery counting (+1 correct / -1 wrong, floor 0), configurable thresholds (5 foundational, 10 curated), phase transition logic (Learning → ANKI on threshold), lapse reset (ANKI → Learning on 3 lapses, mastery reset to 0)
- Unit tests for all mastery functions (strict TDD)

**Out of scope**:
- ANKI interval calculation — EP03
- Batch composition — EP04
- `SrsEngine` class orchestration — EP07

---

## Stories

### EP02-ST01: Engine types
**Scope**: Define `WordState`, `MasteryPhase` enum, `SrsConfig`, `QuizAnswer`, and any other types needed by mastery logic in `types.ts`; exported from `index.ts`

### EP02-ST02: Mastery counting + phase transition
**Scope**: Implement `mastery.ts` — `updateMastery(state, isCorrect, config)` returning updated `WordState` with correct/wrong counting, floor-at-0, threshold-triggered Learning → ANKI transition, and 3-lapse ANKI → Learning reset; full unit test coverage

---

## Overall Acceptance Criteria

- [ ] `WordState` type captures: word ID, mastery count, phase (Learning/ANKI), lapse count, correct count, wrong count
- [ ] Correct answer increments mastery; wrong answer decrements (floor 0)
- [ ] Mastery reaching threshold transitions phase from Learning → ANKI
- [ ] 3 lapses in ANKI resets phase to Learning and mastery to 0
- [ ] All unit tests pass; `pnpm test` (srs-engine package) exits green

---

## Dependencies

- EP01 (monorepo scaffold — package must exist before implementation)

## Next Steps

1. Review and approve this epic
2. Create Design Spec covering exact `WordState` shape and function signatures
3. Begin ST01 (types first, then implementation in ST02)