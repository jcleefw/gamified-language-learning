# EP10-ST01 & ST02: Typecheck Plumbing + GitHub Actions CI

**Created**: 20260308T062000Z
**Epic**: [EP10 - GitHub Actions CI — Test + Lint](../../plans/epics/EP10-github-actions-ci.md)
**Status**: Complete ✅

## Summary

Added `typecheck` script and Turbo task across the monorepo (ST01), then created a GitHub Actions CI workflow that runs lint, typecheck, and test on every push and PR (ST02).

## Files Modified

### `packages/srs-engine/package.json`
- Added `"typecheck": "tsc --noEmit"` script

### `turbo.json`
- Added `typecheck` task with `dependsOn: ["^build"]`

### `package.json` (root)
- Added `"typecheck": "turbo typecheck"` script

### `.github/workflows/ci.yml` (new)
- Created CI workflow: checkout → pnpm install → lint → typecheck → test
- Triggers on push (all branches) and PR to main
- Concurrency group cancels in-progress runs on same branch
- Uses `pnpm/action-setup@v4`, `actions/setup-node@v4` with `.tool-versions`

## New Behavior

- `pnpm typecheck` runs `tsc --noEmit` across all packages via Turbo
- GitHub Actions CI provides automated quality gate on PRs
- Stale CI runs are cancelled when new commits are pushed to the same branch

## Next Steps

- Push branch and verify workflow triggers on GitHub (manual verification)
