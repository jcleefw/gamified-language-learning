# CODEMAP.md — `@gll/srs-engine-v2`

Package navigation index. Navigate to subfolder CODEMAPs for file-level detail.

---

## Package Purpose

Interactive SRS quiz engine for Thai language learning. Composes multiple-choice questions from language content and runs them via a CLI quiz session. Supports both interactive mode (user input) and auto mode (automated test scenarios via answer strategies).

---

## Entry Points

| File | Role |
| --- | --- |
| `src/learning/learning-runner.ts` | CLI learning demo — wires mock data → `runAdaptiveLoop` → `runInteractive` (interactive) or `runAutoInteractive` (auto mode) |
| `dist/index.js` | Built library export (generated from `src/`) |

---

## `src/` — Source

| Folder | Purpose | CODEMAP |
| --- | --- | --- |
| `src/learning/` | Learning phase CLI session, adaptive loop, and automated runners | [CODEMAP](src/learning/CODEMAP.md) |
| `src/engine/` | Quiz generation — pure functions, no I/O | [CODEMAP](src/engine/CODEMAP.md) |
| `src/types/` | Shared TypeScript type definitions | [CODEMAP](src/types/CODEMAP.md) |

---

## `data/` — Mock Data

| Folder | Purpose | CODEMAP |
| --- | --- | --- |
| `data/mock/` | Thai consonant and vocabulary test data | [CODEMAP](data/mock/CODEMAP.md) |

---

## `__tests__/` — Integration Tests

| File | Purpose |
| --- | --- |
| `__tests__/integration/smoke.test.ts` | Verifies mock data loads with correct shape |
| `__tests__/integration/auto-scenarios.test.ts` | Validates auto mode scenarios (perfect, 80/20, edge cases) |
| `__tests__/setup.ts` | Global test setup placeholder |

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

### Interactive Mode (default)
```
data/mock/mock-consonants.ts
        ↓
src/learning/learning-runner.ts  (selectDeck)
        ↓
src/engine/compose-batch.ts  (composeBatchMulti, shuffle=true)
        ↓
   QuizQuestion[]
        ↓
src/learning/learning-io.ts  (runInteractive)
        ↓
  Console I/O + User Input
```

### Auto Mode (AUTO_MODE=true)
```
data/mock/mock-consonants.ts
        ↓
src/learning/learning-runner.ts  (AUTO_MODE=true, selectStrategy)
        ↓
src/engine/compose-batch.ts  (composeBatchMulti, shuffle=false)
        ↓
   QuizQuestion[]
        ↓
src/learning/auto-answer-strategy.ts  (AutoAnswerStrategy.selectAnswer)
        ↓
src/learning/auto-answerer.ts  (runAutoInteractive)
        ↓
  Deterministic Results
```


---

## External Dependencies

| Dep | Version | Status |
| --- | --- | --- |
| `ts-fsrs` | ^5 | Declared — not yet used |
| `typescript` | ^5.7 | Dev |
| `vitest` | ^3 | Dev |
