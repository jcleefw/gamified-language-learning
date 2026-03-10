# EP01-DS01: Monorepo Scaffolding Specification

**Date**: 2026-03-05
**Status**: Approved
**Epic**: [EP01 - Monorepo Scaffolding](../../plans/epics/EP01-monorepo-scaffolding.md)

---

## 1. Feature Overview

Establish the pnpm + Turborepo monorepo foundation. Three config layers:

1. Workspace + build orchestration (`pnpm-workspace.yaml`, `turbo.json`, root `package.json`)
2. Shared code quality tooling (`tsconfig.base.json`, `eslint.config.ts`)
3. Test infrastructure + first package skeleton (`vitest.workspace.ts`, `packages/srs-engine/`)

All subsequent packages and apps extend from this foundation without modification.

---

## 2. Core Requirements

| Requirement                 | Decision                                                   | Rationale                                                                     |
| --------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Package manager             | pnpm 9.x                                                   | Established in ADR. Workspace protocol for internal deps.                     |
| Build orchestration         | Turbo 2.x                                                  | Incremental builds, dependency graph, output caching.                         |
| TypeScript                  | 5.7.x                                                      | Latest stable; `strict: true` across all engine packages.                     |
| Test runner                 | Vitest 3.x                                                 | Fast, native ESM, Turborepo-friendly.                                         |
| ESLint                      | 9.x flat config                                            | Single root `eslint.config.ts`; glob-scoped layers per ADR.                   |
| Module format               | ESM (`"type": "module"`)                                   | All packages use native ESM.                                                  |
| Internal package scope      | `@gll/`                                                    | Project-specific scope; signals internal-only, not published to npm.          |
| tsconfig name               | `tsconfig.base.json` (root), `tsconfig.json` (per-package) | Per-package extends base; avoids `tsconfig.base.json` name collision in IDEs. |
| Node minimum                | 20 LTS                                                     | Required by Vitest 3.x and ESLint 9.x.                                        |
| `pnpm test` exit on 0 tests | Green (not error)                                          | Vitest exits 0 on "no test files found" by default.                           |

---

## 3. File Shapes

### Root `package.json`

```json
{
  "name": "gamified-language-learning",
  "private": true,
  "engines": { "node": ">=20", "pnpm": ">=9" },
  "scripts": {
    "build": "turbo build",
    "test": "turbo test",
    "test:watch": "turbo watch test",
    "lint": "eslint ."
  },
  "devDependencies": {
    "turbo": "^2",
    "typescript": "^5.7",
    "vitest": "^3",
    "eslint": "^9",
    "typescript-eslint": "^8"
  }
}
```

### `pnpm-workspace.yaml`

```yaml
packages:
  - 'packages/*'
  - 'apps/*'
```

### `turbo.json`

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "test": {
      "dependsOn": ["^build"],
      "cache": false
    },
    "lint": {
      "dependsOn": ["^build"]
    }
  }
}
```

### `tsconfig.base.json`

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "isolatedModules": true
  }
}
```

### `eslint.config.ts` (Stage 1 — packages only, no Vue/Node rules yet)

```typescript
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', '**/.nuxt/**'] },
  {
    files: ['packages/**/*.ts'],
    extends: [...tseslint.configs.strictTypeChecked],
    languageOptions: {
      parserOptions: { project: true },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports' },
      ],
      '@typescript-eslint/explicit-function-return-type': [
        'error',
        {
          allowExpressions: true,
          allowHigherOrderFunctions: true,
        },
      ],
      'no-console': 'error',
    },
  },
  {
    // Relax rules that conflict with test patterns
    files: ['**/__tests__/**/*.ts', '**/*.test.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
);
```

### `vitest.workspace.ts`

```typescript
import { defineWorkspace } from 'vitest/config';

export default defineWorkspace(['packages/*/vitest.config.ts']);
```

### `packages/srs-engine/package.json`

```json
{
  "name": "@gll/srs-engine",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint src __tests__"
  },
  "devDependencies": {
    "typescript": "workspace:*",
    "vitest": "workspace:*"
  }
}
```

### `packages/srs-engine/tsconfig.json`

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src/**/*", "__tests__/**/*"]
}
```

### `packages/srs-engine/vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['__tests__/**/*.test.ts'],
    globals: true,
    setupFiles: ['__tests__/setup.ts'],
  },
});
```

### `packages/srs-engine/__tests__/setup.ts`

```typescript
import { afterEach, vi } from 'vitest';

// Reset fake timers after each test to prevent bleed
afterEach(() => {
  vi.useRealTimers();
});
```

### `packages/srs-engine/README.md`

````markdown
# @gll/srs-engine

Spaced repetition scheduling engine. Internal package — not published to npm.

## Running tests

**All tests (whole package):**

```bash
pnpm test
```
````

**Watch mode (re-runs on file change):**

```bash
pnpm test:watch
```

**Single test file:**

```bash
npx vitest run __tests__/unit/<filename>.test.ts
```

**Single test by name:**

```bash
npx vitest run -t "your test name or describe label"
```

**From repo root (any command above via filter):**

```bash
pnpm --filter @gll/srs-engine test
pnpm --filter @gll/srs-engine exec vitest run __tests__/unit/<filename>.test.ts
```

````

### `packages/srs-engine/src/index.ts`
```typescript
// Public API — populated by EP02+
export {}
````

### Directory layout after EP01

```
/
├── packages/
│   └── srs-engine/
│       ├── src/
│       │   └── index.ts
│       ├── __tests__/
│       │   ├── setup.ts       # fake timer teardown
│       │   ├── unit/          # per-domain unit tests (EP02+)
│       │   └── integration/   # lifecycle scenario tests (EP07+)
│       ├── package.json
│       ├── tsconfig.json
│       ├── vitest.config.ts
│       └── README.md
├── tsconfig.base.json
├── eslint.config.ts
├── vitest.workspace.ts
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

---

## 4. User Workflows

```
# Whole project (from root)
pnpm install                              → resolves workspace deps, no errors
pnpm build                                → turbo builds all packages
pnpm test                                 → turbo runs all tests, exits 0
pnpm test:watch                           → turbo watches all packages
eslint .                                  → lints all packages

# Single package — replace @gll/srs-engine with any package name
pnpm --filter @gll/srs-engine build       → build one package
pnpm --filter @gll/srs-engine test        → run tests once
pnpm --filter @gll/srs-engine test:watch  → watch mode (preferred dev loop)
pnpm --filter @gll/srs-engine lint        → lint one package

# Shorthand: run from inside the package directory
cd packages/srs-engine
pnpm build
pnpm test
pnpm test:watch

# Individual test file (from package directory or root)
pnpm --filter @gll/srs-engine exec vitest run __tests__/unit/scheduler.test.ts
pnpm --filter @gll/srs-engine exec vitest run __tests__/unit/scheduler.test.ts --reporter=verbose

# Individual test by name pattern (-t matches describe/it labels)
pnpm --filter @gll/srs-engine exec vitest run -t "calculates next review interval"

# From inside the package directory
cd packages/srs-engine
npx vitest run __tests__/unit/scheduler.test.ts
npx vitest run -t "calculates next review interval"
```

---

## 5. Stories

### EP01-ST01: pnpm workspace + Turborepo

**Scope**: Root package manager and build orchestration setup
**Read List**: None — all files are new
**Tasks**:

- [ ] Create `pnpm-workspace.yaml`
- [ ] Create root `package.json` with scripts + devDependencies (turbo, typescript, vitest, eslint, typescript-eslint); include `test:watch` script
- [ ] Create `turbo.json` with build + test + lint tasks
- [ ] Run `pnpm install` — verify zero errors

**Acceptance Criteria**:

- [ ] `pnpm install` exits 0 with no errors
- [ ] `pnpm build` (Turborepo, no source yet) exits 0 (no-op acceptable)
- [ ] `node_modules/.pnpm` lockfile created at root

---

### EP01-ST02: Root tsconfig + ESLint flat config

**Scope**: Shared TypeScript base config and ESLint root config
**Read List**: `package.json` (verify devDeps installed)
**Tasks**:

- [ ] Create `tsconfig.base.json` with strict ESNext settings
- [ ] Create `eslint.config.ts` with TypeScript strict layer for `packages/**`
- [ ] Verify `eslint .` runs without config parse errors (no source files to lint yet — that is OK)

**Acceptance Criteria**:

- [ ] `npx tsc --version` reports 5.7.x
- [ ] `eslint .` exits without config errors (no TS files to lint yet — acceptable)

---

### EP01-ST03: Vitest workspace + srs-engine scaffold

**Scope**: Root Vitest workspace config and `packages/srs-engine/` skeleton
**Read List**: `tsconfig.base.json`, `package.json`
**Tasks**:

- [ ] Create `vitest.workspace.ts`
- [ ] Create `packages/srs-engine/package.json`
- [ ] Create `packages/srs-engine/tsconfig.json` extending `../../tsconfig.base.json`
- [ ] Create `packages/srs-engine/vitest.config.ts` (with `globals: true`, `setupFiles`)
- [ ] Create `packages/srs-engine/__tests__/setup.ts` (fake timer teardown)
- [ ] Create `packages/srs-engine/src/index.ts` (empty export)
- [ ] Create `packages/srs-engine/README.md` with test run instructions
- [ ] Create `packages/srs-engine/__tests__/unit/` and `__tests__/integration/` directories (`.gitkeep`)
- [ ] Run `pnpm test` from root — verify exits 0 with 0 tests

**Acceptance Criteria**:

- [ ] `pnpm install` still exits 0 after adding srs-engine package
- [ ] `pnpm build` compiles srs-engine (`dist/index.js`, `dist/index.d.ts` created)
- [ ] `pnpm test` exits 0 (0 test files, no failures)
- [ ] `eslint packages/srs-engine/src/**` exits 0 (no config errors)

---

## 6. Success Criteria

1. `pnpm install && pnpm build && pnpm test` all exit 0 from repo root
2. No type errors on any source file in `packages/srs-engine/`
3. ESLint reports no config errors on srs-engine source
4. Turborepo task graph correctly resolves build before test
5. `pnpm test:watch` enters watch mode without errors

---

## 7. Deferred Decisions

| Topic                 | Deferred To            | Notes                                                                                                                                                           |
| --------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Env variable strategy | First app/service epic | `srs-engine` is pure logic — no runtime env deps. Pattern (Vite `import.meta.env` vs Node `process.env` + zod validation) decided per package type when needed. |
