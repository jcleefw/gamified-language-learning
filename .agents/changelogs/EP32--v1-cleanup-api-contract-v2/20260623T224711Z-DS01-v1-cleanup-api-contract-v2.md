# EP32-DS01: V1 Cleanup & API Contract V2 Specification

**Date**: 20260623T224711Z
**Status**: Impl-Complete
**Epic**: [EP32 — V1 Cleanup & API Contract V2](../../plans/epics/EP32-v1-cleanup-api-contract-v2.md)

---

## 1. Feature Overview

Remove all v1 engine surface from the monorepo — the superseded `@gll/srs-engine` package, its terminal demo script, its v1 SRS routes, and all v1 in-memory state — then rewrite `@gll/api-contract` with v2 wire types matching the new engine's word-state model. `apps/server` is reduced to a clean Hono skeleton (CORS, logger, error handler, health only), ready for EP31's new state routes to be mounted with no v1 residue in the way.

---

## 2. Core Requirements

| Requirement | Decision | Rationale |
|---|---|---|
| v1 engine package | Delete `packages/srs-engine/` entirely | Fully superseded by `srs-engine-v2` |
| v1 terminal demo | Delete `scripts/quiz-runner.ts` | Used `@gll/srs-engine` directly; no longer valid |
| v1 SRS routes | Delete `apps/server/src/routes/srs.ts` and its tests | Wired to in-memory v1 state, incompatible with v2 model |
| v1 server state | Delete `apps/server/src/state/` (word state, batch registry, engine wiring, seed data) | All v1-specific; no v2 equivalent needed at this layer |
| Wire types | Replace v1 quiz-batch types with v2 word-state types in `@gll/api-contract` | v2 engine's `WordState` is the new shared contract shape |
| `ErrorCode` | Remove `INSUFFICIENT_WORD_POOL` | v1-specific error code, no longer applicable |
| `apps/server` shape | Strip to bare Hono skeleton | Clean slate for EP31 state routes |
| Dependencies | Remove `@gll/srs-engine` from `apps/server/package.json` and root `package.json`; re-add `@gll/api-contract` for `ApiResponse<T>` | Drop dead dependency; keep the generic envelope type |
| Root scripts | Remove `quiz` and `dev:server` scripts | Pointed at deleted v1 surface |
| Incidental fix | Add missing `lapses: 0` to `defaultWordState` in `apps/srs-demo/src/App.vue` | Pre-existing gap from EP30's `WordState` update, caught during this cleanup pass |

---

## 3. Data Structures

```typescript
// packages/api-contract/src/srs.ts — v2 replaces all v1 types

// Removed (v1): QuestionType, QuestionDirection, GetBatchRequest, QuizQuestion,
// BatchPayload, QuizAnswer, SubmitAnswersRequest, SubmitAnswersResponse,
// MasteryPhase, AnswerResultPayload, WordMasterySummary, SeedPayload

// New (v2) — maps 1:1 with WordState from @gll/srs-engine-v2
interface WordStatePayload {
  wordId: string;
  seen: number;
  correct: number;
  mastery: number;
  correctStreak: number;
  wrongStreak: number;
  lapses: number;
}

interface GetStateResponse {
  words: WordStatePayload[];
}

type UpsertWordStateRequest = WordStatePayload;

// Unchanged: ErrorCode, ApiError, ApiResponse<T> — generic envelope, kept as-is
```

---

## 4. User Workflows

```
CLEANUP PASS
  └─ Delete packages/srs-engine/, scripts/quiz-runner.ts
  └─ Delete apps/server/src/routes/srs.ts (+ tests)
  └─ Delete apps/server/src/state/ (+ apps/server/src/__tests__/)
  └─ Strip apps/server/src/app.ts to bare skeleton (CORS, logger, error handler, health)
  └─ Remove @gll/srs-engine from package.json (root + apps/server)

CONTRACT REWRITE
  └─ Replace v1 types in packages/api-contract/src/srs.ts with v2 WordStatePayload et al.
  └─ Remove INSUFFICIENT_WORD_POOL from ErrorCode
  └─ Update packages/api-contract/CODEMAP.md exports table
  └─ Re-add @gll/api-contract to apps/server/package.json (for ApiResponse<T>)

VERIFY
  └─ pnpm build → 6 packages, all pass
  └─ pnpm test → 6 packages, all pass
```

---

## 5. Stories

### EP32-ST01: Delete v1 engine surface

**Scope**: Remove the entire v1 engine package and everything wired directly to it — package, terminal demo, v1 routes, v1 in-memory state, and their tests.

**Read List**:
- `packages/srs-engine/` (package to delete)
- `apps/server/src/routes/srs.ts`, `apps/server/src/routes/__tests__/srs.test.ts`
- `apps/server/src/state/`
- `apps/server/src/__tests__/`
- `scripts/quiz-runner.ts`
- Root `package.json`

**Tasks**:
- [x] Delete `packages/srs-engine/`
- [x] Delete `scripts/quiz-runner.ts`
- [x] Delete `apps/server/src/routes/srs.ts` and `apps/server/src/routes/__tests__/srs.test.ts`
- [x] Delete `apps/server/src/state/` (in-memory word state, batch registry, engine wiring, seed data)
- [x] Delete `apps/server/src/__tests__/` (v1 server tests)
- [x] Remove `@gll/srs-engine` devDependency and `quiz`/`dev:server` scripts from root `package.json`

**Acceptance Criteria**:
- [x] No references to `@gll/srs-engine` remain anywhere in the monorepo
- [x] `packages/srs-engine/`, `scripts/quiz-runner.ts` do not exist
- [x] `apps/server` has no v1 routes, v1 state, or v1 tests remaining

---

### EP32-ST02: Rewrite API contract to v2 and reduce server to skeleton

**Scope**: Replace v1 wire types with v2 word-state types in `@gll/api-contract`; strip `apps/server` to a clean Hono skeleton ready for EP31's new routes.

**Read List**:
- `packages/api-contract/src/srs.ts`
- `packages/api-contract/src/errors.ts`
- `packages/api-contract/CODEMAP.md`
- `apps/server/src/app.ts`
- `apps/server/package.json`
- `apps/srs-demo/src/App.vue`

**Tasks**:
- [x] Replace all v1 types in `packages/api-contract/src/srs.ts` with v2 types: `WordStatePayload`, `GetStateResponse`, `UpsertWordStateRequest`
- [x] Remove `INSUFFICIENT_WORD_POOL` from `ErrorCode` in `packages/api-contract/src/errors.ts`
- [x] Update `packages/api-contract/CODEMAP.md` exports table to reflect v2 types
- [x] Strip `apps/server/src/app.ts` to a bare Hono skeleton (CORS, logger, error handler, health route only)
- [x] Remove `@gll/srs-engine` and old `@gll/api-contract` from `apps/server/package.json`; re-add `@gll/api-contract` for `ApiResponse<T>`
- [x] Add missing `lapses: 0` to `defaultWordState` in `apps/srs-demo/src/App.vue` (gap from EP30)

**Acceptance Criteria**:
- [x] `packages/api-contract/src/srs.ts` exports only v2 types; no v1 quiz-batch types remain
- [x] `apps/server/src/app.ts` mounts no routes beyond health/error/CORS/logger
- [x] `apps/srs-demo`'s `defaultWordState` includes `lapses: 0`
- [x] `pnpm build` — 6 packages, all pass
- [x] `pnpm test` — 6 packages, all pass (srs-engine-v2: 93 tests, db: 4 tests, cli-demo-db: 32 tests)

---

## 6. Success Criteria

1. [x] All v1 engine surface (package, demo script, routes, in-memory state) removed with no dangling references
2. [x] `@gll/api-contract` exposes only v2 word-state wire types; `ErrorCode` has no v1-specific codes
3. [x] `apps/server` is a clean, minimal Hono skeleton ready for EP31's state routes
4. [x] `pnpm build` and `pnpm test` pass across all 6 packages with no new type errors
