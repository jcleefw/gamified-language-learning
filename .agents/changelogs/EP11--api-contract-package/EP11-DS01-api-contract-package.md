# EP11-DS01: `@gll/api-contract` — Shared HTTP Types Specification

**Date**: 20260312T000000Z
**Status**: Draft
**Epic**: [EP11 - `@gll/api-contract` — Shared HTTP Types](../../plans/epics/EP11-api-contract-package.md)

---

## 1. Feature Overview

Create a types-only package `packages/api-contract/` exporting the shared wire-format types consumed by both the Hono server (`apps/server`) and the future Nuxt frontend (`apps/web`). The package has zero runtime dependencies — only TypeScript type declarations. It extends `tsconfig.base.json` and is referenced by downstream packages via workspace protocol.

The package exports two categories of types:

1. **Error envelope** — `ApiResponse<T>`, `ApiError`, `ErrorCode` — universal HTTP response wrapper
2. **SRS wire types** — request/response shapes for the SRS HTTP routes introduced in Stage 2

Engine-internal types (`WordState`, `Batch`, `Question`, etc.) remain in `@gll/srs-engine` and are never re-exported here. Mapping between engine types and wire types is the responsibility of the server layer (EP13).

---

## 2. Core Requirements

| Requirement | Decision | Rationale |
| --- | --- | --- |
| Package location | `packages/api-contract/` | Consistent with `packages/srs-engine/` sibling pattern |
| Package name | `@gll/api-contract` | Namespaced to GLL monorepo; matches EP11 scope |
| Runtime dependencies | None | Types-only package — `import type` consumers; `tsc` is the only build step |
| `tsconfig.json` | Extends `../../tsconfig.base.json`; `outDir: dist`; includes `src/**/*` only | No tests in this package; mirrors `srs-engine` tsconfig pattern |
| `package.json` exports | `"."` → `dist/index.js` / `dist/index.d.ts` | Standard ESM exports matching workspace conventions |
| `QuestionType` wire values | `'multiple_choice' \| 'word_block' \| 'audio'` | HTTP-friendly snake_case strings; distinct from engine's internal `'mc' \| 'wordBlock' \| 'audio'` |
| `phase` wire value | `'learning' \| 'anki_review'` | Public-facing name; distinct from engine's internal `'srsM2_review'` |
| `QuizAnswer.correct` | `boolean` field named `correct` | Cleaner HTTP JSON than `isCorrect`; EP plan mandates this name |
| `ErrorCode` casing | `UPPER_SNAKE_CASE` enum values | Standard convention for error code constants |
| Stub files | `src/auth.ts` and `src/curation.ts` with empty exports | Reserve module paths for Stage 5/7; consumers can import without breaking |

---

## 3. Data Structures

### `src/errors.ts`

```typescript
/** UPPER_SNAKE_CASE error codes for all API error responses. */
export enum ErrorCode {
  NOT_FOUND = 'NOT_FOUND',
  BAD_REQUEST = 'BAD_REQUEST',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  UNAUTHORIZED = 'UNAUTHORIZED',
  UNPROCESSABLE_ENTITY = 'UNPROCESSABLE_ENTITY',
}

export interface ApiError {
  code: ErrorCode;
  message: string;
}

/** Universal response envelope for all SRS HTTP endpoints. */
export type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: ApiError };
```

### `src/srs.ts`

```typescript
/** Wire-format question types — HTTP-friendly snake_case.
 *  Maps from engine-internal: 'mc' → 'multiple_choice', 'wordBlock' → 'word_block' */
export type QuestionType = 'multiple_choice' | 'word_block' | 'audio';

/** GET /srs/batch — query parameters */
export interface GetBatchRequest {
  /** Number of questions to include in the batch. */
  size?: number;
}

/** A single question in the batch payload. */
export interface QuizQuestion {
  wordId: string;
  questionType: QuestionType;
}

/** Response payload for GET /srs/batch */
export interface BatchPayload {
  questions: QuizQuestion[];
  batchSize: number;
}

/** A single answer submitted by the client. */
export interface QuizAnswer {
  wordId: string;
  /** true = correct, false = incorrect */
  correct: boolean;
}

/** POST /srs/answers — request body */
export interface SubmitAnswersRequest {
  answers: QuizAnswer[];
}

/** Mastery phase visible to clients.
 *  Maps from engine-internal: 'srsM2_review' → 'anki_review' */
export type MasteryPhase = 'learning' | 'anki_review';

/** Per-word result after answers are processed. */
export interface AnswerResultPayload {
  wordId: string;
  correct: boolean;
  masteryCount: number;
  phase: MasteryPhase;
}

/** Summary of a single word's mastery state — used in batch result responses. */
export interface WordMasterySummary {
  wordId: string;
  masteryCount: number;
  phase: MasteryPhase;
}
```

### `src/auth.ts` (stub)

```typescript
// Stage 5 — auth wire types deferred
export {};
```

### `src/curation.ts` (stub)

```typescript
// Stage 7 — curation wire types deferred
export {};
```

### `src/index.ts`

```typescript
export * from './errors.js';
export * from './srs.js';
export * from './auth.js';
export * from './curation.js';
```

---

## 4. User Workflows

```
Developer adds @gll/api-contract to server or web package.json

START
  → pnpm install (workspace protocol resolves packages/api-contract/)
  → import { ApiResponse, BatchPayload, ErrorCode } from '@gll/api-contract'
  → TypeScript enforces wire shapes at compile time
  → pnpm typecheck → no errors
END
```

```
Type drift scenario — prevented at CI

START
  → Server returns { phase: 'srsM2_review' } (engine-internal leak)
  → Client imports WordMasterySummary — phase: 'learning' | 'anki_review'
  → TypeScript assignment error → CI fails → drift caught before runtime
END
```

---

## 5. Stories

### EP11-ST01: Package scaffold + error types

**Scope**: Create `packages/api-contract/` with full scaffolding and error envelope types.

**Read List**:

- `packages/srs-engine/package.json` (package.json conventions)
- `packages/srs-engine/tsconfig.json` (tsconfig pattern)
- `tsconfig.base.json` (base config being extended)
- `pnpm-workspace.yaml` (verify workspace packages glob)

**Tasks**:

- [ ] Create `packages/api-contract/package.json` — `name: "@gll/api-contract"`, `version: "0.1.0"`, `private: true`, `type: "module"`, ESM exports, `scripts: { build, typecheck, lint }`, zero dependencies, `devDependencies: { typescript }`
- [ ] Create `packages/api-contract/tsconfig.json` — extends `../../tsconfig.base.json`, `outDir: dist`, `include: ["src/**/*"]`
- [ ] Create `packages/api-contract/src/errors.ts` — `ErrorCode` enum, `ApiError`, `ApiResponse<T>`
- [ ] Create `packages/api-contract/src/auth.ts` — stub with `export {}`
- [ ] Create `packages/api-contract/src/curation.ts` — stub with `export {}`
- [ ] Create `packages/api-contract/src/index.ts` — re-export all four modules
- [ ] Run `pnpm --filter @gll/api-contract typecheck` and confirm it passes

**Acceptance Criteria**:

- [ ] `packages/api-contract/package.json` declares `name: "@gll/api-contract"` and zero runtime dependencies
- [ ] `ApiResponse<T>`, `ApiError`, and `ErrorCode` are exported from the package root (`src/index.ts`)
- [ ] `pnpm --filter @gll/api-contract typecheck` passes with no errors
- [ ] `src/auth.ts` and `src/curation.ts` exist and are valid TypeScript (no syntax errors)

### EP11-ST02: SRS wire types

**Scope**: Add `src/srs.ts` with all Stage 2 SRS wire types and export from the barrel.

**Read List**:

- `packages/srs-engine/src/types.ts` (engine-internal types — to confirm what NOT to re-export)
- `packages/api-contract/src/index.ts` (ST01 output — to extend)
- `.agents/plans/epics/EP11-api-contract-package.md` (wire type names and field constraints)

**Tasks**:

- [ ] Create `packages/api-contract/src/srs.ts` — define `QuestionType`, `GetBatchRequest`, `QuizQuestion`, `BatchPayload`, `QuizAnswer`, `SubmitAnswersRequest`, `MasteryPhase`, `AnswerResultPayload`, `WordMasterySummary`
- [ ] Add `export * from './srs.js'` to `src/index.ts`
- [ ] Run `pnpm --filter @gll/api-contract typecheck` and confirm still passes

**Acceptance Criteria**:

- [ ] All 9 SRS wire types are exported from the package root
- [ ] `QuizQuestion.questionType` is typed as `'multiple_choice' | 'word_block' | 'audio'`
- [ ] `QuizAnswer.correct` is a `boolean` field (not `isCorrect`)
- [ ] `WordMasterySummary.phase` is typed as `'learning' | 'anki_review'`
- [ ] No engine-internal types (`WordState`, `Batch`, `Question`, `MasteryPhase` from engine, etc.) are imported or re-exported
- [ ] `pnpm --filter @gll/api-contract typecheck` passes with no errors

---

## 6. Success Criteria

1. `packages/api-contract/` exists with `package.json` declaring `name: "@gll/api-contract"` and zero runtime dependencies
2. `ApiResponse<T>`, `ApiError`, and `ErrorCode` are exported from the package root
3. All Stage 2 SRS wire types are exported from the package root
4. `pnpm --filter @gll/api-contract typecheck` passes
5. No engine-internal types are imported or re-exported
