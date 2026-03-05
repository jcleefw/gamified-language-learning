# EP01 - Monorepo Scaffolding

**Created**: 2026-03-05
**Status**: Accepted
<!-- Status: Draft | Accepted | In Progress | Impl-Complete | BDD Pending | Completed | Shelved | Withdrawn -->
**Type**: Epic Plan
**Depends on**: N/A
**Predecessor**: N/A

---

## Problem Statement

No project structure exists. All Stage 1 work (and every subsequent stage) requires a working monorepo with shared tooling before any package can be built.

## Scope

**In scope**:
- `pnpm` workspaces root config (`pnpm-workspace.yaml`, root `package.json`)
- Turborepo setup (`turbo.json` — build + test pipeline)
- Root `tsconfig.json` (strict, path aliases, base for all packages)
- ESLint flat config (`eslint.config.js` — TypeScript strict, no framework rules yet)
- Vitest workspace config (root `vitest.workspace.ts`, shared test setup)
- Initial `packages/srs-engine/` scaffold (empty `src/index.ts`, `package.json`, `tsconfig.json`)

**Out of scope**:
- Any application packages (`apps/web`, `apps/backend`) — not needed until Stage 2+
- Cloudflare Wrangler config — Stage 2
- CI/CD pipeline setup — post-MVP

---

## Stories

### EP01-ST01: pnpm workspace + Turborepo
**Scope**: Root `package.json`, `pnpm-workspace.yaml`, `turbo.json` with build + test tasks declared

### EP01-ST02: Root tsconfig + ESLint flat config
**Scope**: `tsconfig.json` (strict base), `eslint.config.js` (TypeScript strict rules, flat config format)

### EP01-ST03: Vitest workspace + srs-engine package scaffold
**Scope**: Root `vitest.workspace.ts`, `packages/srs-engine/` skeleton (package.json, tsconfig.json, src/index.ts, `__tests__/` dirs), `pnpm test` returns 0 tests found (not an error)

---

## Overall Acceptance Criteria

- [ ] `pnpm install` succeeds from root with no errors
- [ ] `pnpm build` (via Turborepo) succeeds with no source files yet (no-op is acceptable)
- [ ] `pnpm test` runs Vitest workspace and exits green (0 tests, 0 failures)
- [ ] `packages/srs-engine/` has its own `package.json` and `tsconfig.json` extending root
- [ ] ESLint runs on `packages/srs-engine/src/**` without config errors

---

## Dependencies

- N/A — this is the foundation for all Stage 1 work

## Next Steps

1. ~~Review and approve this epic~~
2. ~~Create Design Spec (DS01) covering exact file shapes + pnpm/Turborepo version pins~~ → [DS01 Approved](../../changelogs/EP01--monorepo-scaffolding/20260305T200100Z-DS01-monorepo-scaffolding.md)
3. Begin ST01