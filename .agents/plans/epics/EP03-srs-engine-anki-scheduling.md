# EP03 - SRS Engine: ANKI Scheduling

**Created**: 20260306T013219Z
**Status**: Withdrawn
**Status Changed**: 20260306T013219Z

<!-- Status: Draft | Accepted | In Progress | Impl-Complete | BDD Pending | Completed | Shelved | Withdrawn -->

**Type**: Epic Plan
**Depends on**: EP02
**Predecessor**: N/A
**Note**: Scope merged into EP02 (as EP02-PH02). EP03 withdrawn 2026-03-06.

---

## Problem Statement

Words that reach ANKI phase need spaced repetition interval scheduling. The engine requires a scheduling abstraction (so the algorithm can be swapped later) and a concrete `ts-fsrs` adapter as the initial implementation.

## Scope

**In scope**:

- `packages/srs-engine/src/scheduling/scheduler.interface.ts` — `SpacedRepetitionScheduler` interface (`scheduleReview`, `getNextInterval`)
- `packages/srs-engine/src/scheduling/fsrs-scheduler.ts` — `FsrsScheduler` implementing the interface using `ts-fsrs` (FSRS desired retention 0.90, 90-day max interval cap)
- `ReviewResult` type (next interval days, updated ease factor, updated FSRS state)
- `ts-fsrs` added as a runtime dependency of `packages/srs-engine`
- Unit tests: correct interval increases, wrong answer triggers lapse, 90-day cap enforced

**Out of scope**:

- Hooking the scheduler into batch composition — EP04/EP07
- Custom scheduler implementation — future, if `ts-fsrs` doesn't fit lapse rules
- `date-fns` added only if interval date math is needed here (assess during implementation)

---

## Stories

### EP03-ST01: SpacedRepetitionScheduler interface + ReviewResult type

**Scope**: Define `scheduler.interface.ts` with `SpacedRepetitionScheduler` interface and `ReviewResult` type; export from `index.ts`

### EP03-ST02: FsrsScheduler adapter

**Scope**: Implement `FsrsScheduler` wrapping `ts-fsrs` — `scheduleReview(wordState, isCorrect)` returns `ReviewResult` with next interval respecting 90-day cap; unit tests covering correct/wrong paths and cap enforcement

---

## Overall Acceptance Criteria

- [ ] `SpacedRepetitionScheduler` interface is defined and exported
- [ ] `FsrsScheduler` implements the interface using `ts-fsrs`
- [ ] Correct answer produces increasing intervals (FSRS default behavior)
- [ ] Wrong answer in ANKI phase produces a lapse (interval resets, ease factor reduced)
- [ ] No interval exceeds 90 days
- [ ] Unit tests pass; `pnpm test` exits green

---

## Dependencies

- EP02 (WordState type must exist for scheduler to accept it)

## Next Steps

1. Review and approve this epic
2. Confirm whether `ts-fsrs` supports 3-lapse fallback natively (open question from ADR)
3. Create Design Spec covering exact method signatures and FSRS config params
4. Begin ST01
