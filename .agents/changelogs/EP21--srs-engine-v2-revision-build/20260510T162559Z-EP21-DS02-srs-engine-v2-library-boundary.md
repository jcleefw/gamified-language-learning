# EP21-DS02: SRS Engine v2 Library Boundary Refactor

**Date**: 20260510T161557Z
**Status**: Draft
**Epic**: [EP21 - SRS Engine v2: Revision Phase](EP21-srs-engine-v2-revision-phase.md)

---

## 1. Feature Overview

`srs-engine-v2` was built as a CLI quiz app with library components embedded inside. This design spec refactors it into a proper standalone library: pure engine functions exposed through a clean `src/index.ts`, with all terminal I/O and demo orchestration moved to a `demo/` folder.

No new functionality is added. The goal is that after this refactor, both a terminal interface (`demo/`) and a web interface (future server + frontend) can use the engine as a library dependency, importing from `@gll/srs-engine-v2` without knowledge of internal paths.

---

## 2. Core Requirements

| Requirement | Decision | Rationale |
|---|---|---|
| Public API surface | Single `src/index.ts` barrel export | Consumers must not import internal paths |
| Library functions currently in `learning-io.ts` | Move `processRecheckResult`, `nextActivePool`, pure `updateMasteryState` → `src/engine/session.ts` | These are engine logic, not I/O |
| Demo files | Move to `demo/` folder | Separates "how to use the library" from the library itself |
| Demo imports from public API | `demo/` imports via `../src/index.js` | Validates the public surface is complete |
| `better-sqlite3` dependency | Remove from `package.json` | Persistence belongs in the server, not the engine |
| `ts-fsrs` dependency | Retain (declared for EP21-ST01 use in `src/scheduler/`) | Scheduler layer belongs in this package behind `ReviewScheduler` interface |
| Existing tests | Update import paths only — no logic changes | Tests already cover the right functions |

---

## 3. Data Structures

No new types introduced. The following types move from `learning-io.ts` to `src/engine/session.ts` as part of the extraction:

```typescript
// Moves to src/engine/session.ts
export interface RecheckResultOutput {
  runState: RunState;
  recheckPending: Set<string>;
  recheckReentered: Set<string>;
}

export interface MasteryUpdateResult {
  runState: RunState;
  recheckPending: Set<string>;
  recheckReentered: Set<string>;
  masteredCount: number;
}
```

`QuizResult` (wordId + correct boolean) also moves to `src/types/quiz.ts` since it is a domain type consumed by both the engine and the demo.

---

## 4. Structure After Refactor

```
packages/srs-engine-v2/
├── src/
│   ├── index.ts                      ← NEW: public API barrel
│   ├── engine/
│   │   ├── compose-batch.ts          (unchanged)
│   │   └── session.ts                ← NEW: processRecheckResult, nextActivePool, updateMasteryState
│   └── types/
│       ├── word-state.ts             (unchanged)
│       ├── quiz.ts                   + QuizResult added
│       ├── deck.ts                   (unchanged)
│       └── foundational.ts           (unchanged)
├── demo/
│   ├── learning-runner.ts            (moved from src/learning/)
│   ├── learning-io.ts                (moved, trimmed to I/O + orchestration only)
│   ├── auto-answerer.ts              (moved from src/learning/)
│   └── config.ts                     (moved from src/learning/)
└── data/                             (unchanged)
```

`src/learning/` is deleted entirely once contents are moved.

---

## 5. Public API (`src/index.ts`)

```typescript
// Engine — question generation
export { composeBatch, composeBatchMulti } from './engine/compose-batch.js';
export type { QuizItem } from './engine/compose-batch.js';

// Engine — session state
export { processRecheckResult, nextActivePool, updateMasteryState } from './engine/session.js';
export type { RecheckResultOutput, MasteryUpdateResult } from './engine/session.js';

// State
export { updateRunState, isMastered } from './types/word-state.js';
export type { WordState, RunState, StreakThresholds } from './types/word-state.js';

// Types
export type { QuizQuestion, QuizChoice, QuizDirection, QuizResult } from './types/quiz.js';
export type { MockDeck, MockLine } from './types/deck.js';
export type { MockFoundational, ThaiFoundational } from './types/foundational.js';
```

---

## 6. Stories

### EP21-ST02: Extract Engine Session Functions

**Scope**: Move `processRecheckResult`, `nextActivePool`, and pure `updateMasteryState` out of `learning-io.ts` into `src/engine/session.ts`. Move `QuizResult` to `src/types/quiz.ts`. Update all internal imports.

**Read List**:
- `packages/srs-engine-v2/src/learning/learning-io.ts`
- `packages/srs-engine-v2/src/types/quiz.ts`
- `packages/srs-engine-v2/src/types/word-state.ts`
- `packages/srs-engine-v2/src/__tests__/unit/recheck.test.ts`
- `packages/srs-engine-v2/src/__tests__/unit/adaptive-loop.test.ts`

**Tasks**:

- [ ] Create `src/engine/session.ts` with `processRecheckResult`, `nextActivePool`, `updateMasteryState` (pure — no console.log)
- [ ] Add `QuizResult` to `src/types/quiz.ts`
- [ ] Update `src/learning/learning-io.ts` imports to pull from new locations
- [ ] Update test files (`recheck.test.ts`, `adaptive-loop.test.ts`) import paths

**Acceptance Criteria**:
- [ ] `src/engine/session.ts` contains no `console.log`, no `process.*`
- [ ] `updateMasteryState` returns `MasteryUpdateResult` — no side effects
- [ ] All existing tests pass unchanged (`pnpm --filter @gll/srs-engine-v2 test`)

---

### EP21-ST03: Create `src/index.ts` and Move Demo Files

**Scope**: Create the public barrel export. Move all files in `src/learning/` to `demo/`. Update demo imports to use the public API. Remove `better-sqlite3` from `package.json`.

**Read List**:
- `packages/srs-engine-v2/src/learning/learning-runner.ts`
- `packages/srs-engine-v2/src/learning/learning-io.ts`
- `packages/srs-engine-v2/src/learning/auto-answerer.ts`
- `packages/srs-engine-v2/src/learning/config.ts`
- `packages/srs-engine-v2/package.json`
- `packages/srs-engine-v2/tsconfig.build.json`

**Tasks**:

- [ ] Create `src/index.ts` with exports as specified in section 5
- [ ] Move `src/learning/{learning-runner,learning-io,auto-answerer,config}.ts` → `demo/`
- [ ] Update `demo/` imports to use `../src/index.js` (or `@gll/srs-engine-v2` if self-referencing is configured)
- [ ] Delete `src/learning/` directory
- [ ] Remove `better-sqlite3` and `@types/better-sqlite3` from `package.json` dependencies
- [ ] Update `tsconfig.build.json` to include `demo/` if the demo needs to compile, or exclude it if it runs via `tsx` directly
- [ ] Verify `pnpm learnv2` still works

**Acceptance Criteria**:
- [ ] `import { composeBatch, processRecheckResult } from '../src/index.js'` works from `demo/`
- [ ] `src/learning/` directory no longer exists
- [ ] `pnpm learnv2` runs without error
- [ ] `pnpm --filter @gll/srs-engine-v2 test` passes
- [ ] No `better-sqlite3` in `package.json`

---

## 7. Success Criteria

1. A consumer can import everything they need from `@gll/srs-engine-v2` — no internal path knowledge required
2. `demo/learning-io.ts` contains zero pure engine logic — only I/O and orchestration that calls the public API
3. `pnpm learnv2` (terminal demo) works identically to before
4. All existing tests pass with only import path updates — no logic changes
5. No type errors (`pnpm --filter @gll/srs-engine-v2 typecheck`)
