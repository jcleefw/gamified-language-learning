# EP06 - SRS Engine: Foundational Deck

**Created**: 20260306T014133Z
**Status**: Draft
**Status Changed**: 20260306T014133Z
<!-- Status: Draft | Accepted | In Progress | Impl-Complete | BDD Pending | Completed | Shelved | Withdrawn -->
**Type**: Epic Plan
**Depends on**: EP02
**Parallel with**: EP04, EP05
**Predecessor**: N/A

---

## Problem Statement

Foundational decks (high-frequency vocabulary) follow different mechanics than curated decks: a separate active limit, a continuous-wrong reset rule, and a dynamic batch allocation that shrinks as the foundational pool depletes. Without this module, foundational words would be treated identically to curated words and the learning curve would be wrong.

## Scope

**In scope**:
- `packages/srs-engine/src/foundational.ts` — foundational deck mechanics
- 3-active-at-a-time limit for foundational words (separate from the 8-word curated active window)
- Continuous wrong rule: 3 consecutive wrong answers → mastery reset to 0 (not a lapse — Learning phase only)
- Batch allocation: 20% of batch slots allocated to foundational words; drops to 5% once foundational pool is depleted
- Unit tests covering all three mechanics and boundary conditions

**Out of scope**:
- Foundational deck CRUD (what words are in the deck) — calling layer concern
- Foundational words entering ANKI phase — same ANKI scheduler as curated (EP02-PH02)
- Batch slot wiring into `composeBatch` — EP04/EP07

---

## Stories

### EP06-ST01: Foundational active limit + continuous wrong rule
**Scope**: Implement `foundational.ts` — `getActiveFoundationalWords(words, config)` enforcing 3-active cap; `applyFoundationalWrongRule(wordState, consecutiveWrong)` resetting mastery on 3rd consecutive wrong; unit tests

### EP06-ST02: Foundational batch allocation
**Scope**: Implement allocation logic — `getFoundationalAllocation(totalBatchSize, poolDepleted, config)` returning slot count (20% normal, 5% post-depletion); depleted = all active foundational words have passed mastery threshold; unit tests for both allocation modes

---

## Overall Acceptance Criteria

- [ ] Max 3 foundational words active at any time
- [ ] 3 consecutive wrong answers on a foundational word resets mastery to 0 (no phase change)
- [ ] Foundational words receive ~20% of batch slots when pool is active
- [ ] Foundational allocation drops to ~5% when pool is depleted
- [ ] Unit tests pass; `pnpm test` exits green

---

## Dependencies

- EP02 (WordState type — needs foundational flag and consecutive-wrong counter)

## Next Steps

1. Review and approve this epic
2. Create Design Spec (depleted = all active foundational words past mastery threshold — decided 2026-03-05)
3. Begin ST01