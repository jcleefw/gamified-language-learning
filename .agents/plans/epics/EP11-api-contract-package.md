# EP11 - `@gll/api-contract` — Shared HTTP Types

**Created**: 20260311T000000Z
**Status**: Impl-Complete

<!-- Status: Draft | Accepted | In Progress | Impl-Complete | BDD Pending | Completed | Shelved | Withdrawn -->

**Type**: Epic Plan
**Depends on**: EP01
**Parallel with**: N/A
**Predecessor**: N/A

---

## Problem Statement

Stage 2 introduces an HTTP API layer. Both the Hono server (`apps/server`) and the future Nuxt frontend (`apps/web`) need to share the same wire-format types — request bodies, response payloads, and the error envelope. Without a shared package, types will drift silently between the two consumers. A compile-time contract enforced by TypeScript is the only reliable way to catch shape mismatches before runtime.

## Scope

**In scope**:

- `packages/api-contract/` — new types-only package with package name `@gll/api-contract`
- `tsconfig.json` and `package.json` scaffolding (no runtime dependencies)
- Error types: `ApiResponse<T>`, `ApiError`, `ErrorCode` (UPPER_SNAKE_CASE enum)
- SRS wire types: `GetBatchRequest`, `BatchPayload`, `QuizQuestion`, `SubmitAnswersRequest`, `QuizAnswer`, `AnswerResultPayload`, `WordMasterySummary`
- Re-export barrel `src/index.ts`
- Placeholder stub files for `auth.ts` and `curation.ts` (empty exports, no types yet)

**Out of scope**:

- Runtime code of any kind
- Engine-internal types (`WordState`, `Batch`, etc.) — these stay in `@gll/srs-engine`
- Auth or curation wire types — deferred to Stage 5 and Stage 7 respectively
- Turborepo pipeline wiring — handled in EP14

---

## Stories

### EP11-ST01: Package scaffold + error types

**Scope**: Create `packages/api-contract/` with `package.json` (`name: "@gll/api-contract"`, no dependencies), `tsconfig.json` extending `tsconfig.base.json`, `src/errors.ts` defining `ApiResponse<T>`, `ApiError`, and `ErrorCode` enum, stub files `src/auth.ts` and `src/curation.ts`, and `src/index.ts` re-exporting all. Verify `pnpm typecheck` passes for the new package.

### EP11-ST02: SRS wire types

**Scope**: Add `src/srs.ts` defining all Stage 2 SRS wire types: `GetBatchRequest`, `BatchPayload`, `QuizQuestion` (with `questionType: 'multiple_choice' | 'word_block' | 'audio'`), `SubmitAnswersRequest`, `QuizAnswer` (field `correct: boolean`), `AnswerResultPayload`, and `WordMasterySummary` (field `phase: 'learning' | 'anki_review'`). Export from `src/index.ts`. Verify typecheck still passes.

---

## Overall Acceptance Criteria

- [ ] `packages/api-contract/` exists with `package.json` declaring `name: "@gll/api-contract"` and zero runtime dependencies
- [ ] `ApiResponse<T>`, `ApiError`, and `ErrorCode` are exported from the package root
- [ ] All Stage 2 SRS wire types are exported from the package root
- [ ] `pnpm typecheck` passes for `packages/api-contract`
- [ ] No engine-internal types (`WordState`, `Batch`, etc.) are imported or re-exported

---

## Dependencies

- EP01 — monorepo scaffold (`tsconfig.base.json`, `pnpm-workspace.yaml`, Turborepo config)

## Next Steps

1. Review and approve plan
2. Implement ST01 (scaffold + error types) → ST02 (SRS wire types)
3. EP12 can begin once ST01 is done (server scaffold only needs the error types initially)
