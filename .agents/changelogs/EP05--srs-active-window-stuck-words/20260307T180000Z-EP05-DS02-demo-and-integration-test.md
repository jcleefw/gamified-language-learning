# EP05-DS02: Demo Script & Integration Test for Active Window + Stuck Words

**Date**: 20260307T180000Z
**Status**: Draft
**Epic**: [EP05 - SRS Engine: Active Window + Stuck Words](../../plans/epics/EP05-srs-engine-active-window-stuck-words.md)
**Builds on**: DS01 (`getEligibleWords`, `detectStuckWords`, `shelveWord`, `unshelveWord`, `isShelved` — already implemented)

---

## 1. Feature Overview

Two additions verify that the EP05 modules work correctly end-to-end with real word states produced by `updateMastery`:

1. **Demo script extension** — human-readable terminal output showing active window slot calculation and stuck word detection/shelving with realistic word pools
2. **Integration test** — automated CI coverage asserting that words driven through `updateMastery` are correctly classified by `getEligibleWords` and that `detectStuckWords` + shelve/unshelve transitions behave correctly as a unit

---

## 2. Core Requirements

| Requirement                                                                   | Decision                                                 | Rationale                                                                              |
| ----------------------------------------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Demo builds active pool via `updateMastery`                                   | No hand-crafted `phase` fields in demo                   | Proves modules compose; mirrors real session flow                                      |
| Demo sets `batchesSinceLastProgress` directly for stuck scenarios             | Field is set by the calling layer (not by updateMastery) | Caller responsibility is explicit in design; demo must exercise it directly            |
| Integration test uses `updateMastery` to reach `srsM2_review`                 | Same — no mocked `phase` field                           | Catches regressions where mastery state shape diverges from active-window expectations |
| Integration test for stuck detection sets `batchesSinceLastProgress` directly | Field is caller-managed; test owns that responsibility   | Validates correct interaction between caller-set field and detectStuckWords            |
| Integration test lives in `__tests__/integration/`                            | Consistent with existing location                        | Cross-component tests separate from unit tests                                         |

---

## 3. Data Structures

No new types. Uses existing exports from `@gll/srs-engine`:

```typescript
import {
  updateMastery,
  getEligibleWords,
  detectStuckWords,
  shelveWord,
  unshelveWord,
  isShelved,
} from '@gll/srs-engine';
import type {
  SrsConfig,
  WordState,
  EligibleWordsResult,
  StuckWordsResult,
} from '@gll/srs-engine';
```

---

## 4. Scenarios

### Demo Scenarios

```
Scenario G — Active window slot calculation:
  Build pool via updateMastery:
    4 curated words driven to srsM2_review  (active)
    3 curated words left in learning        (eligible new words)
    2 foundational words left in learning   (eligible new words)
        ↓
  getEligibleWords(pool, config)
        ↓
  Print: active count, newSlots, eligible count
  Show effect of filling up active window:
    Add 4 more srsM2_review words → newSlots = 0 (at limit)

Scenario H — Stuck word detection + shelving:
  Build word pool, manually set batchesSinceLastProgress:
    2 words with batchesSinceLastProgress = 5  (stuck)
    1 word  with batchesSinceLastProgress = 2  (not yet stuck)
    1 word  with batchesSinceLastProgress = 0  (fine)
        ↓
  detectStuckWords(pool, config)
        ↓
  Print: stuck count, toShelve list, canReShelve flag
  Show shelveWord() call and isShelved() check
  Show unshelveWord() clearing shelved status
  Show cap behaviour: shelve 2 words first, then detect 3rd stuck word
    → canReShelve = false, toShelve = [newest stuck word]
```

### Integration Test Scenarios

```
Test 1: Words promoted via updateMastery are counted as active by getEligibleWords
Test 2: newSlots decreases as active count grows (sliding window)
Test 3: detectStuckWords identifies words with batchesSinceLastProgress >= shelveAfterBatches
Test 4: shelveWord + isShelved + unshelveWord state transitions work end-to-end
```

---

## 5. Stories

### EP05-ST03: Demo Script Extension

**Scope**: Extend `scripts/demo-srs.ts` with Scenario G (active window slots) and Scenario H (stuck word detection + shelving) using `updateMastery` to build the word pool and direct field assignment for caller-managed fields

**Read List**:

- `scripts/demo-srs.ts` (existing demo pattern — scenarios A–F)
- `packages/srs-engine/src/active-window.ts` (`getEligibleWords` signature)
- `packages/srs-engine/src/stuck-words.ts` (`detectStuckWords`, `shelveWord`, `unshelveWord`, `isShelved` signatures)
- `packages/srs-engine/src/index.ts` (confirm all exports present)

**Tasks**:

- [ ] Add `getEligibleWords`, `detectStuckWords`, `shelveWord`, `unshelveWord`, `isShelved` to the import from `@gll/srs-engine`
- [ ] Add Scenario G: Active window slot calculation
  - Drive 4 curated words to `srsM2_review` via `updateMastery` loop
  - Leave 3 curated + 2 foundational in `learning`
  - Call `getEligibleWords(pool, config)`, print `active.length`, `newSlots`, `eligible.length`
  - Add 4 more `srsM2_review` words to show `newSlots = 0` at the active limit
- [ ] Add Scenario H: Stuck word detection + shelving
  - Build pool of 4 words, set `batchesSinceLastProgress` directly (2 stuck at 5, 1 at 2, 1 at 0)
  - Call `detectStuckWords(pool, config)`, print `stuck.length`, `toShelve` wordIds, `canReShelve`
  - Call `shelveWord()` on one word, verify `isShelved()` returns true, print result
  - Call `unshelveWord()` on same word, verify `isShelved()` returns false, print result
  - Show cap behaviour: pre-shelve 2 words, detect 3rd stuck word, print `canReShelve = false`
- [ ] Add header comments for each new scenario consistent with existing style (`// ── Scenario X: ...`)

**Acceptance Criteria**:

- [ ] `pnpm tsx scripts/demo-srs.ts` runs without errors
- [ ] Scenario G output shows correct `active`, `newSlots`, `eligible` counts; `newSlots = 0` when at active limit
- [ ] Scenario H output shows stuck words detected, shelve/unshelve transitions, cap behaviour with `canReShelve = false`
- [ ] No TypeScript errors

---

### EP05-ST04: Integration Test — Active Window + Stuck Words Lifecycle

**Scope**: Add `packages/srs-engine/__tests__/integration/active-window-lifecycle.test.ts` asserting that words promoted via `updateMastery` are correctly classified by `getEligibleWords` and that `detectStuckWords` + shelve/unshelve transitions compose correctly

**Read List**:

- `packages/srs-engine/__tests__/integration/batch-lifecycle.test.ts` (test pattern — imports, describe/it style, config shape)
- `packages/srs-engine/__tests__/integration/srs-lifecycle.test.ts` (additional pattern reference)
- `packages/srs-engine/src/active-window.ts` (`getEligibleWords` logic)
- `packages/srs-engine/src/stuck-words.ts` (`detectStuckWords`, shelve/unshelve logic)
- `packages/srs-engine/src/types.ts` (`WordState`, `SrsConfig`)

**Tasks**:

- [ ] Create `packages/srs-engine/__tests__/integration/active-window-lifecycle.test.ts`
- [ ] Add file-level doc comment (scenarios covered) consistent with `batch-lifecycle.test.ts` style
- [ ] Test 1: Words promoted to `srsM2_review` via `updateMastery` are counted as active by `getEligibleWords`
  - Drive 2 words to `srsM2_review`; leave 3 in `learning`
  - Assert `result.active.length === 2` and `result.eligible.length === 3`
- [ ] Test 2: `newSlots` decreases as active count grows toward `activeWordLimit`
  - Build pool of `activeWordLimit` promoted words + some learning words
  - Assert `result.newSlots === 0`
  - Verify intermediate: N active words → `newSlots = min(newWordsPerBatch, activeWordLimit - N)`
- [ ] Test 3: `detectStuckWords` identifies words with `batchesSinceLastProgress >= shelveAfterBatches`
  - Build pool; set `batchesSinceLastProgress` on some words (above and below threshold)
  - Assert only threshold-crossing words appear in `stuck`
  - Assert `toShelve` respects `maxShelved` cap
- [ ] Test 4: `shelveWord` + `isShelved` + `unshelveWord` state transitions work end-to-end
  - Call `shelveWord(word, 86_400_000)` → assert `isShelved()` returns `true`
  - Call `unshelveWord(word)` → assert `isShelved()` returns `false`
  - Set `shelvedUntil` to past date → assert `isShelved()` returns `false` (expired)

**Acceptance Criteria**:

- [ ] All 4 integration tests pass
- [ ] `pnpm test` exits green (full suite)
- [ ] No TypeScript errors
- [ ] Test file follows `batch-lifecycle.test.ts` conventions (same imports, same `describe`/`it` style, file-level doc comment)

---

## 6. Success Criteria

1. `pnpm tsx scripts/demo-srs.ts` prints Scenario G and H output without errors
2. Scenario G shows correct active/newSlots/eligible counts, including `newSlots = 0` at the window limit
3. Scenario H shows stuck detection, shelve/unshelve transitions, and cap behaviour with `canReShelve = false`
4. `__tests__/integration/active-window-lifecycle.test.ts` contains 4 passing tests
5. `pnpm test` exits green
6. No TypeScript errors
