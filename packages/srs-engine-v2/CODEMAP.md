# CODEMAP.md — `@gll/srs-engine-v2`

Package navigation index. Navigate to subfolder CODEMAPs for file-level detail.

---

## Package Purpose

Standalone SRS quiz engine for language learning. Exposes pure functions for
composing quiz questions and managing session state. Can be consumed by any
interface layer — terminal (via `demo/`) or web (future server + frontend).

---

## Entry Points

| File | Role |
| --- | --- |
| `src/index.ts` | Public library API — single import surface for all consumers |
| `docs/` | **Start here** — humanized explanations at three levels (stakeholder, developer, walkthrough) |
| `demo/learning-runner.ts` | CLI demo — wires mock data → `initAdaptiveSession` → question loop → `advanceAdaptiveSession` |
| `dist/index.js` | Built library output (generated from `src/`) |

---

## `docs/` — Start Here

Three humanized explanations at different levels:

| File | Audience | Time | Content |
| --- | --- | --- | --- |
| `docs/01-stakeholder.md` | Product owners, non-technical | 5 min | What the engine does and why |
| `docs/02-concepts.md` | Developers, architects | 10 min | Architecture, core concepts, design decisions |
| `docs/03-walkthrough.md` | Builders, debuggers | 15 min | Step-by-step algorithm trace with worked example |

---

## `src/` — Library

| Folder | Purpose |
| --- | --- |
| `src/engine/` | Session orchestration, batch composition, answer processing — pure functions, no I/O |
| `src/types/` | TypeScript definitions — `WordState`, `RunState`, `SentenceState`, `QuizQuestion`, etc. |
| `src/config/` | Language config — `wordJoin` for space-less scripts (Thai, Japanese, etc.) |

---

## `demo/` — Terminal Demo

Shows how to build a terminal interface on top of the library. All files
import from `../src/index.js` — same as a web server would.

| File | Purpose |
| --- | --- |
| `demo/learning-runner.ts` | Entry point — deck selection loop, wires mock data into `runAdaptiveLoop` |
| `demo/learning-io.ts` | Terminal I/O + orchestration — `selectDeck`, `runInteractive`, `runAdaptiveLoop` |
| `demo/auto-answerer.ts` | Auto mode runner — `runAutoInteractive` with a strategy |
| `demo/auto-answer-strategy.ts` | Answer strategies — `CorrectAutoAnswerStrategy`, `RandomAutoAnswerStrategy`, `WeightedAccuracyAutoAnswerStrategy` |
| `demo/config.ts` | Demo config — `LEARNING_CONFIG`, `STREAK_THRESHOLDS`, `AUTO_MODE` flag |

---

## `data/` — Mock Data

| Folder | Purpose | CODEMAP |
| --- | --- | --- |
| `data/mock/` | Thai and Japanese foundational + vocabulary test data | [CODEMAP](data/mock/CODEMAP.md) |

---

## `src/__tests__/` — Tests

| File | Purpose |
| --- | --- |
| `unit/word-state.test.ts` | `updateRunState`, streak & mastery logic, `isMastered` |
| `unit/recheck.test.ts` | `processRecheckResult`, `recheckPending`/`recheckReentered`, `nextActivePool` |
| `unit/compose-batch.test.ts` | `composeWordBatch`, `composeWordBatchMulti` (word MCQ generation) |
| `unit/update-mastery-state.test.ts` | Full batch result processing, streak tracking |
| `integration/auto-scenarios.test.ts` | End-to-end scenarios — perfect answers, 80/20, random, determinism |

---

## Config Files

| File | Purpose |
| --- | --- |
| `package.json` | ESM package, declares `ts-fsrs` dep, build + test scripts |
| `tsconfig.json` | Base TS config (no emit, includes everything) |
| `tsconfig.build.json` | Build config — compiles `src/` → `dist/` |
| `vitest.config.ts` | Discovers tests across `src/`, `data/`, `__tests__/integration/` |

---

## Session Lifecycle

```
initAdaptiveSession(words, config)
        ↓
   AdaptiveSessionState {active, queue, runState, ...}
        ↓
per batch:
  assembleBatch(active, pool, config) → QuizQuestion[]
  initBatchState(questions) → BatchState
  
  per question:
    nextQuestion(batchState) → question + state
    submitBatchResult(batchState, answer) → state (re-enqueue if wrong)
  
  finishBatch(batchState) → BatchOutput
        ↓
advanceAdaptiveSession(sessionState, batchOutput, config)
  → updateMasteryState (streak/mastery rules)
  → updateSentenceRunState (sentence streak & shelving)
  → nextActivePool (retire mastered, fill from queue)
  → next AdaptiveSessionState
        ↓
repeat until active.length === 0 && queue.length === 0
```

See `docs/02-concepts.md` for architecture diagram and `docs/03-walkthrough.md` for annotated example.

---

## External Dependencies

| Dep | Version | Status |
| --- | --- | --- |
| `ts-fsrs` | ^5 | Declared — reserved for `src/scheduler/` (EP21-ST01) |
| `typescript` | ^5.7 | Dev |
| `vitest` | ^3 | Dev |
