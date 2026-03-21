# EP23-DS01: Structural Refactor & Learning Phase Scoping

**Date**: 20260321T192340Z
**Status**: Draft
**Epic**: [EP23 - SRS Engine v2: Learning Phase Refactor & Persistence Bridge](file:///Users/jc.lee/projects/experiments/gamified-language-learning/.agents/plans/epics/EP23-srs-engine-v2-learning-refactor-persistence-bridge.md)

---

## 1. Feature Overview

The current file structure and naming in `srs-engine-v2` is generically rooted in `src/main.ts` and `src/runner/interactive.ts`. This DS defines the move and renaming of these files into a `src/learning/` parent folder to explicitly scope them as the Learning phase and avoid name collisions with the upcoming Revision phase.

## 2. Core Requirements

| Requirement | Decision | Rationale |
| ----------- | -------- | --------- |
| Phase Scoping | `src/learning/` | Isolation of learning logic from shared engine logic and future revision logic. |
| Entry Point Naming | `learning-runner.ts` | The entry point (main wiring) is the runner. Includes session loops and mock data loading. |
| I/O Naming | `learning-io.ts` | Orchestrates the display, input selection, and adaptive loop I/O. |
| Constant Isolation | `config.ts` | Decouple configuration (`AUTO_MODE`, thresholds, counts) from initialization logic. |
| Strategy Rename | `AutoAnswerStrategy` | Clarifies that strategies are for automated testing environments only. |

## 3. Data Structures

No significant logic changes to data structures in this story. The type `AnswerStrategy` is renamed to `AutoAnswerStrategy`.

## 4. User Workflows

Developer:
`npm run dev` (or equivalent) → Loads `src/learning/learning-runner.ts` → Read from `src/learning/config.ts` → Start `learning-io.ts` session.

## 5. Stories

### EP23-ST01: Structural Refactor & Naming

**Scope**: Pure structural movement and renaming. No persistence wiring yet.
**Read List**:
- `packages/srs-engine-v2/src/main.ts`
- `packages/srs-engine-v2/src/runner/interactive.ts`
- `packages/srs-engine-v2/src/types/answer-strategy.ts`

**Tasks**:

- [ ] Create `src/learning/` directory.
- [ ] Move/Rename `src/main.ts` → `src/learning/learning-runner.ts`. Update relative imports.
- [ ] Move/Rename `src/runner/interactive.ts` → `src/learning/learning-io.ts`. Update relative imports.
- [ ] Create `src/learning/config.ts` and move `AUTO_MODE` and constants from `main.ts` into it.
- [ ] Move/Rename `src/types/answer-strategy.ts` → `src/learning/auto-answer-strategy.ts` and rename the interface and implementations to `AutoAnswerStrategy`.
- [ ] Add `pnpm learnv2` script to `package.json` pointing to the new runner location.

**Acceptance Criteria**:
- [ ] `pnpm learnv2` executes exactly like `pnpm quizv2` used to.
- [ ] All imports in the package are updated and the project builds/type-checks (no dangling imports).
- [ ] `src/runner/interactive.ts` and `src/main.ts` no longer exist.

## 6. Success Criteria

1. End-to-end execution of a learning session (Manual/Auto) works from the new architecture.
2. No type errors.
3. No configuration logic left hardcoded in the runner.
