# EP10 - GitHub Actions CI — Test + Lint

**Created**: 20260308T060000Z
**Status**: Impl-Complete

<!-- Status: Draft | Accepted | In Progress | Impl-Complete | BDD Pending | Completed | Shelved | Withdrawn -->

**Type**: Epic Plan
**Depends on**: EP01
**Parallel with**: N/A
**Predecessor**: N/A

---

## Problem Statement

All Stage 1 engine work (EP02–EP08) runs tests locally only. There is no automated quality gate on PRs — a broken branch can be merged without anyone noticing. The infra ADR already specifies GitHub Actions for lint, type-check, and test on every PR, but no workflow exists yet.

## Scope

**In scope**:

- `.github/workflows/ci.yml` — runs on every PR and push to `main`
- Three CI steps: `pnpm lint`, `pnpm typecheck` (`tsc --noEmit`), `pnpm test`
- Root `typecheck` script + Turbo `typecheck` task (neither exists today)
- Node 22, pnpm 10 (matching `.tool-versions` and `packageManager`)

**Out of scope**:

- Commitlint — can be added later
- Deployment workflows (staging, production) — Stage 2+
- Branch preview deploys — Stage 4+
- BDD / E2E test jobs — no BDD tests exist yet
- Code coverage reporting

---

## Stories

### EP10-ST01: Add `typecheck` script and Turbo task

**Scope**: Add `"typecheck": "turbo typecheck"` to root `package.json`, add `"typecheck": "tsc --noEmit"` to `packages/srs-engine/package.json`, add `typecheck` task to `turbo.json`. Verify `pnpm typecheck` passes locally.

### EP10-ST02: Create GitHub Actions CI workflow

**Scope**: `.github/workflows/ci.yml` — triggers on `push` (all branches) and `pull_request` (to `main`). Single job: checkout → setup Node 22 → setup pnpm 10 → `pnpm install --frozen-lockfile` → `pnpm lint` → `pnpm typecheck` → `pnpm test`. Uses `pnpm/action-setup` and `actions/setup-node` with pnpm cache.

---

## Overall Acceptance Criteria

- [ ] `pnpm typecheck` runs `tsc --noEmit` across all packages and exits green
- [ ] `.github/workflows/ci.yml` exists and defines a single CI job
- [ ] CI triggers on push to any branch and PR to `main`
- [ ] CI runs lint → typecheck → test in sequence
- [ ] A test push to a branch triggers the workflow on GitHub (manual verification)

---

## Dependencies

- EP01 — monorepo scaffolding (test, lint, Turbo infrastructure must exist)

## Next Steps

1. Review and approve plan
2. Implement ST01 (typecheck plumbing) → ST02 (workflow file)
3. Push branch and verify workflow triggers on GitHub
