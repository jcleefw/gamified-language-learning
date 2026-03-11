# EP11-ST01: Package scaffold + error types

**Created**: 20260312T000000Z
**Epic**: [EP11 - `@gll/api-contract` — Shared HTTP Types](../../plans/epics/EP11-api-contract-package.md)
**Status**: Complete ✅

## Summary

Created `packages/api-contract/` with full package scaffolding and the error envelope types. Zero runtime dependencies. `pnpm --filter @gll/api-contract typecheck` passes.

## Files Modified

### `packages/api-contract/package.json` (new)

- Package manifest: `name: "@gll/api-contract"`, `version: "0.1.0"`, `type: "module"`, ESM exports, zero runtime deps, `devDependencies: { typescript }`

### `packages/api-contract/tsconfig.json` (new)

- Extends `../../tsconfig.base.json`; `outDir: dist`; `include: ["src/**/*"]` only

### `packages/api-contract/src/errors.ts` (new)

- `ErrorCode` enum (UPPER_SNAKE_CASE): `NOT_FOUND`, `BAD_REQUEST`, `INTERNAL_ERROR`, `UNAUTHORIZED`, `UNPROCESSABLE_ENTITY`
- `ApiError` interface: `{ code: ErrorCode; message: string }`
- `ApiResponse<T>` discriminated union: `{ success: true; data: T } | { success: false; error: ApiError }`

### `packages/api-contract/src/auth.ts` (new)

- Stub with `export {}` — Stage 5 auth wire types deferred

### `packages/api-contract/src/curation.ts` (new)

- Stub with `export {}` — Stage 7 curation wire types deferred

### `packages/api-contract/src/index.ts` (new)

- Barrel re-exporting `errors.js`, `auth.js`, `curation.js`

### `packages/api-contract/CODEMAP.md` (new)

- Package navigation index

### `CODEMAP.md` (updated)

- Added `packages/api-contract/` row to packages table

## Behavior Preserved / New Behavior

- New package with no runtime behavior — types only
- `ApiResponse<T>`, `ApiError`, `ErrorCode` exported from package root
- Typecheck passes with zero errors

## Next Steps

- EP11-ST02: Add `src/srs.ts` SRS wire types
