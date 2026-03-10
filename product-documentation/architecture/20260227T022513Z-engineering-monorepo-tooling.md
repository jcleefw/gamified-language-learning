# ADR: Monorepo Structure and Engineering Tooling

**Status:** Accepted

**Date:** 2026-02-27

**Deciders:** Solo founder

---

## Context

The gamified language learning app requires a monorepo that houses a Nuxt frontend, a backend service, a shared design system, BDD tests, and a shared logger. Key constraints established prior to this ADR:

- Package manager: pnpm (decided)
- Frontend: Vue 3 + Nuxt + PandaCSS + Ark UI (decided)
- Development workflow: git worktree strategy for parallel branch development
- Agentic infrastructure (skills, workflows, sessions) lives in the same repo and requires its own commit classification

The engineering tooling must support isolated BDD test execution, multi-worktree development without port collisions, consistent code quality without blocking commits, and agentic agent compliance through enforced conventions.

---

## Decision

### Repo Structure

```
/
├── apps/
│   └── web/                    # Nuxt app (Vue 3, PandaCSS, Ark UI)
├── packages/
│   ├── backend/                # Backend service
│   ├── design-system/          # PandaCSS tokens, Ark UI primitives, Histoire
│   ├── bdd/                    # Feature-level BDD tests
│   └── logger/                 # Shared Consola logger wrapper
├── .agents/                    # Agentic infrastructure (skills, workflows)
├── product-documentation/      # ADRs, PRDs
├── sessions/                   # Session state files
├── eslint.config.ts            # Single root ESLint config (flat config)
├── prettier.config.ts          # Shared Prettier config
├── turbo.json                  # Turborepo pipeline definitions
├── pnpm-workspace.yaml         # Workspace package declarations
├── .env.example                # Port offset documentation and defaults
└── WORKTREES.md                # Worktree port offset assignment table
```

### Build Orchestration

**pnpm workspaces + Turborepo.**

pnpm manages the workspace protocol and dependency resolution. Turborepo defines the build pipeline with explicit package dependency ordering and output caching. This means a change to `packages/design-system` triggers only dependent package rebuilds, not a full suite rebuild.

### Port Strategy

Two port ranges, separated by design:

| Context | Service            | Base Port | Formula              |
| ------- | ------------------ | --------- | -------------------- |
| Dev     | `apps/web`         | 3000      | `3000 + PORT_OFFSET` |
| Dev     | `packages/backend` | 3001      | `3001 + PORT_OFFSET` |
| BDD     | `apps/web`         | 4800      | `4800 + PORT_OFFSET` |
| BDD     | `packages/backend` | 4801      | `4801 + PORT_OFFSET` |

`PORT_OFFSET` is set in `.env.local` (gitignored) per worktree. `3xxx` = dev at a glance, `4xxx` = BDD at a glance in process lists and browser tabs.

**Worktree offset assignments (documented in `WORKTREES.md` and `.env.example`):**

| Worktree  | Offset | Dev web | Dev api | BDD web | BDD api |
| --------- | ------ | ------- | ------- | ------- | ------- |
| main      | 0      | 3000    | 3001    | 4800    | 4801    |
| feature-a | 20     | 3020    | 3021    | 4820    | 4821    |
| feature-b | 40     | 3040    | 3041    | 4840    | 4841    |
| feature-c | 60     | 3060    | 3061    | 4860    | 4861    |

Maximum offset: 99 (beyond that, dev ports enter 41xx and collide with BDD range).

### Shared Tooling

**Prettier** — single `prettier.config.ts` at root. Config:

```ts
export default {
  arrowParens: 'always',
  bracketSpacing: true,
  bracketSameLine: false,
  printWidth: 80,
  quoteProps: 'as-needed',
  singleQuote: true,
  trailingComma: 'all',
  tabWidth: 2,
  useTabs: false,
};
```

Applies to all file types in the repo. Editor settings (`.vscode/settings.json`) configure format-on-save for all relevant extensions.

**ESLint** — single root `eslint.config.ts` (ESLint v9 flat config). Glob-scoped layers applied in order:

| Layer                    | Scope                                                         | Rules                                              |
| ------------------------ | ------------------------------------------------------------- | -------------------------------------------------- |
| `[1]` Ignored paths      | —                                                             | `node_modules`, `dist`, `.nuxt`, `styled-system/`  |
| `[2]` Base               | `**/*.{ts,vue,js}`                                            | `unicorn`, `sonarjs`, `import-x`                   |
| `[3]` TypeScript strict  | `apps/**`, `packages/backend/**`, `packages/design-system/**` | `@typescript-eslint` strict                        |
| `[4]` Vue                | `apps/web/**/*.vue`                                           | `eslint-plugin-vue`, `vuejs-accessibility`         |
| `[5]` Node.js            | `packages/backend/**`                                         | `eslint-plugin-n`                                  |
| `[6]` TypeScript relaxed | `packages/bdd/**`, `packages/logger/**`                       | `@typescript-eslint` recommended (overrides `[3]`) |
| `[7]` Tests              | `**/*.test.ts`, `**/*.spec.ts`                                | Minor overrides (e.g. allow non-null assertions)   |

ESLint plugins included:

- `@typescript-eslint` — TypeScript rules
- `eslint-plugin-vue` — Vue 3 SFC rules
- `eslint-plugin-import-x` — import ordering, no unused imports
- `eslint-plugin-unicorn` — modern JS patterns
- `eslint-plugin-sonarjs` — cognitive complexity, duplicate detection, bug-prone patterns
- `eslint-plugin-vuejs-accessibility` — a11y for Vue components
- `eslint-plugin-n` — Node.js best practices (backend layer only)

**TypeScript** — shared `tsconfig.base.json` at root. Per-package `tsconfig.json` extends the base.

| Package                  | Strictness                 |
| ------------------------ | -------------------------- |
| `apps/web`               | strict                     |
| `packages/backend`       | strict                     |
| `packages/design-system` | strict                     |
| Unit tests (`*.test.ts`) | strict (revisit if needed) |
| `packages/bdd`           | relaxed                    |
| `packages/logger`        | relaxed                    |

### Code Quality Gates

| Gate       | What runs                                                    | When         | Blocks?                       |
| ---------- | ------------------------------------------------------------ | ------------ | ----------------------------- |
| Pre-commit | Prettier `--write` on staged files (via Husky + lint-staged) | Every commit | Yes — reformats and re-stages |
| CI         | ESLint (read-only), TypeScript type-check                    | Every PR     | Yes — fails build             |

ESLint **never** runs auto-fix in CI. This eliminates the conflict between local auto-fix results and CI check results. Prettier runs pre-commit only; CI checks that output is already formatted.

### Commit Standards

**Conventional Commits** enforced on CI via commitlint.

Commit types permitted:

| Type       | Use                                                                              |
| ---------- | -------------------------------------------------------------------------------- |
| `feat`     | New feature                                                                      |
| `fix`      | Bug fix                                                                          |
| `chore`    | Maintenance, dependency updates                                                  |
| `docs`     | Documentation changes                                                            |
| `refactor` | Code restructuring without behaviour change                                      |
| `test`     | Test additions or changes                                                        |
| `perf`     | Performance improvements                                                         |
| `ci`       | CI/CD pipeline changes                                                           |
| `build`    | Build system changes                                                             |
| `agentic`  | Skills, workflows, session files, and any markdown that improves agentic tooling |

The `agentic:` type covers all changes under `.agents/`, `sessions/`, and agentic documentation in `product-documentation/`. It distinguishes AI infrastructure work from product code in the commit history.

No Husky for commit message validation — CI only.

### Shared Logger

`packages/logger` wraps **Consola**. Consola is Nuxt's own logger: already a transitive dependency of `apps/web`, works in both browser and Node.js, supports structured JSON in production via reporters, and pretty output in development.

All packages import from `packages/logger` — no direct Consola or `console.log` calls in `apps/web` or `packages/backend`.

---

## Rationale

**Turborepo over pnpm workspaces alone:** `apps/web` depends on `packages/design-system`. Without Turborepo, any design-system change forces a full rebuild of all packages. Turborepo's output caching and dependency graph make builds incremental and the pipeline explicit.

**Single root ESLint flat config:** At this package count, per-package `eslint.config.ts` files create duplication and drift. Flat config's glob-scoped layers handle all per-package variation in one file with no repetition.

**Prettier pre-commit, ESLint CI-only:** ESLint auto-fix and manual code differ in subtle ways that create friction (conflicting fixers, unexpected diffs). Keeping ESLint read-only on CI eliminates this class of problem entirely. Prettier-only pre-commit is safe — it never changes logic.

**Port offset strategy:** Worktrees need deterministic, human-readable port assignments. A `PORT_OFFSET` env var per worktree combined with a documented assignment table requires no tooling and survives process restarts, shell sessions, and team handoffs. `3xxx`/`4xxx` separation makes dev vs. BDD instantly identifiable.

**`agentic:` commit type:** Agentic infrastructure (skills, session state, workflow definitions) changes at a different cadence than product code and is owned by a different concern. Tagging it separately enables filtering in changelog generation and signals intent clearly in PR history.

**Consola over alternatives:** Pino is excluded by preference. Winston is excluded by preference. tslog and bunyan both require separate browser/Node configurations — a shared `packages/logger` would need conditional imports. Consola is already present as a Nuxt transitive dependency and has native isomorphic support.

---

## Alternatives Considered

| Option                              | Pros                                            | Cons                                                                                           | Why Not Chosen                                                                             |
| ----------------------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| pnpm workspaces only (no Turborepo) | Simpler setup                                   | No incremental builds, no pipeline caching, no explicit dependency ordering                    | Design-system changes trigger full rebuilds; pipeline ordering is implicit and error-prone |
| Per-package ESLint configs          | Isolated, self-contained                        | Duplication, config drift across packages                                                      | Single flat config with glob layers handles all variation without repetition               |
| Husky with commitlint pre-commit    | Catches bad commits locally                     | Husky identified as a blocker; commitlint pre-commit can be bypassed with `--no-verify` anyway | CI enforcement is sufficient and less disruptive                                           |
| Nx instead of Turborepo             | More features (code generation, affected graph) | Significantly heavier, opinionated project structure, steeper learning curve                   | Overkill for this package count                                                            |
| Pino (shared logger)                | Extremely fast, structured JSON                 | User preference against; not isomorphic without config                                         | Excluded by preference                                                                     |
| Winston                             | Mature, flexible                                | User preference against                                                                        | Excluded by preference                                                                     |

---

## Consequences

**Positive:**

- Incremental builds via Turborepo — design-system changes don't rebuild the world
- Single ESLint config — one place to update rules, no drift
- Port strategy survives multi-worktree + BDD simultaneously without collision
- `agentic:` type keeps AI infrastructure visible in commit history
- Shared logger enforces consistent log format across browser and server

**Negative / Risks:**

- Turborepo `turbo.json` pipeline must be maintained as packages are added — missing a dependency in the pipeline causes incorrect build ordering
- `PORT_OFFSET` convention relies on developers setting `.env.local` correctly — no automated enforcement
- Flat ESLint config ordering is load-bearing — a misconfigured layer order silently applies wrong rules to a package

**Neutral:**

- No Storybook — Histoire confirmed separately in the FE toolchain ADR
- No monorepo-wide test runner defined here — test strategy scoped to QA ADR

---

## Open Questions

| Question                                                                             | Owner         | Target                                                                                                                                                                              |
| ------------------------------------------------------------------------------------ | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ~~Should `packages/shared-types` be added for cross-package TypeScript interfaces?~~ | ~~Architect~~ | **Resolved**: No. Each engine defines and exports its own types. Calling layer maps between packages. See SRS engine ADR §Types Ownership and curation engine ADR §Types Ownership. |
| Remote caching for Turborepo (Vercel Remote Cache) — worth enabling for CI speed?    | Architect     | After first CI pipeline is running                                                                                                                                                  |
| Maximum worktree count before offset table needs revision                            | Dev           | When offset 60 is first used                                                                                                                                                        |

---

_Related ADRs:_

- [20260227T000000Z-fe-pwa-platform-strategy.md](20260227T000000Z-fe-pwa-platform-strategy.md)
- [20260226T133833Z-fe-framework-toolchain.md](20260226T133833Z-fe-framework-toolchain.md)
