# EP10-DS01: GitHub Actions CI Specification

**Date**: 20260308T061000Z
**Status**: Accepted
**Epic**: [EP10 - GitHub Actions CI — Test + Lint](../../plans/epics/EP10-github-actions-ci.md)

---

## 1. Feature Overview

A single GitHub Actions workflow (`.github/workflows/ci.yml`) that runs lint, type-check, and test on every push and pull request. This provides an automated quality gate before merging any PR.

A prerequisite `typecheck` script and Turbo task must be added first — neither exists in the repo today.

---

## 2. Core Requirements

| Requirement      | Decision                                           | Rationale                                                           |
| ---------------- | -------------------------------------------------- | ------------------------------------------------------------------- |
| Workflow trigger | `push` (all branches) + `pull_request` (to `main`) | Catches issues on feature branches and validates PRs before merge   |
| Node version     | 22 (pinned via `.tool-versions`)                   | Matches local dev environment                                       |
| pnpm version     | Read from `packageManager` field                   | Single source of truth — avoids version drift between local and CI  |
| Install strategy | `pnpm install --frozen-lockfile`                   | Ensures CI uses exact lockfile versions, fails on lockfile mismatch |
| CI steps         | lint → typecheck → test (sequential)               | Fail fast on cheapest checks first; test is the most expensive      |
| Caching          | `actions/setup-node` built-in pnpm cache           | Speeds up installs without manual cache config                      |
| Concurrency      | Cancel in-progress runs on same branch             | Saves CI minutes when pushing multiple commits quickly              |

---

## 3. Data Structures

### turbo.json — new `typecheck` task

```jsonc
{
  "typecheck": {
    "dependsOn": ["^build"],
  },
}
```

### Root package.json — new script

```jsonc
{
  "scripts": {
    "typecheck": "turbo typecheck",
  },
}
```

### packages/srs-engine/package.json — new script

```jsonc
{
  "scripts": {
    "typecheck": "tsc --noEmit",
  },
}
```

### .github/workflows/ci.yml

```yaml
name: CI

on:
  push:
    branches: ['**']
  pull_request:
    branches: [main]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  ci:
    name: Lint, Typecheck, Test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v4
        with:
          node-version-file: '.tool-versions'
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile

      - name: Lint
        run: pnpm lint

      - name: Typecheck
        run: pnpm typecheck

      - name: Test
        run: pnpm test
```

---

## 4. User Workflows

```
Developer pushes branch
  → GitHub Actions triggers ci.yml
    → checkout → pnpm install (cached)
      → pnpm lint       (fail? → red ✗, stop)
      → pnpm typecheck   (fail? → red ✗, stop)
      → pnpm test        (fail? → red ✗, stop)
    → All green → ✓ check passes on PR
```

---

## 5. Stories

### EP10-ST01: Add `typecheck` script and Turbo task

**Scope**: Root package.json, srs-engine package.json, turbo.json
**Read List**: `package.json`, `packages/srs-engine/package.json`, `turbo.json`
**Tasks**:

- [ ] Add `"typecheck": "tsc --noEmit"` to `packages/srs-engine/package.json` scripts
- [ ] Add `"typecheck": { "dependsOn": ["^build"] }` to `turbo.json` tasks
- [ ] Add `"typecheck": "turbo typecheck"` to root `package.json` scripts
- [ ] Run `pnpm typecheck` locally — verify it passes
      **Acceptance Criteria**:
- [ ] `pnpm typecheck` exits 0 with no type errors
- [ ] `pnpm turbo typecheck` shows srs-engine in task graph

### EP10-ST02: Create GitHub Actions CI workflow

**Scope**: `.github/workflows/ci.yml`
**Read List**: `.tool-versions`, `package.json` (for `packageManager` field)
**Tasks**:

- [ ] Create `.github/workflows/ci.yml` per the spec in §3
- [ ] Verify YAML is valid (no syntax errors)
      **Acceptance Criteria**:
- [ ] `.github/workflows/ci.yml` exists with `push` + `pull_request` triggers
- [ ] Workflow uses `pnpm/action-setup@v4`, `actions/setup-node@v4` with `.tool-versions`
- [ ] Steps run in order: install → lint → typecheck → test
- [ ] Concurrency group cancels in-progress runs on same branch
- [ ] Workflow triggers on a test push to GitHub (manual verification by developer)

---

## 6. Success Criteria

1. `pnpm typecheck` passes locally across all packages
2. CI workflow runs on push and PR — lint, typecheck, test all green
3. A failing test or lint error produces a red ✗ on the PR (verified on first real PR)
