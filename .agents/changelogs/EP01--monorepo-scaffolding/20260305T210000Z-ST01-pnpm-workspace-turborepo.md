# EP01-ST01: pnpm Workspace + Turborepo

**Created**: 20260305T210000Z
**Epic**: [EP01 - Monorepo Scaffolding](../../plans/epics/EP01-monorepo-scaffolding.md)
**Status**: Complete ✅

## Summary

Created the three root config files that establish pnpm workspace and Turborepo build orchestration. All acceptance criteria pass. One gap found in DS01: Turbo 2.x requires `packageManager` in `package.json` — added and documented in `recent-decisions.md`.

## Files Modified

### `pnpm-workspace.yaml`
- New file. Declares `packages/*` and `apps/*` as workspace members.

### `package.json`
- New file. Root scripts (`build`, `test`, `test:watch`, `lint`) + devDependencies (turbo, typescript, vitest, eslint, typescript-eslint).
- Added `"packageManager": "pnpm@10.30.1"` — required by Turbo 2.x, not in DS01 spec.

### `turbo.json`
- New file. Task graph: `build` (outputs `dist/**`), `test` (no cache), `lint`.

## Behavior Preserved / New Behavior

- `pnpm install` exits 0, `node_modules/.pnpm` lockfile created ✅
- `pnpm build` exits 0 (0 packages, no-op) ✅
- `pnpm test` and `pnpm lint` wired via Turborepo (validated in ST03)

## Next Steps

- EP01-ST02: Root `tsconfig.base.json` + `eslint.config.ts`
