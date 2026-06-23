# EP32: V1 Cleanup & API Contract V2

**Date**: 2026-06-23
**Status**: Impl-Complete
**Epic**: [EP32 — V1 Cleanup & API Contract V2](../../plans/epics/EP32-v1-cleanup-api-contract-v2.md)

---

## Summary

Removed all v1 engine surface from the monorepo and rewrote `@gll/api-contract` with v2 wire types. `apps/server` is now a clean Hono skeleton ready for EP31 state routes.

---

## Changes

### Deleted

| Path | Reason |
|---|---|
| `packages/srs-engine/` | V1 engine — fully superseded by `srs-engine-v2` |
| `scripts/quiz-runner.ts` | V1 terminal demo — used `@gll/srs-engine` directly |
| `apps/server/src/routes/srs.ts` | V1 SRS routes — wired to in-memory v1 state |
| `apps/server/src/routes/__tests__/srs.test.ts` | Tests for deleted v1 routes |
| `apps/server/src/state/` | In-memory word state, batch registry, engine wiring, seed data — all v1 |
| `apps/server/src/__tests__/` | V1 server tests |

### Modified

| File | Change |
|---|---|
| `packages/api-contract/src/srs.ts` | Replaced all v1 types with v2 state wire types: `WordStatePayload`, `GetStateResponse`, `UpsertWordStateRequest` |
| `packages/api-contract/src/errors.ts` | Removed `INSUFFICIENT_WORD_POOL` from `ErrorCode` (v1-specific) |
| `packages/api-contract/CODEMAP.md` | Updated exports table to reflect v2 types |
| `apps/server/src/app.ts` | Stripped v1 route mount; now bare Hono skeleton with CORS, logger, error handler, health only |
| `apps/server/package.json` | Removed `@gll/srs-engine` and old `@gll/api-contract`; kept Hono deps; re-added `@gll/api-contract` for `ApiResponse<T>` |
| `apps/srs-demo/src/App.vue` | Added missing `lapses: 0` to `defaultWordState` (pre-existing gap from EP30 `WordState` update) |
| Root `package.json` | Removed `@gll/srs-engine` devDep; removed `quiz` and `dev:server` scripts |

---

## API Contract: V1 → V2

**Removed types** (all v1): `QuestionType`, `QuestionDirection`, `GetBatchRequest`, `QuizQuestion`, `BatchPayload`, `QuizAnswer`, `SubmitAnswersRequest`, `SubmitAnswersResponse`, `MasteryPhase`, `AnswerResultPayload`, `WordMasterySummary`, `SeedPayload`

**New types** (v2):

```ts
// Maps 1:1 with WordState from @gll/srs-engine-v2
interface WordStatePayload {
  wordId: string; seen: number; correct: number; mastery: number;
  correctStreak: number; wrongStreak: number; lapses: number;
}

interface GetStateResponse { words: WordStatePayload[]; }

type UpsertWordStateRequest = WordStatePayload;
```

**Unchanged**: `ErrorCode`, `ApiError`, `ApiResponse<T>` — generic envelope, kept as-is.

---

## Verification

- `pnpm build` — 6 packages, all pass
- `pnpm test` — 6 packages, all pass (srs-engine-v2: 93 tests, db: 4 tests, cli-demo-db: 32 tests)
