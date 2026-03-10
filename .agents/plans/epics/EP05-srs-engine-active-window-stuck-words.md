# EP05 - SRS Engine: Active Window + Stuck Words

**Created**: 20260306T014133Z
**Status**: Impl-Complete
**Status Changed**: 20260307T143000Z

<!-- Status: Draft | Accepted | In Progress | Impl-Complete | BDD Pending | Completed | Shelved | Withdrawn -->

**Type**: Epic Plan
**Depends on**: EP02
**Parallel with**: EP04, EP06
**Predecessor**: N/A

---

## Problem Statement

Without an active window limit, batch composition would attempt to work all words simultaneously, producing shallow learning. Without stuck word detection, words a learner repeatedly fails stay in rotation indefinitely and block forward progress.

## Scope

**In scope**:

- `packages/srs-engine/src/active-window.ts` — 8-word active limit, 4-new-words-per-batch cap, sliding window entry when a word reaches mastery threshold
- `packages/srs-engine/src/stuck-words.ts` — no mastery progress after 3 consecutive batches → shelved for 1 day; max 2 shelved at a time; shelved words re-enter as carry-over on next eligible batch
- Unit tests for both modules covering boundary conditions (exactly 8 active, exactly 2 shelved, re-entry timing)

**Out of scope**:

- Foundational deck active-word rules — EP06 (foundational has its own 3-active limit)
- Batch composition wiring — EP04/EP07

---

## Stories

### EP05-ST01: Active window management

**Scope**: Implement `active-window.ts` — `getEligibleWords(allWords, config)` returning words within the 8-word active limit and enforcing 4-new-per-batch cap; sliding entry logic when a word advances phase; unit tests

### EP05-ST02: Stuck word detection + shelving

**Scope**: Implement `stuck-words.ts` — `detectStuckWords(wordStates, config)` flagging words with no mastery progress in 3 consecutive batches; `shelveWord` / `unshelveWord` functions; max-2-shelved cap; re-entry as carry-over; unit tests covering shelving, cap enforcement, and re-entry

---

## Overall Acceptance Criteria

- [ ] Active window never exceeds 8 words
- [ ] Max 4 new words introduced per batch
- [ ] New words enter the active window as existing words advance to ANKI
- [ ] A word stuck for 3 batches is shelved for 1 day
- [ ] Max 2 words shelved at any time; when cap is reached, the newest stuck word is shelved (displaces nothing — 3rd word simply waits)
- [ ] Shelved words re-enter as carry-over after the shelve period
- [ ] Unit tests pass; `pnpm test` exits green

---

## Dependencies

- EP02 (WordState type — needs batch count and progress tracking fields)

## Next Steps

1. Review and approve this epic
2. Confirm in design spec: newest stuck word is shelved when cap is reached (decided 2026-03-05)
3. Create Design Spec
4. Begin ST01
