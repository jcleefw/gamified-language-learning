# EP22 - Auto-Script SRS Quiz Runner

**Created**: 2026-03-20
**Status**: Draft

<!-- Status: Draft | Accepted | In Progress | Impl-Complete | BDD Pending | Completed | Shelved | Withdrawn -->

**Type**: Epic Plan
**Depends on**: N/A
**Parallel with**: EP21
**Predecessor**: N/A

---

## Problem Statement

Manual quiz answering is slow for testing the SRS engine. Testers must manually select decks, answer every question, and continue batches, which blocks rapid iteration. Need automated quiz runner to quickly validate different test scenarios (perfect mastery progression, realistic accuracy patterns, edge cases) without manual input.

## Scope

**In scope**:

- Auto-answerer module with pluggable answer strategies (correct answers, random, weighted accuracy)
- Automated deck selection (first deck by default)
- Automated batch continuation (auto-continue until no more questions)
- Maintain original interactive mode (non-breaking)
- Support three test scenarios: perfect runs, variable accuracy (80/20), edge case validation

**Out of scope**:

- Core SRS engine modifications
- Graphical output or detailed test reports
- Performance/stress testing infrastructure
- Deck randomization or custom deck selection

---

## Stories

### EP22-ST01: Create Auto-Answerer Module

**Scope**: Implement answer strategy pattern with correct, random, and weighted-accuracy strategies.

### EP22-ST02: Create Automated Interactive Runner

**Scope**: Build auto versions of selectDeck, runInteractive, and runAdaptiveLoop that use answer strategies.

### EP22-ST03: Update Main Runner for Auto Mode

**Scope**: Add AUTO_MODE flag to main.ts; conditionally use interactive or auto runner.

### EP22-ST04: Implement Test Scenarios

**Scope**: Configure and validate three test scenarios (perfect, variable 80/20, edge cases).

### EP22-ST05: Verify Output and Review Capability

**Scope**: Ensure auto output is readable for result review (scores, word state, mastery progression).

---

## Overall Acceptance Criteria

- [ ] Auto-answerer module has at least 3 strategies (correct, random, weighted)
- [ ] Auto mode runs full quiz loop without manual input
- [ ] Original interactive mode remains functional
- [ ] Script successfully runs all three test scenarios
- [ ] Output clearly shows quiz results and word mastery progression
- [ ] No changes to core SRS engine logic

---

## Dependencies

- None (independent epic, can run parallel with EP21)

## Next Steps

1. Review and approve plan
2. Begin implementation (EP22-ST01)
