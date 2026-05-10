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
| `demo/learning-runner.ts` | CLI demo — wires mock data → `runAdaptiveLoop` → `runInteractive` (interactive) or `runAutoInteractive` (auto mode) |
| `dist/index.js` | Built library output (generated from `src/`) |

---

## `src/` — Library

| Folder | Purpose | CODEMAP |
| --- | --- | --- |
| `src/engine/` | Quiz generation and session state — pure functions, no I/O | [CODEMAP](src/engine/CODEMAP.md) |
| `src/types/` | Shared TypeScript type definitions | [CODEMAP](src/types/CODEMAP.md) |

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
| `src/__tests__/unit/compose-batch.test.ts` | `composeBatch`, `composeBatchMulti` |
| `src/__tests__/unit/word-state.test.ts` | `updateRunState`, `isMastered` |
| `src/__tests__/unit/recheck.test.ts` | `processRecheckResult`, `nextActivePool` |
| `src/__tests__/unit/adaptive-loop.test.ts` | `nextActivePool` pool rotation |
| `src/__tests__/unit/update-mastery-state.test.ts` | `updateMasteryState` |
| `src/__tests__/unit/answer-strategy.test.ts` | Auto-answer strategies (demo layer) |
| `src/__tests__/unit/auto-answerer.test.ts` | `runAutoInteractive` (demo layer) |
| `src/__tests__/integration/auto-scenarios.test.ts` | Full loop — perfect, 80/20, random, determinism |
| `__tests__/integration/smoke.test.ts` | Verifies mock data loads with correct shape |

---

## Config Files

| File | Purpose |
| --- | --- |
| `package.json` | ESM package, declares `ts-fsrs` dep, build + test scripts |
| `tsconfig.json` | Base TS config (no emit, includes everything) |
| `tsconfig.build.json` | Build config — compiles `src/` → `dist/` |
| `vitest.config.ts` | Discovers tests across `src/`, `data/`, `__tests__/integration/` |

---

## Data Flow

### Library usage (web server example)
```
POST /batch
        ↓
composeBatchMulti(activeItems, pool, { questionLimit })
        ↓
   QuizQuestion[]  →  sent to client
        ↓
POST /answers
        ↓
updateMasteryState(results, runState, prevState, ...)
        ↓
   MasteryUpdateResult  →  persisted by server
```

### Terminal demo — interactive mode
```
demo/learning-runner.ts  (selectDeck)
        ↓
src/engine/compose-batch.ts  (composeBatchMulti, shuffle=true)
        ↓
   QuizQuestion[]
        ↓
src/engine/session.ts  (nextActivePool, updateMasteryState)
        ↓
demo/learning-io.ts  (runInteractive — console I/O)
```

### Terminal demo — auto mode (AUTO_MODE=true)
```
demo/learning-runner.ts  (selectStrategy)
        ↓
src/engine/compose-batch.ts  (composeBatchMulti, shuffle=false)
        ↓
   QuizQuestion[]
        ↓
demo/auto-answer-strategy.ts  (AutoAnswerStrategy.selectAnswer)
        ↓
demo/auto-answerer.ts  (runAutoInteractive)
        ↓
src/engine/session.ts  (nextActivePool, updateMasteryState)
```

---

## External Dependencies

| Dep | Version | Status |
| --- | --- | --- |
| `ts-fsrs` | ^5 | Declared — reserved for `src/scheduler/` (EP21-ST01) |
| `typescript` | ^5.7 | Dev |
| `vitest` | ^3 | Dev |
