# CODEMAP.md — `@gll/srs-engine-v2`

Package navigation index. Navigate to subfolder CODEMAPs for file-level detail.

---

## Package Purpose

Interactive SRS quiz engine for Thai language learning. Composes multiple-choice questions from language content and runs them via a CLI quiz session.

---

## Entry Points

| File | Role |
| --- | --- |
| `src/main.ts` | CLI demo — wires mock data → `composeBatchMulti` → `runInteractive` |
| `dist/index.js` | Built library export (generated from `src/`) |

---

## `src/` — Source

| Folder | Purpose | CODEMAP |
| --- | --- | --- |
| `src/engine/` | Quiz generation — pure functions, no I/O | [CODEMAP](src/engine/CODEMAP.md) |
| `src/runner/` | CLI quiz execution — I/O only, no quiz logic | [CODEMAP](src/runner/CODEMAP.md) |
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

```
data/mock/mock-consonants.ts
        ↓
    src/main.ts  (slice first N)
        ↓
src/engine/compose-batch.ts  (composeBatchMulti)
        ↓
   QuizQuestion[]
        ↓
src/runner/interactive.ts  (runInteractive)
        ↓
  Console I/O
```

---

## External Dependencies

| Dep | Version | Status |
| --- | --- | --- |
| `ts-fsrs` | ^5 | Declared — not yet used |
| `typescript` | ^5.7 | Dev |
| `vitest` | ^3 | Dev |
