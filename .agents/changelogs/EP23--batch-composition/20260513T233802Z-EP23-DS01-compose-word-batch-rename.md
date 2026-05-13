# EP23-DS01: Word Batch Rename & `QuizQuestion` Type System

**Date**: 20260513T233802Z
**Status**: Accepted
**Epic**: [EP23 - SRS Engine v2: Learning Phase Refactor & Persistence Bridge](../../plans/epics/EP23-srs-engine-v2-learning-refactor-persistence-bridge.md)

---

## 1. Feature Overview

This DS covers two mechanical changes with no logic impact:

1. **Function renames** — `composeBatch` → `composeWordBatch`, `composeBatchMulti` → `composeWordBatchMulti`, `composeWordBatchItems` alias added. Names now communicate the word-item boundary per ADR `20260512T230000Z-engineering-compose-word-batch-boundary.md`.

2. **Type system update** — `QuizQuestion` renamed to `MCQQuestion` (with `kind: 'mcq'`); `QuizQuestion` becomes the union `MCQQuestion | SentenceQuestion`. `SentenceQuestion` stub added. Enables DS02 sentence composer to join the same type union without touching the word composer.

Composer registry, re-serve mechanics, and `assembleBatchQuestions` are out of scope — those belong to a separate EP.

---

## 2. Core Requirements

| Requirement | Decision | Rationale |
|---|---|---|
| `composeBatch` → `composeWordBatch` | Rename in `compose-batch.ts` + all call sites | ADR D5: naming by input shape (single `QuizItem`) prevents wrong extension points |
| `composeBatchMulti` → `composeWordBatchMulti` | Rename in `compose-batch.ts` + all call sites | Consistent naming pattern; ADR D5 |
| `composeWordBatchItems` alias | Export `composeWordBatchItems` as re-export of `composeWordBatchMulti` | Batch-execution-mechanics ADR names the registry-registered thunk `composeWordBatchItems`; the alias bridges the rename without a second implementation |
| `compose-word-batch.ts` | Delete | Duplicate of `compose-batch.ts`; was created during ADR authoring but never diverged from source |
| `compose-word-batch.test.ts` | Delete | Duplicate of `compose-batch.test.ts`; tests already covered by the original test file |
| `compose-batch.ts` | Keep, rename exports only | Source of truth; no logic changes |
| `index.ts` exports | Update to new names + add `composeWordBatchItems` | Public API must reflect renamed functions |

---

## 3. Data Structures

No new types. No type changes. Rename only.

Function signature mapping (signatures unchanged):

```typescript
// Before
export function composeBatch(item: QuizItem, pool: QuizItem[]): QuizQuestion[]
export function composeBatchMulti(words: QuizItem[], pool: QuizItem[], options: { questionLimit: number; shuffle?: boolean }): QuizQuestion[]

// After
export function composeWordBatch(item: QuizItem, pool: QuizItem[]): QuizQuestion[]
export function composeWordBatchMulti(words: QuizItem[], pool: QuizItem[], options: { questionLimit: number; shuffle?: boolean }): QuizQuestion[]
export const composeWordBatchItems = composeWordBatchMulti  // alias for registry wiring
```

---

## 4. File Map After DS01

```
packages/srs-engine-v2/src/
├── engine/
│   ├── compose-word-batch.ts    ← RENAMED from compose-batch.ts; exports: composeWordBatch, composeWordBatchMulti + alias composeWordBatchItems
│   └── compose-word-batch.ts    ← DELETED (duplicate — the pre-existing one)
├── __tests__/unit/
│   ├── compose-word-batch.test.ts  ← RENAMED from compose-batch.test.ts; updated imports + call sites
│   └── compose-word-batch.test.ts  ← DELETED (duplicate — the pre-existing one)
└── index.ts                        ← updated exports
```

---

## 5. Stories

### EP23-ST01: Rename `composeBatch` → `composeWordBatch` and `composeBatchMulti` → `composeWordBatchMulti`

**Scope**: Rename both exported functions in `compose-batch.ts`, add `composeWordBatchItems` alias, update the internal call from `composeBatchMulti` → `composeWordBatch`, update `index.ts`, update `compose-batch.test.ts`, delete duplicate files.

**Read List**:
- `packages/srs-engine-v2/src/engine/compose-batch.ts`
- `packages/srs-engine-v2/src/engine/compose-word-batch.ts`
- `packages/srs-engine-v2/src/index.ts`
- `packages/srs-engine-v2/src/__tests__/unit/compose-batch.test.ts`
- `packages/srs-engine-v2/src/__tests__/unit/compose-word-batch.test.ts`
- `product-documentation/architecture/20260512T230000Z-engineering-compose-word-batch-boundary.md`
- `product-documentation/architecture/20260513T000000Z-engineering-batch-execution-mechanics.md`

**Tasks**:

- [x] In `compose-batch.ts`: rename `composeBatch` → `composeWordBatch` (line 117) and `composeBatchMulti` → `composeWordBatchMulti` (line 56); update the internal call at line 64 (`composeBatch` → `composeWordBatch`); add `export const composeWordBatchItems = composeWordBatchMulti` after `composeWordBatchMulti`
- [ ] Rename `compose-batch.ts` → `compose-word-batch.ts`; update import path in `index.ts` accordingly
- [x] In `index.ts` line 5: replace `composeBatch, composeBatchMulti` → `composeWordBatch, composeWordBatchMulti, composeWordBatchItems`
- [x] In `compose-batch.test.ts` line 6: update import from `composeBatch, composeBatchMulti` → `composeWordBatch, composeWordBatchMulti`; replace all 23 `composeBatch(` call sites → `composeWordBatch(`; replace all 18 `composeBatchMulti(` call sites → `composeWordBatchMulti(`
- [ ] Rename `compose-batch.test.ts` → `compose-word-batch.test.ts`
- [x] Delete pre-existing duplicate `packages/srs-engine-v2/src/engine/compose-word-batch.ts`
- [x] Delete pre-existing duplicate `packages/srs-engine-v2/src/__tests__/unit/compose-word-batch.test.ts`

**Acceptance Criteria**:
- [x] `grep -r "composeBatch[^M]" packages/srs-engine-v2/src` returns zero results (no old single-function name remains)
- [x] `grep -r "composeBatchMulti" packages/srs-engine-v2/src` returns zero results (old multi name is gone)
- [x] `composeWordBatchItems` is exported from `index.ts` and equals `composeWordBatchMulti`
- [x] `src/engine/compose-word-batch.ts` exists (renamed from `compose-batch.ts`) and `src/engine/compose-batch.ts` no longer exists
- [x] `src/__tests__/unit/compose-word-batch.test.ts` exists (renamed from `compose-batch.test.ts`) and `compose-batch.test.ts` no longer exists
- [x] `pnpm --filter @gll/srs-engine-v2 test` passes with no changes to test logic
- [x] `pnpm --filter @gll/srs-engine-v2 typecheck` passes

---

### EP23-ST02: Rename `QuizQuestion` → `MCQQuestion` + introduce `QuizQuestion` union type

**ADR**: `product-documentation/architecture/20260512T235900Z-engineering-compose-sentence-batch-boundary.md` (B1)

**Scope**: Mechanical rename + union type introduction. No logic changes.

**Read List**:
- `packages/srs-engine-v2/src/types/quiz.ts`
- `packages/srs-engine-v2/src/index.ts`
- `packages/srs-engine-v2/src/engine/compose-batch.ts`
- `packages/srs-engine-v2/src/__tests__/unit/compose-batch.test.ts`
- `packages/srs-engine-v2/demo/learning-io.ts`

**Tasks**:

- [x] In `src/types/quiz.ts`: rename `QuizQuestion` → `MCQQuestion`; add `kind: 'mcq'` field; add `SentenceQuestion` interface with `kind: 'word-block'`, `sentenceId`, `direction`, `prompt`, `tiles: SentenceTile[]`, `answer: string[]`; add `type QuizQuestion = MCQQuestion | SentenceQuestion`
- [x] Update all `QuizQuestion` import/usage sites in `src/engine/`, `src/index.ts`, `demo/`, and tests to use `MCQQuestion` where the MCQ-only type is needed, or `QuizQuestion` where the union is appropriate

**Acceptance Criteria**:
- [x] `QuizQuestion` in `src/types/quiz.ts` is the union type `MCQQuestion | SentenceQuestion`
- [x] `MCQQuestion` has `kind: 'mcq'` field
- [x] `SentenceQuestion` has `kind: 'word-block'` field
- [x] `pnpm --filter @gll/srs-engine-v2 test` passes
- [x] `pnpm --filter @gll/srs-engine-v2 typecheck` passes

---

## 6. Success Criteria

1. `composeWordBatch`, `composeWordBatchMulti`, and `composeWordBatchItems` are importable from `@gll/srs-engine-v2`
2. `composeBatch` and `composeBatchMulti` no longer exist anywhere in `packages/srs-engine-v2/src/`
3. No duplicate files (`compose-word-batch.ts`, `compose-word-batch.test.ts`) remain
4. All existing tests pass — no logic changes
5. No type errors
