# EP01-ST03: Vitest Workspace + srs-engine Package Scaffold

**Created**: 2026-03-05
**Epic**: [EP01 - Monorepo Scaffolding](../../plans/epics/EP01-monorepo-scaffolding.md)
**Status**: Complete ✅

## Summary

Created root Vitest workspace config and full `packages/srs-engine/` skeleton. `pnpm install`, `pnpm build`, and `pnpm test` all exit 0. Three gaps in DS01 spec were corrected during implementation (see recent-decisions.md).

## Files Modified

### `vitest.workspace.ts` (new)

- Root workspace config pointing Vitest to `packages/*/vitest.config.ts`

### `packages/srs-engine/package.json` (new)

- `@gll/srs-engine` package — ESM, private, devDeps with version ranges (`^5.7`, `^3`)
- DS01 specified `workspace:*` for npm deps — corrected to version ranges (pnpm `workspace:*` is for internal packages only)

### `packages/srs-engine/tsconfig.json` (new)

- Extends `../../tsconfig.base.json`, `rootDir: src`, `outDir: dist`
- DS01 included `__tests__/**/*` in `include` — removed (conflicts with `rootDir: src`; Vitest handles test TS via its own bundler)

### `packages/srs-engine/vitest.config.ts` (new)

- Includes `__tests__/**/*.test.ts`, `globals: true`, `setupFiles`
- Added `passWithNoTests: true` — Vitest 3.x exits 1 on no test files by default (DS01 claimed exit 0)

### `packages/srs-engine/__tests__/setup.ts` (new)

- `afterEach(() => vi.useRealTimers())` — prevents fake timer bleed between tests

### `packages/srs-engine/src/index.ts` (new)

- `export {}` stub — public API populated by EP02+

### `packages/srs-engine/README.md` (new)

- Test run instructions (full package, watch mode, single file, single test by name)

### `packages/srs-engine/__tests__/unit/.gitkeep` (new)

- Directory placeholder for EP02+ unit tests

### `packages/srs-engine/__tests__/integration/.gitkeep` (new)

- Directory placeholder for EP07+ integration tests

## Behavior Preserved / New Behavior

- `pnpm install` exits 0 (2 workspace projects resolved)
- `pnpm build` exits 0 — compiles `src/index.ts` → `dist/index.js` + `dist/index.d.ts`
- `pnpm test` exits 0 — "No test files found, exiting with code 0" (Vitest 3.2.4)
- ESLint runs on `packages/srs-engine/src/` without config errors

## DS01 Spec Gaps Corrected

| Gap                        | DS01 Said                        | Actual / Fix                                                         |
| -------------------------- | -------------------------------- | -------------------------------------------------------------------- |
| `devDependencies` protocol | `"typescript": "workspace:*"`    | `"typescript": "^5.7"` — `workspace:*` is for internal packages only |
| tsconfig `include`         | `["src/**/*", "__tests__/**/*"]` | `["src/**/*"]` — `__tests__` conflicts with `rootDir: src`           |
| Vitest no-test exit code   | "exits 0 by default"             | Exits 1 — added `passWithNoTests: true`                              |

## Next Steps

- EP01 complete — all 3 stories done, overall AC met
- Next: EP02 — SRS engine core (scheduler, card model, review logic)
