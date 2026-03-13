# CODEMAP.md — `packages/api-contract/`

Types-only package exporting shared HTTP wire-format types for `@gll/api-contract`.

**Update this file whenever**: files are added, removed, or their exported API changes.

---

## Package Root

| File           | Purpose                                              |
| -------------- | ---------------------------------------------------- |
| `package.json` | Package manifest — `@gll/api-contract`, no runtime deps |
| `tsconfig.json`| Extends `tsconfig.base.json`; `outDir: dist`; `src/**/*` only |
| `CODEMAP.md`   | This file                                            |

---

## `src/`

| File            | Purpose                                                                 |
| --------------- | ----------------------------------------------------------------------- |
| `index.ts`      | Barrel re-export — re-exports all modules                               |
| `errors.ts`     | `ErrorCode` enum (incl. `INSUFFICIENT_WORD_POOL`), `ApiError`, `ApiResponse<T>` — universal HTTP envelope |
| `srs.ts`        | SRS wire types: `QuestionType`, `GetBatchRequest`, `QuizQuestion` (with `choices`), `BatchPayload`, `QuizAnswer` (with `selectedKey`), `SubmitAnswersRequest`, `MasteryPhase`, `AnswerResultPayload` (with `submittedKey`+`correctKey`), `WordMasterySummary`, `SeedPayload` |
| `auth.ts`       | Stub — Stage 5 auth wire types deferred                                 |
| `curation.ts`   | Stub — Stage 7 curation wire types deferred                             |

---

## Exports Summary

| Export            | Source       |
| ----------------- | ------------ |
| `ErrorCode`       | `errors.ts`  |
| `ApiError`        | `errors.ts`  |
| `ApiResponse<T>`  | `errors.ts`  |
| `QuestionType`    | `srs.ts`     |
| `GetBatchRequest` | `srs.ts`     |
| `QuizQuestion`    | `srs.ts`     |
| `BatchPayload`    | `srs.ts`     |
| `QuizAnswer`      | `srs.ts`     |
| `SubmitAnswersRequest` | `srs.ts` |
| `MasteryPhase`    | `srs.ts`     |
| `AnswerResultPayload` | `srs.ts` |
| `WordMasterySummary`  | `srs.ts` |
| `SeedPayload`         | `srs.ts` |
