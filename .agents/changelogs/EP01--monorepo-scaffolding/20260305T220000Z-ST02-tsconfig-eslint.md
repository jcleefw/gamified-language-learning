# EP01-ST02: Root tsconfig + ESLint flat config

**Created**: 20260305T220000Z
**Epic**: [EP01 - Monorepo Scaffolding](../../plans/epics/EP01-monorepo-scaffolding.md)
**Status**: Complete ✅

## Summary

Created shared TypeScript base config and ESLint flat config. Config parses and resolves correctly against `packages/**/*.ts`. One gap found in DS01: ESLint 9.x requires `jiti` to load `.ts` config files — installed as root devDependency.

## Files Modified

### `tsconfig.base.json`
- New file. Strict ESNext settings. All packages extend via `"extends": "../../tsconfig.base.json"`.

### `eslint.config.ts`
- New file. TypeScript strict layer scoped to `packages/**/*.ts`. Test overrides for `__tests__/**`.

### `package.json`
- Added `jiti` to devDependencies — required by ESLint 9.x to load `eslint.config.ts`.

## Behavior Preserved / New Behavior

- `npx tsc --version` reports 5.9.3 ✅
- ESLint config parses and resolves correctly (`--print-config` verified) ✅
- `eslint .` exits with "all files ignored" — expected, no `packages/**/*.ts` files exist yet ✅

## Next Steps

- EP01-ST03: Vitest workspace + `packages/srs-engine/` skeleton
