# EP23-DS01: `composeWordBatch` Rename & `composeWordBatchItems` Alias

**Date**: 20260513T233802Z
**Status**: Draft
**Epic**: [EP23 - SRS Engine v2: Learning Phase Refactor & Persistence Bridge](../../plans/epics/EP23-srs-engine-v2-learning-refactor-persistence-bridge.md)

---

## 1. Feature Overview

`compose-batch.ts` exports `composeBatch` (single-item) and `composeBatchMulti` (multi-item wrapper). The ADR `20260512T230000Z-engineering-compose-word-batch-boundary.md` defines the boundary for word-item composers: any question type that derives from a single `QuizItem` belongs here. The current names don't communicate that boundary and will mislead developers adding sentence-level composers.

This DS renames both functions, adds a `composeWordBatchItems` alias for the multi-word wrapper (the name used in the registry design from `20260513T000000Z-engineering-batch-execution-mechanics.md`), and deletes the duplicate `compose-word-batch.ts` file and its duplicate test.

No logic changes. All consumers — `index.ts`, test files, and the demo — are updated to the new names.

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
│   ├── compose-batch.ts         ← renamed exports: composeWordBatch, composeWordBatchMulti + alias composeWordBatchItems
│   └── compose-word-batch.ts    ← DELETED (duplicate)
├── __tests__/unit/
│   ├── compose-batch.test.ts    ← updated imports + call sites
│   └── compose-word-batch.test.ts  ← DELETED (duplicate)
└── index.ts                     ← updated exports
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

- [ ] In `compose-batch.ts`: rename `composeBatch` → `composeWordBatch` (line 117) and `composeBatchMulti` → `composeWordBatchMulti` (line 56); update the internal call at line 64 (`composeBatch` → `composeWordBatch`); add `export const composeWordBatchItems = composeWordBatchMulti` after `composeWordBatchMulti`
- [ ] In `index.ts` line 5: replace `composeBatch, composeBatchMulti` → `composeWordBatch, composeWordBatchMulti, composeWordBatchItems`
- [ ] In `compose-batch.test.ts` line 6: update import from `composeBatch, composeBatchMulti` → `composeWordBatch, composeWordBatchMulti`; replace all 23 `composeBatch(` call sites → `composeWordBatch(`; replace all 18 `composeBatchMulti(` call sites → `composeWordBatchMulti(`
- [ ] Delete `packages/srs-engine-v2/src/engine/compose-word-batch.ts`
- [ ] Delete `packages/srs-engine-v2/src/__tests__/unit/compose-word-batch.test.ts`

**Acceptance Criteria**:
- [ ] `grep -r "composeBatch[^M]" packages/srs-engine-v2/src` returns zero results (no old single-function name remains)
- [ ] `grep -r "composeBatchMulti" packages/srs-engine-v2/src` returns zero results (old multi name is gone)
- [ ] `composeWordBatchItems` is exported from `index.ts` and equals `composeWordBatchMulti`
- [ ] `compose-word-batch.ts` and `compose-word-batch.test.ts` no longer exist
- [ ] `pnpm --filter @gll/srs-engine-v2 test` passes with no changes to test logic
- [ ] `pnpm --filter @gll/srs-engine-v2 typecheck` passes

---

## 6. Success Criteria

1. `composeWordBatch`, `composeWordBatchMulti`, and `composeWordBatchItems` are importable from `@gll/srs-engine-v2`
2. `composeBatch` and `composeBatchMulti` no longer exist anywhere in `packages/srs-engine-v2/src/`
3. No duplicate files (`compose-word-batch.ts`, `compose-word-batch.test.ts`) remain
4. All existing tests pass — no logic changes
5. No type errors
