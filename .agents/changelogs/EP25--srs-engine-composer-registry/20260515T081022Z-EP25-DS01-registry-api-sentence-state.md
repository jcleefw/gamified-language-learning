# EP25-DS01: Composer Registry API

**Date**: 20260515T081022Z
**Status**: Draft
**Epic**: [EP25 - SRS Engine v2: Composer Registry & Batch Execution](.agents/plans/epics/EP25-srs-engine-composer-registry.md)

---

## 1. Feature Overview

DS01 locks the registry design contract and wires it into `learning-io.ts`.

**Composer Registry API** — `ComposerRegistry` interface + `createComposerRegistry` factory + `assembleBatchQuestions` runner. These live in `srs-engine-v2/src/engine/` and are the D5 replacement for the three hardcoded composer calls in `runBatch()`.

---

## 2. Core Requirements

| Requirement | Decision | Rationale |
|---|---|---|
| Registry element type | `() => QuizQuestion[]` pre-bound thunk | ADR OQ1 resolved: session pre-applies all inputs; registry calls each thunk with no arguments |
| Registry mutation API | `add(thunk)` only — no remove, no clear | Registry is built fresh per `runBatch` call; no lifecycle management needed |
| `assembleBatchQuestions` return type | Flat `QuizQuestion[]` | ADR OQ3 resolved: merged array, order = registration order; session/UI type-narrows via `kind` |
| Registry internal storage | `thunks` array — internal only | Not part of `ComposerRegistry` interface; only visible to `assembleBatchQuestions` via factory-internal reference |

---

## 3. Data Structures

### `ComposerRegistry` + `assembleBatchQuestions`

```ts
// packages/srs-engine-v2/src/engine/compose-registry.ts

import type { QuizQuestion } from '../types/quiz.js';

export interface ComposerRegistry {
  add(thunk: () => QuizQuestion[]): void;
}

// RegistryWithThunks is NOT exported — callers use ComposerRegistry
interface RegistryWithThunks extends ComposerRegistry {
  readonly thunks: ReadonlyArray<() => QuizQuestion[]>;
}

export function createComposerRegistry(): RegistryWithThunks {
  const thunks: Array<() => QuizQuestion[]> = [];
  return {
    add(thunk) { thunks.push(thunk); },
    get thunks() { return thunks; },
  };
}

export function assembleBatchQuestions(registry: RegistryWithThunks): QuizQuestion[] {
  return registry.thunks.flatMap(t => t());
}
```

## 4. File Map After DS01

```
packages/srs-engine-v2/
├── src/
│   ├── engine/
│   │   └── compose-registry.ts          ← NEW (ST01): ComposerRegistry, createComposerRegistry, assembleBatchQuestions
│   ├── __tests__/unit/
│   │   └── compose-registry.test.ts     ← NEW (ST01)
│   └── index.ts                         ← updated (ST01): export ComposerRegistry + assembleBatchQuestions
└── demo/
    └── learning-io.ts                   ← updated (ST02): registry wiring
```

---

## 5. Stories

### Phase 1: Registry (EP25-PH01)

### EP25-ST01: Implement `compose-registry.ts` (TDD) + export

**Scope**: New engine file; unit tests; export from `index.ts`. No `learning-io.ts` changes yet.

**Read List**:
- `packages/srs-engine-v2/src/types/quiz.ts`
- `packages/srs-engine-v2/src/index.ts`

**Tasks**:
- [ ] Create `src/engine/compose-registry.ts` — `ComposerRegistry` interface + `createComposerRegistry` + `assembleBatchQuestions`
- [ ] Unit tests (`compose-registry.test.ts`):
  - [ ] Empty registry → `[]`
  - [ ] Single thunk → returns thunk output flat
  - [ ] Multiple thunks → flat merged array, registration order preserved
  - [ ] Each thunk called exactly once per `assembleBatchQuestions` call
- [ ] Export `ComposerRegistry`, `createComposerRegistry`, `assembleBatchQuestions` from `src/index.ts`

**Acceptance Criteria**:
- [ ] All 4 unit tests pass
- [ ] `pnpm --filter @gll/srs-engine-v2 typecheck` clean

---

### EP25-ST02: Wire `learning-io.ts` to registry

**Scope**: Replace hardcoded composer calls in `runBatch()` lines 203–216 with registry thunks. Import changes only — no logic changes to batch loop.

**Read List**:
- `packages/srs-engine-v2/demo/learning-io.ts` (lines 185–223)
- `packages/srs-engine-v2/src/engine/compose-word-batch.ts` (line 135 — `composeWordBatchItems` alias)

**Tasks**:
- [ ] Update imports: add `createComposerRegistry`, `assembleBatchQuestions`, `composeWordBatchItems`; remove `composeWordBatchMulti` from `runBatch` call sites (keep `composeSentenceBatch` — still called as thunk body)
- [ ] Replace the 3 direct calls in `runBatch()` with `registry.add(() => ...)` registrations
- [ ] Call `assembleBatchQuestions(registry)` to build `questions` array (final `.sort()` shuffle stays)
- [ ] No changes to `runAdaptiveLoop` or `runInteractive`

**Acceptance Criteria**:
- [ ] `runBatch()` contains no direct calls to `composeWordBatchMulti`
- [ ] Batch output is functionally identical — same questions, same shuffle behaviour
- [ ] `pnpm --filter @gll/srs-engine-v2 test` green (all existing tests pass)

---

## 6. Open Questions

| # | Question | Severity | Status |
|---|----------|----------|--------|
| OQ1 | `_thunks` internal access pattern — **Resolved** — Option A: `RegistryWithThunks` unexported internal type extending `ComposerRegistry` with `readonly thunks`. `assembleBatchQuestions` accepts `RegistryWithThunks`; `ComposerRegistry` remains the public interface. See ADR OQ10 for full comparison. | Low | Resolved |

---

## 7. Success Criteria

1. `ComposerRegistry`, `createComposerRegistry`, `assembleBatchQuestions` importable from `@gll/srs-engine-v2`
2. `runBatch()` contains no direct calls to `composeWordBatchMulti` after ST02
3. `pnpm --filter @gll/srs-engine-v2 test` green; `pnpm typecheck` clean across monorepo
