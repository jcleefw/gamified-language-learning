# EP32 — V1 Cleanup & API Contract V2

**Created**: 20260623T143620Z
**Status**: Impl-Complete

<!-- Status: Draft | Accepted | In Progress | Impl-Complete | BDD Pending | Completed | Shelved | Withdrawn -->

**Type**: Epic Plan
**Depends on**: EP30 (Impl-Complete)
**Parallel with**: N/A
**Predecessor**: N/A

---

## Problem Statement

The monorepo contains a dead v1 surface that blocks clean v2 work:

- `packages/srs-engine/` — original v1 engine, fully superseded by `srs-engine-v2`
- `apps/server/` routes and state — wired to v1 engine with in-memory state; no DB
- `scripts/quiz-runner.ts` — terminal demo built on v1 `SrsEngine`
- `packages/api-contract/src/srs.ts` — wire types model v1 concepts (`batchId`, `selectedKey`, `correctKey`, `MasteryPhase`) that have no equivalent in v2

`@gll/api-contract` is the right pattern — shared wire types between server and client — but the types must reflect v2 engine concepts. EP31 (srs-demo persistent storage) cannot start cleanly until the contract is rewritten and `apps/server` is stripped of v1 code.

---

## Scope

**In scope**:

- Delete `packages/srs-engine/` entirely
- Delete `scripts/quiz-runner.ts`
- Strip `apps/server/src/` of all v1 routes, state, and seeds; keep `app.ts` skeleton (CORS, logger, error handler, health) and `index.ts`
- Rewrite `packages/api-contract/src/srs.ts` with v2 state wire types (`WordStatePayload`, `GetStateResponse`, `UpsertWordStateRequest`)
- Update root `package.json`: remove `@gll/srs-engine` devDep, remove `quiz` and `dev:server` scripts
- Update `apps/server/package.json`: remove `@gll/api-contract` (old srs types), remove `@gll/srs-engine` dep; keep Hono deps
- Keep `packages/api-contract/src/errors.ts` unchanged — `ErrorCode` / `ApiError` / `ApiResponse<T>` are generic and correct
- Keep `packages/api-contract/src/auth.ts` and `curation.ts` stubs unchanged
- All remaining packages (`srs-engine-v2`, `db`, `srs-demo`, `cli-demo-db`) must typecheck and test-pass after deletions

**Out of scope**:

- Implementing the new state routes in `apps/server` — that is EP31
- Adding `@gll/db` to `apps/server` — EP31
- Any changes to `srs-engine-v2` internals

---

## Stories

### Phase 1: Delete V1 (EP32-PH01)

### EP32-ST01: Delete `packages/srs-engine/`

**Scope**: Remove the entire `packages/srs-engine/` directory and its workspace reference from the root `package.json` devDependencies.

### EP32-ST02: Delete `scripts/quiz-runner.ts` and root scripts

**Scope**: Delete `scripts/quiz-runner.ts`; remove `quiz` and `dev:server` entries from root `package.json` scripts.

### EP32-ST03: Strip `apps/server/` of v1 code

**Scope**: Delete `src/routes/srs.ts`, `src/routes/__tests__/`, `src/state/` (entire directory), `src/__tests__/`; update `apps/server/package.json` to remove `@gll/api-contract` and `@gll/srs-engine` deps; update `src/app.ts` to remove v1 route mount and `@gll/api-contract` error-handler import (use inline types or keep `ApiResponse` from contract — see ST04).

### Phase 2: Rewrite API Contract (EP32-PH02)

### EP32-ST04: Rewrite `packages/api-contract/src/srs.ts` for v2

**Scope**: Replace all v1 SRS wire types with v2 state types:
- `WordStatePayload` — maps `WordState` fields (`wordId`, `seen`, `correct`, `mastery`, `correctStreak`, `wrongStreak`, `lapses`) for HTTP transport
- `GetStateResponse` — response body for `GET /api/state` (`{ words: WordStatePayload[] }`)
- `UpsertWordStateRequest` — request body for `POST /api/state/word` (`WordStatePayload`)
- Remove: `QuestionType`, `QuestionDirection`, `GetBatchRequest`, `QuizQuestion`, `BatchPayload`, `QuizAnswer`, `SubmitAnswersRequest`, `SubmitAnswersResponse`, `MasteryPhase`, `AnswerResultPayload`, `WordMasterySummary`, `SeedPayload`
- Update `CODEMAP.md` to reflect new exports

### EP32-ST05: Re-add `@gll/api-contract` to `apps/server` and verify typecheck

**Scope**: Add `@gll/api-contract` back to `apps/server/package.json` (now needed for `ApiResponse<T>` in the error handler); confirm `pnpm typecheck` passes across the full monorepo.

---

## Overall Acceptance Criteria

- [ ] `packages/srs-engine/` directory does not exist
- [ ] `scripts/quiz-runner.ts` does not exist
- [ ] `apps/server/src/` contains only `app.ts` and `index.ts` (and their tests if kept, else empty `__tests__/`)
- [ ] `packages/api-contract/src/srs.ts` exports only v2 wire types; no v1 type names remain
- [ ] `pnpm build` passes across the full monorepo
- [ ] `pnpm typecheck` passes across the full monorepo
- [ ] `pnpm test` passes — no tests reference deleted packages
- [ ] `pnpm --filter @gll/srs-demo dev` starts without errors
- [ ] `pnpm --filter cli-demo-db engine:real-db` runs without errors (persists and restores state)
- [ ] `pnpm --filter @gll/srs-engine-v2 test` passes — v2 engine unit tests unaffected

---

## Dependencies

- EP30 complete — confirms v2 engine + DB layer are stable before we tear out v1

## Next Steps

1. Review and approve plan
2. Begin implementation story by story (ST01 → ST05 in order — each deletion is a prerequisite for the typecheck in ST05)
