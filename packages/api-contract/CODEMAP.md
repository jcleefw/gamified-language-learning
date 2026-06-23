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
| `errors.ts`     | `ErrorCode` enum, `ApiError`, `ApiResponse<T>` — universal HTTP envelope |
| `srs.ts`        | V2 SRS state wire types: `WordStatePayload`, `GetStateResponse`, `UpsertWordStateRequest` |
| `auth.ts`       | Stub — auth wire types deferred                                         |
| `curation.ts`   | Stub — curation wire types deferred                                     |

---

## Exports Summary

| Export                   | Source       |
| ------------------------ | ------------ |
| `ErrorCode`              | `errors.ts`  |
| `ApiError`               | `errors.ts`  |
| `ApiResponse<T>`         | `errors.ts`  |
| `WordStatePayload`       | `srs.ts`     |
| `GetStateResponse`       | `srs.ts`     |
| `UpsertWordStateRequest` | `srs.ts`     |
