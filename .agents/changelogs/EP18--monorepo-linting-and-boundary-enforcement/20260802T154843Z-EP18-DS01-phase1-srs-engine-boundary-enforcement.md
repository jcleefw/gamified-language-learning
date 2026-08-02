# EP18-DS01: Phase 1 — SRS Engine Boundary Enforcement & Pre-Commit Gate Specification

**Date**: 20260802T154843Z
**Status**: Completed
**Epic**: [EP18 - Monorepo Linting & Boundary Enforcement](../../plans/epics/EP18-monorepo-linting-and-boundary-enforcement.md)
**Covers**: EP18-PH01 (EP18-ST01–ST04) only. EP18 was renamed/rescoped to a monorepo-wide epic after this DS was written; Phase 2 (EP18-ST05–ST09) is covered by EP18-DS02, not this document.

---

## 1. Feature Overview

Two independent additions to root tooling, sequenced as two phases:

**Phase 1** adds three `no-restricted-imports` blocks to `eslint.config.ts`, each scoped by a `files` glob, turning three prose rules in `packages/srs-engine/RULES.md` into lint failures:

1. `shelving/`/`review/` → `learn/` (internal, flat block, no exception — see EP18's Decisions Log).
2. Any non-srs-engine file → bare `@gll/srs-engine` specifier (external, blacklist).
3. `apps/srs-demo/**` → `@gll/srs-engine/review` specifically (external, narrower blacklist).

Verified against current code: all three rules have **zero existing violations** — no file today imports `learn/` from `shelving/`/`review/`, no consumer imports the bare package, and `srs-demo` never imports `/review`. So "incremental adoption" is a forward-looking safety net here, not a migration with a fix-up list.

**Phase 2** installs `husky` + `lint-staged` and wires a `pre-commit` hook that runs `lint-staged` against staged files (`*.{ts,vue}` → `eslint --fix`). **EP18-ST04 withdrawn during implementation**: the original plan also wired `TURBO_SCM_BASE=HEAD turbo run typecheck test --affected` into the hook (verified to correctly scope to touched packages + real dependents — a working-tree change scoped to `packages/srs-engine/src/shelving/policy.ts` alone correctly resolved to `srs-engine` + `db`/`server`/`srs-demo`/`cli-demo-db`), but any commit touching a root-level dependency/config file is *correctly* treated by turbo as a global-input change and fans out to every package — producing unpredictable, sometimes long commit-time latency. Since CI (`.github/workflows/ci.yml`) already runs `build`/`lint`/`typecheck`/`test` on every push to every branch, that enforcement is deferred there instead; the pre-commit hook stays lint-only. See EP18's Decisions Log for the full reasoning.

## 2. Core Requirements

| Requirement | Decision | Rationale |
| --- | --- | --- |
| Internal boundary rule mechanism | `no-restricted-imports` (`zones`/`patterns` option), scoped via ESLint `files` glob | Already available through the existing `typescript-eslint` setup; no new dependency. Sufficient for two flat, path-based rules (see EP18 Decisions Log — do not reach for `eslint-plugin-import` until rules need zone/graph semantics) |
| `GraduationPerformance` exception | Dropped — flat block | It's defined in `review/types.ts`, not `learn/`; RULES.md's carve-out describes no case that exists in code today. Add the exception later if a real cross-boundary import needs it |
| External bare-import rule scope | `files: ['**/*.ts', '**/*.vue']`, with the srs-engine package's own source excluded via the block's placement/`ignores` | The block must not fire inside `packages/srs-engine/**` itself (it legitimately has no reason to import its own published subpath specifiers, but internal relative imports must not be caught by a package-name pattern) |
| `apps/srs-demo` → `/review` rule scope | `files: ['apps/srs-demo/**/*.{ts,vue}']` | Blacklist approach per RULES.md — every other consumer (server, cli-demo-db, db) may import `/review` freely; only the frontend client is barred |
| Pre-commit typecheck/test enforcement | **Withdrawn (EP18-ST04)** — not run at commit time | `TURBO_SCM_BASE=HEAD turbo run typecheck test --affected` was verified to correctly scope to touched packages + dependents, but any root-level dependency/config commit is *correctly* treated as a global-input change and fans out to every package, producing unpredictable commit-time latency. CI already runs `build`/`lint`/`typecheck`/`test` on every push; enforcement is deferred there instead. See EP18 Decisions Log |
| Husky setup method | `pnpm dlx husky init` (adds `prepare: "husky"` script + `.husky/pre-commit`) | Standard, minimal-footprint bootstrap; avoids hand-writing hook plumbing husky already generates |
| `lint-staged` scope | `*.{ts,vue}` → `eslint --fix` | Matches the existing repo-wide lint surface (`eslint.config.ts` already covers `.ts`/`.vue` via `apps/**`/`packages/**` blocks); `--fix` auto-resolves what's auto-fixable before the commit is blocked on the rest |
| Boundary-rule regression test mechanism | `eslint-boundary-rules.test.ts` (repo root), using the programmatic `ESLint` class against real on-disk fixture files under `__fixtures__/` dirs inside the affected packages, run as a named `tooling` project in `vitest.workspace.ts` | `pnpm lint` only proves the *current codebase* is clean — it can't catch a future regression in the rule config itself (e.g. an accidentally reverted block), since there'd be no real violation left to trip over. Fixtures give a dedicated red/green check on the rule config. A named workspace project (not a bare `--config` flag) is required because Vitest treats an existing `vitest.workspace.ts` as authoritative and won't honor a separate `--config` for an out-of-band run |
| Boundary-rule regression test CI enforcement | Add one step (`pnpm test:eslint-config`) to the existing `lint` job in `.github/workflows/ci.yml` | **Narrow, explicit exception to EP18's "CI pipeline changes beyond the local pre-commit hook" out-of-scope line** (epic amended to carve this out) — without it, the regression test only ever runs if someone remembers to run it locally, defeating its purpose. No new CI job, no pipeline restructuring |

## 3. Config Additions

```typescript
// eslint.config.ts — Phase 1 additions (illustrative shape, not final formatting)

// ST01: internal boundary — shelving/review must not import learn/
{
  files: ['packages/srs-engine/src/{shelving,review}/**/*.ts'],
  rules: {
    'no-restricted-imports': [
      'error',
      { patterns: [{ group: ['**/learn/*', '**/learn'], message: 'shelving/ and review/ must not import learn/ — see packages/srs-engine/RULES.md' }] },
    ],
  },
},

// ST02a: external — no bare `@gll/srs-engine` import from outside the package
{
  files: ['apps/**/*.{ts,vue}', 'packages/!(srs-engine)/**/*.ts'],
  rules: {
    'no-restricted-imports': [
      'error',
      { paths: [{ name: '@gll/srs-engine', message: 'Import a subpath (/learn, /shelving, /review, /data/*) — there is no barrel export.' }] },
    ],
  },
},

// ST02b: external — srs-demo specifically may not import /review
{
  files: ['apps/srs-demo/**/*.{ts,vue}'],
  rules: {
    'no-restricted-imports': [
      'error',
      { paths: [{ name: '@gll/srs-engine/review', message: 'review scheduling is server-side only — see packages/srs-engine/RULES.md' }] },
    ],
  },
},
```

```jsonc
// package.json — Phase 2 additions
{
  "scripts": {
    "prepare": "husky"
  },
  "lint-staged": {
    "*.{ts,vue}": ["eslint --fix"]
  }
}
```

```bash
# .husky/pre-commit
pnpm lint-staged
```

```typescript
// vitest.workspace.ts — add a named root-only project alongside the per-package ones
import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  'packages/*/vitest.config.ts',
  'apps/*/vitest.config.ts',
  {
    test: {
      name: 'tooling',
      include: ['eslint-boundary-rules.test.ts'],
      globals: true,
    },
  },
]);
```

```jsonc
// package.json — add alongside the Phase 2 additions
{
  "scripts": {
    "test:eslint-config": "vitest run --project tooling"
  }
}
```

```yaml
# .github/workflows/ci.yml — lint job, one added line
- run: pnpm lint
- run: pnpm test:eslint-config
```

## 4. User Workflows

```
Developer runs `git commit`
  → husky pre-commit hook fires
  → lint-staged runs eslint --fix on staged .ts/.vue files
      → lint failure (unfixable) → commit blocked, hook exits non-zero
      → pass (or auto-fixed) → commit created
  → (typecheck/test enforcement deferred to CI — EP18-ST04 withdrawn)
  → git push
      → CI runs build, lint, typecheck, test — failures surface here, not at commit time
```

## 5. Stories

### Phase 1: Boundary Enforcement (EP18-PH01)

### EP18-ST01: Internal import-boundary ESLint rule

**Scope**: Add the `no-restricted-imports` block flagging any `shelving/`/`review/` import from `learn/` (no exception).
**Read List**: `eslint.config.ts`, `packages/srs-engine/RULES.md`, `packages/srs-engine/src/shelving/index.ts`, `packages/srs-engine/src/review/index.ts`
**Tasks**:

- [x]Add the scoped `no-restricted-imports` block for `packages/srs-engine/src/{shelving,review}/**`
- [x]Confirm existing `shelving/`/`review/` files (including `__tests__/`) pass with zero violations
- [x]Scaffold `eslint-boundary-rules.test.ts` (root) + the `tooling` project in `vitest.workspace.ts`; add the ST01 red/green fixture pair under `packages/srs-engine/src/shelving/__fixtures__/`
      **Acceptance Criteria**:
- [x]A test import of a `learn/` module from a new file under `shelving/` or `review/` triggers an ESLint error
- [x]`pnpm lint` on the current codebase shows zero new violations
- [x]`pnpm test:eslint-config` passes, covering the ST01 rule (violation + no-false-positive control)

### EP18-ST02: External import-boundary ESLint rule

**Scope**: Add the two `no-restricted-imports` blocks: bare `@gll/srs-engine` blacklist (all non-srs-engine consumers) and `@gll/srs-engine/review` blacklist scoped to `apps/srs-demo`.
**Read List**: `eslint.config.ts`, `packages/srs-engine/package.json` (`exports` map), `apps/srs-demo/RULES.md`
**Tasks**:

- [x]Add the bare-package-import block scoped to exclude `packages/srs-engine/**`
- [x]Add the `srs-demo`-specific `/review` block
- [x]Extend `eslint-boundary-rules.test.ts` with ST02a/ST02b red/green fixture pairs (`apps/server/src/__fixtures__/`, `apps/srs-demo/src/__fixtures__/`, `packages/srs-engine/src/review/__fixtures__/`)
- [x]Add `test:eslint-config` script to root `package.json`; add the `pnpm test:eslint-config` step to the CI `lint` job in `.github/workflows/ci.yml`
      **Acceptance Criteria**:
- [x]A test import of the bare `@gll/srs-engine` specifier from any app/package (other than srs-engine itself) triggers an ESLint error
- [x]A test import of `@gll/srs-engine/review` from `apps/srs-demo` triggers an ESLint error
- [x]`apps/server`, `apps/cli-demo-db`, `packages/db` importing `@gll/srs-engine/review` continues to pass (blacklist, not allowlist)
- [x]`pnpm lint` on the current codebase shows zero new violations
- [x]`pnpm test:eslint-config` passes, covering all three rules plus their blacklist-scope controls
- [x]CI's `lint` job runs `pnpm test:eslint-config` as a step

### Phase 2: Pre-Commit Gate (EP18-PH02)

### EP18-ST03: Husky + lint-staged setup

**Scope**: Install and wire `husky` + `lint-staged`; no hook behavior beyond the default yet.
**Read List**: `package.json` (root)
**Tasks**:

- [x]`pnpm add -D husky lint-staged -w`
- [x]`pnpm dlx husky init` (creates `.husky/pre-commit`, adds `prepare` script)
- [x]Add `lint-staged` config (`*.{ts,vue}` → `eslint --fix`) to root `package.json`
      **Acceptance Criteria**:
- [x]`pnpm install` runs `prepare` and installs the git hook (husky v9 sets `git config core.hooksPath` to `.husky/_`, not a copied `.git/hooks/pre-commit` file)
- [x]A commit with a staged, auto-fixable lint issue gets fixed in place before the commit completes

### ~~EP18-ST04: Pre-commit hook — lint + typecheck + affected tests~~ (Withdrawn)

Withdrawn during implementation. `TURBO_SCM_BASE=HEAD turbo run typecheck test --affected` was implemented and verified to correctly scope to touched packages + dependents, but any commit touching a root-level dependency/config file fans out to every package (correct turbo behavior for a global-input change, but unpredictable commit-time latency). Typecheck/test enforcement is deferred to CI instead, which already runs `build`/`lint`/`typecheck`/`test` on every push. See EP18's Decisions Log for the full reasoning. The pre-commit hook stops at `lint-staged` (EP18-ST03).

## 6. Success Criteria

1. All three ESLint boundary rules are active and produce zero violations against the current codebase (confirms "incremental adoption, no repo-wide fixups" holds).
2. `git commit` runs `lint-staged` against staged files; a lint failure it can't auto-fix blocks the commit.
3. `pnpm test:eslint-config` passes locally and as a CI `lint` job step, guarding against a future regression in the boundary rules themselves.
4. Typecheck/test enforcement (EP18-ST04, withdrawn) is not part of the commit-time gate — CI's existing `typecheck`/`test` jobs are the enforcement point instead.
5. No type errors.
