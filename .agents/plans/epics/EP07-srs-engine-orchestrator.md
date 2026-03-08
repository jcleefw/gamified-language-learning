# EP07 - SRS Engine: Answer Processing + SrsEngine Class

**Created**: 20260306T014133Z
**Status**: Impl-Complete
**Status Changed**: 20260308T152200Z
<!-- Status: Draft | Accepted | In Progress | Impl-Complete | BDD Pending | Completed | Shelved | Withdrawn -->
**Type**: Epic Plan
**Depends on**: EP02, EP04, EP05, EP06
**Parallel with**: N/A
**Predecessor**: N/A

---

## Problem Statement

The individual engine modules (mastery, scheduling, batch, active window, stuck words, foundational) need a single orchestrator that wires them together behind the public API. Without this, callers must know about every internal module — coupling them to implementation details.

## Scope

**In scope**:
- `packages/srs-engine/src/srs-engine.ts` — `SrsEngine` class (config baked in at construction)
- `engine.composeBatch(wordStates)` — delegates to `batch.ts` with active window + foundational filtering applied
- `engine.processAnswers(answers, wordStates)` — applies mastery updates, phase transitions, ANKI scheduling, stuck word detection, returns `UpdatedWordState[]`
- `SrsConfig` validation on construction (batch size > 0, thresholds > 0, etc.)
- Integration tests (5–10 lifecycle scenarios): Phase 1 → ANKI, lapse → Phase 1, stuck word shelving + re-entry, foundational depletion shift

**Out of scope**:
- Any I/O — the class remains purely in-memory
- `SrsEngine.create()` factory — may be added later; `new SrsEngine()` is sufficient for now

---

## Stories

### EP07-ST01: SrsEngine class + config validation
**Scope**: Implement `SrsEngine` constructor accepting `SrsConfig`; validate config on construction (throw on invalid values); wire `composeBatch` delegating to EP04 batch logic with EP05 active window filtering; unit tests for config validation

### EP07-ST02: processAnswers + integration tests
**Scope**: Implement `processAnswers(answers, wordStates)` — orchestrates mastery update (EP02-PH01), ANKI scheduling (EP02-PH02), foundational wrong rule (EP06), stuck word detection (EP05); returns `UpdatedWordState[]`; 5–10 integration tests covering full lifecycle scenarios

---

## Overall Acceptance Criteria

- [ ] `new SrsEngine(config)` throws a descriptive error if config is invalid
- [ ] `engine.composeBatch(wordStates)` returns a valid `Batch` of `batchSize` questions
- [ ] `engine.processAnswers(answers, states)` returns updated states with correct mastery, phase, and scheduling changes
- [ ] Integration tests pass covering: Learning → ANKI transition, 3-lapse ANKI → Learning reset, stuck word shelved after 3 batches, shelved word re-enters as carry-over, foundational continuous wrong reset
- [ ] `pnpm test` exits green for full srs-engine package

---

## Dependencies

- EP02 (mastery + types + ANKI scheduling)
- EP04 (batch composition)
- EP05 (active window + stuck words)
- EP06 (foundational deck)

## Next Steps

1. Review and approve this epic
2. Confirm exact `processAnswers` return shape in design spec (same `WordState` updated in place vs. new object?)
3. Create Design Spec
4. Begin ST01 only after EP02–EP06 are Impl-Complete
