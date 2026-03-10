# EP04 - SRS Engine: Batch Composition

**Created**: 20260306T014133Z
**Status**: Impl-Complete
**Status Changed**: 20260307T054200Z

<!-- Status: Draft | Accepted | In Progress | Impl-Complete | BDD Pending | Completed | Shelved | Withdrawn -->

**Type**: Epic Plan
**Depends on**: EP02
**Parallel with**: EP05, EP06
**Predecessor**: N/A

---

## Problem Statement

The engine needs to build a batch of 15 questions from a pool of word states following strict priority ordering and question type distribution rules. Without this, the terminal runner and eventual API have no way to produce a quiz session.

## Scope

**In scope**:

- `packages/srs-engine/src/batch.ts` — `composeBatch(wordStates, config)` returning a typed `Batch`
- Priority ordering: carry-over words → foundational revision → new words → foundational learning
- Question type distribution: 70% multiple choice / 20% word-block / 10% audio; redistribution when audio unavailable
- `Batch` and `Question` types
- Unit tests: priority ordering respected, distribution ratios correct, audio redistribution when audio flag absent

**Out of scope**:

- Active window management (which words are eligible) — EP05
- Foundational deck mechanics (allocation %) — EP06
- `SrsEngine` class wiring — EP07

---

## Stories

### EP04-ST01: Batch types + priority ordering

**Scope**: Define `Batch`, `Question`, `QuestionType` types; implement priority ordering logic in `composeBatch` (carry-over → foundational revision → new words → foundational learning); unit tests for ordering

### EP04-ST02: Question type distribution + audio redistribution

**Scope**: Implement 70/20/10 MC/word-block/audio split on the ordered question list; redistribute audio slots to MC when `audioAvailable: false`; unit tests for both distribution and redistribution paths

---

## Overall Acceptance Criteria

- [ ] `composeBatch` returns exactly `batchSize` questions (default 15)
- [ ] Priority ordering is respected: carry-over first, foundational revision second, new words third, foundational learning last
- [ ] Question type split is ~70% MC, ~20% word-block, ~10% audio (integer rounding acceptable)
- [ ] When audio is unavailable, audio slots redistribute to MC
- [ ] Unit tests pass; `pnpm test` exits green

---

## Dependencies

- EP02 (WordState + SrsConfig types)

## Next Steps

1. Review and approve this epic
2. Create Design Spec covering exact `Batch`/`Question` type shapes and priority algorithm
3. Begin ST01
