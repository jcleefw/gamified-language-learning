# EP04-DS01: SRS Engine Batch Composition Specification

**Date**: 20260306T020000Z
**Status**: Accepted
**Epic**: [EP04 - SRS Engine: Batch Composition](../../plans/epics/EP04-srs-engine-batch-composition.md)

---

## 1. Feature Overview

The `composeBatch` function builds a quiz batch of exactly `batchSize` questions (default 15) from a pool of `WordState` objects following strict priority ordering and question type distribution rules. The function:

- Orders words by mastery progression: carry-over words → foundational revision → new words → foundational learning
- Distributes questions across three types: 70% multiple choice (MC), 20% word-block, 10% audio
- Handles audio unavailability by redistributing audio slots to MC
- Returns a typed `Batch` containing `Question` objects with distribution metadata

---

## 2. Core Requirements

| Requirement          | Decision                                                               | Rationale                                                                                         |
| -------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Batch size           | Configurable via `SrsConfig.batchSize` (default 15)                    | Allows testing with small batches and production with standard batches                            |
| Priority ordering    | carry-over → foundational revision → new words → foundational learning | Maximizes retention: review mastered words, deepen foundational knowledge, introduce new material |
| Distribution ratios  | 70% MC / 20% word-block / 10% audio                                    | MC builds confidence, word-block tests active recall, audio adds multi-sensory learning           |
| Audio redistribution | Audio slots → MC when `audioAvailable: false`                          | Ensures all question slots filled without breaking distribution                                   |
| Integer rounding     | Round up MC/word-block; remainder goes to whichever is closest         | Acceptable per AC; ensures batchSize consistency                                                  |
| Type safety          | Explicit enum for `QuestionType`                                       | Prevents typos, enables IDE autocomplete                                                          |

---

## 3. Data Structures

```typescript
export type QuestionType = 'mc' | 'wordBlock' | 'audio';

export interface Question {
  wordId: string;
  type: QuestionType;
}

export interface Batch {
  questions: Question[];
  batchSize: number;
  distributionBreakdown: {
    mc: number;
    wordBlock: number;
    audio: number;
  };
}

export interface ComposeBatchOptions {
  audioAvailable?: boolean; // default: true
}

/**
 * Build a batch of questions from word states following priority order and distribution rules.
 * @param wordStates - Array of word states to compose from
 * @param config - SRS configuration with batchSize and questionTypeSplit
 * @param options - Options (e.g., audioAvailable flag)
 * @returns Batch with questions and distribution breakdown
 */
export function composeBatch(
  wordStates: WordState[],
  config: SrsConfig,
  options?: ComposeBatchOptions,
): Batch;
```

---

## 4. User Workflows

```
Quiz Session Request (Terminal Runner / API)
           ↓
    composeBatch(wordStates, config)
           ↓
   Order by priority:
   1. Carry-over (curated, mastered, active)
   2. Foundational revision (foundational, active)
   3. New words (curated, not mastered)
   4. Foundational learning (foundational, not active)
           ↓
   Slice to batchSize
           ↓
   Allocate question types:
   MC ≈ 70%, word-block ≈ 20%, audio ≈ 10%
           ↓
   Check audioAvailable?
   [No] → redistribute audio → MC
   [Yes] → keep distribution
           ↓
   Assign types to words
   (round-robin or sequential)
           ↓
   Return Batch with breakdown
           ↓
    Terminal/API consumes batch
    Quiz session generated
```

---

## 5. Stories

### EP04-ST01: Batch Types & Priority Ordering

**Scope**: Define `Batch`, `Question`, `QuestionType` types; implement priority ordering logic in `composeBatch`; unit tests for ordering

**Read List**:

- `packages/srs-engine/src/types.ts` (existing `WordState`, `SrsConfig`)
- `packages/srs-engine/src/__tests__/mastery.test.ts` (test pattern reference)

**Tasks**:

- [ ] Add type definitions to `packages/srs-engine/src/types.ts`: `QuestionType`, `Question`, `Batch`
- [ ] Create `packages/srs-engine/src/batch.ts` with `composeBatch` function skeleton
- [ ] Implement priority ordering algorithm:
  - Group `wordStates` by (category, mastery status, active flag)
  - Concatenate in priority order: carry-over → foundational revision → new → foundational learning
  - Slice to `config.batchSize`
- [ ] Create `packages/srs-engine/src/__tests__/batch.test.ts` with ordering tests
- [ ] Test: Verify priority order respected with mixed word states
- [ ] Test: Edge case — fewer words than batchSize returns available words

**Acceptance Criteria**:

- [ ] Priority ordering algorithm correctly groups and concatenates words in order
- [ ] Batch size respects `config.batchSize` (or available words if fewer)
- [ ] Unit tests pass for ordering with 4 priority categories
- [ ] Unit tests pass for edge case (pool < batchSize)
- [ ] No TypeScript errors

---

### EP04-ST02: Question Type Distribution & Audio Redistribution

**Scope**: Implement 70/20/10 MC/word-block/audio split on ordered questions; redistribute audio to MC when unavailable; unit tests for distribution and redistribution

**Read List**:

- `packages/srs-engine/src/batch.ts` (from ST01)
- `packages/srs-engine/src/types.ts` (reference `SrsConfig.questionTypeSplit`)

**Tasks**:

- [ ] Implement distribution algorithm:
  - Calculate slot counts: `mc = Math.ceil(batchSize * 0.70)`, `wordBlock = Math.ceil(batchSize * 0.20)`, `audio = batchSize - mc - wordBlock`
  - Assign types to questions round-robin or sequential
- [ ] Implement audio redistribution:
  - Accept `options.audioAvailable` parameter (default: true)
  - If false: shift all audio slots to MC, update `distributionBreakdown`
- [ ] Populate `Batch.distributionBreakdown` with actual counts
- [ ] Add unit tests to `packages/srs-engine/src/__tests__/batch.test.ts`:
  - Test distribution ratios match target split (70/20/10)
  - Test audio redistribution when `audioAvailable: false`
  - Test `distributionBreakdown` matches actual allocation
  - Test total = batchSize in all cases
- [ ] Export `composeBatch` and new types from `packages/srs-engine/src/index.ts`

**Acceptance Criteria**:

- [ ] Question type split is ~70% MC, ~20% word-block, ~10% audio (integer rounding acceptable)
- [ ] When `audioAvailable: false`, audio slots redirect to MC
- [ ] `distributionBreakdown` accurately reflects actual allocation
- [ ] All unit tests pass; `pnpm test` exits green
- [ ] `composeBatch`, `Batch`, `Question`, `QuestionType` exported from package public API

**Out of scope**: Shuffling or randomising question display order. `composeBatch` always returns questions in deterministic priority order. If the calling layer (terminal runner, API, UI) wants to present questions in a different order, it applies its own shuffle — the engine does not.

---

## 6. Success Criteria

1. `composeBatch(wordStates, config, options?)` returns a `Batch` with exactly `batchSize` questions (or fewer if pool < batchSize)
2. Priority ordering verified: carry-over → foundational revision → new words → foundational learning
3. Question type distribution: ~70% MC, ~20% word-block, ~10% audio (integer rounding acceptable)
4. Audio redistribution: when `audioAvailable: false`, all audio slots become MC
5. All unit tests pass; `pnpm test` shows green
6. CODEMAP.md updated with new files and exports
7. No TypeScript errors
