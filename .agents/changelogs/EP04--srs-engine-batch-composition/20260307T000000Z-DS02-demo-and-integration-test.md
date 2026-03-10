# EP04-DS02: Demo Script & Integration Test for Batch Composition

**Date**: 20260307T000000Z
**Status**: Accepted
**Epic**: [EP04 - SRS Engine: Batch Composition](../../plans/epics/EP04-srs-engine-batch-composition.md)
**Builds on**: DS01 (`composeBatch`, `Batch`, `Question`, `QuestionType` — already implemented)

---

## 1. Feature Overview

Two additions verify that `composeBatch` works correctly end-to-end with real word states produced by `updateMastery`:

1. **Demo script extension** — human-readable terminal output showing priority ordering and audio redistribution with a realistic mixed word pool
2. **Integration test** — automated CI coverage asserting that words driven through `updateMastery` are classified and ordered correctly by `composeBatch`

---

## 2. Core Requirements

| Requirement                                                   | Decision                                         | Rationale                                                                      |
| ------------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------ |
| Demo builds word pool via `updateMastery`                     | No hand-crafted phases in demo                   | Proves the two systems compose; matches how real sessions work                 |
| Integration test uses `updateMastery` to reach `srsM2_review` | Same — no mocked `phase` field                   | Catches regressions where mastery state shape diverges from batch expectations |
| Demo prints priority bucket labels                            | Annotate each question with its bucket           | Makes ordering rule visible at a glance                                        |
| Audio redistribution shown side-by-side                       | Two `composeBatch` calls, same pool              | Shows MC absorption clearly                                                    |
| Integration test lives in `__tests__/integration/`            | Consistent with `srs-lifecycle.test.ts` location | Cross-component tests separate from unit tests                                 |

---

## 3. Data Structures

No new types. Uses existing exports from `@gll/srs-engine`:

```typescript
import { updateMastery, composeBatch } from '@gll/srs-engine';
import type { SrsConfig, WordState, Batch } from '@gll/srs-engine';
```

---

## 4. Scenarios

```
Mixed word pool (8 words):
  2 curated  → driven to srsM2_review via updateMastery  (carry-over)
  1 foundational → driven to srsM2_review via updateMastery  (foundational revision)
  3 curated  → left in learning                           (new words)
  2 foundational → left in learning                       (foundational learning)
        ↓
  composeBatch(pool, config)
        ↓
  Scenario E: print each question with wordId + type + bucket label
  Expected order: carry-over → found.revision → new words → found.learning
        ↓
  Scenario F: run twice (audioAvailable true vs false)
  Print distributionBreakdown for each — audio=0 when unavailable, MC absorbs diff
```

---

## 5. Stories

### EP04-ST03: Demo Script Extension

**Scope**: Extend `scripts/demo-srs.ts` with Scenario E (priority ordering) and Scenario F (audio redistribution) using real `updateMastery` calls to build the word pool

**Read List**:

- `scripts/demo-srs.ts` (existing demo pattern)
- `packages/srs-engine/src/batch.ts` (composeBatch signature)
- `packages/srs-engine/src/index.ts` (confirm composeBatch export)

**Tasks**:

- [ ] Add `composeBatch` to the import from `@gll/srs-engine`
- [ ] Build mixed pool helper: drive curated/foundational words to `srsM2_review` via `updateMastery` loop; leave others in `learning`
- [ ] Add Scenario E: call `composeBatch`, print each question with `wordId`, `type`, and bucket label (`[carry-over]`, `[found.revision]`, `[new word]`, `[found.learning]`)
- [ ] Add Scenario F: call `composeBatch` twice with `audioAvailable: true` and `false`; print `distributionBreakdown` for each run
- [ ] Add header comments for each new scenario consistent with existing style

**Acceptance Criteria**:

- [ ] `pnpm tsx scripts/demo-srs.ts` runs without errors
- [ ] Scenario E output shows carry-over words listed before new words
- [ ] Scenario F output shows `audio: 0` and higher MC count when `audioAvailable: false`
- [ ] No TypeScript errors

---

### EP04-ST04: Integration Test — Batch Lifecycle

**Scope**: Add `__tests__/integration/batch-lifecycle.test.ts` asserting that words promoted via `updateMastery` are correctly prioritised by `composeBatch`

**Read List**:

- `packages/srs-engine/__tests__/integration/srs-lifecycle.test.ts` (test pattern)
- `packages/srs-engine/src/batch.ts` (priority grouping logic)
- `packages/srs-engine/src/types.ts` (`WordState`, `SrsConfig`)

**Tasks**:

- [ ] Create `packages/srs-engine/__tests__/integration/batch-lifecycle.test.ts`
- [ ] Test: words promoted to `srsM2_review` via `updateMastery` appear before `learning` words in batch
- [ ] Test: foundational words in `srsM2_review` appear after curated `srsM2_review` words
- [ ] Test: `distributionBreakdown` sums to `batchSize` with a real mixed pool
- [ ] Test: audio redistribution (`audioAvailable: false`) produces `audio: 0` with a real pool

**Acceptance Criteria**:

- [ ] All 4 integration tests pass
- [ ] `pnpm test` exits green (full suite)
- [ ] No TypeScript errors
- [ ] Test file follows `srs-lifecycle.test.ts` conventions (same imports, same `describe`/`it` style)

---

## 6. Success Criteria

1. `pnpm tsx scripts/demo-srs.ts` prints Scenario E and F output without errors
2. Scenario E shows correct priority ordering with bucket labels
3. Scenario F shows `audio: 0` and correct MC absorption when `audioAvailable: false`
4. `__tests__/integration/batch-lifecycle.test.ts` contains 4 passing tests
5. `pnpm test` exits green
6. No TypeScript errors
