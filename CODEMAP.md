# CODEMAP.md

Project navigation index. Use this to orient before reading files.

**Update this file whenever**: files are added, renamed, moved, or their purpose changes.

---

## Root Directory

| File          | Purpose                                               |
| ------------- | ----------------------------------------------------- |
| `AGENT.md`    | AI agent persona, tech stack, bootstrap reading order |
| `RULES.md`    | Mandatory behaviors, code standards, testing protocol |
| `WORKFLOW.md` | Work item naming, hierarchy, lifecycle                |
| `PLAYBOOK.md` | Quick command reference                               |
| `CONTEXT.md`  | Architecture, domain model, key patterns              |
| `SETUP.md`    | Development environment setup                         |
| `CODEMAP.md`  | This file — navigation index                          |
| `README.md`   | Project overview for humans                           |
| `THOUGHTS.md` | Freeform product notes                                |

---

## `.agents/` — AI Governance

| Path                                  | Purpose                                                                          |
| ------------------------------------- | -------------------------------------------------------------------------------- |
| `.agents/workflows/`                  | How to do things (create epic, create changelog, etc.)                           |
| `.agents/skills/`                     | Specialized AI personas (architect, dev, product, BA, QA)                        |
| `.agents/plans/`                      | Epic plans, RFCs, ADRs (permanent home)                                          |
| `.agents/plans/templates/`            | Reusable document templates for all work item types                              |
| `.agents/changelogs/`                 | Implementation records (created during development)                              |
| `.agents/memory/`                     | Cross-session context; one folder per branch                                     |
| `.agents/memory/main/`                | Memory for main branch                                                           |
| `.agents/tools/`                      | Executable scripts                                                               |
| `.agents/tools/memory-consolidate.sh` | Consolidate branch memory into main on merge                                     |
| `.agents/guardrails.yml`              | Platform-agnostic safety checks                                                  |
| `.agents/integrations.yml`            | External tool integrations (MCP servers, APIs)                                   |
| `.agents/reference/`                  | Platform-specific docs (e.g., `claude-code-playbook.md`). Not read at bootstrap. |

> Skills and workflows are auto-listed by the platform. See `.agents/skills/` and `.agents/workflows/` if needed.

---

## `product-documentation/` — Product Artifacts

| Path               | Purpose                                          |
| ------------------ | ------------------------------------------------ |
| `PRODUCT-BRIEF.md` | Full product vision, system overview, tech stack |
| `prds/`            | Product requirement documents                    |
| `architecture/`    | Architecture decision records (ADRs)             |
| `cost-models/`     | Cost analysis documents                          |

### PRDs

| File                                        | Feature                          |
| ------------------------------------------- | -------------------------------- |
| `20260226T150000Z-user-management-auth.md`  | Auth, roles, sessions            |
| `20260226T140000Z-content-curation.md`      | Curator workflow, AI generation  |
| `20260226T100000Z-srs-learning-path.md`     | Quiz, mastery, ANKI algorithm    |
| `20260302T000000Z-gemini-tts-generation.md` | Audio pipeline, quota management |

### Architecture Decisions

| File                                                      | Decision                            |
| --------------------------------------------------------- | ----------------------------------- |
| `20260226T133833Z-fe-framework-toolchain.md`              | Vue 3 + Nuxt + PandaCSS             |
| `20260227T000000Z-fe-pwa-platform-strategy.md`            | PWA delivery strategy               |
| `20260227T022513Z-engineering-monorepo-tooling.md`        | Monorepo tooling                    |
| `20260301T161844Z-infra-cloudflare-platform.md`           | Cloudflare Workers + D1 + R2        |
| `20260302T160536Z-engineering-srs-engine-package.md`      | SRS engine as separate package      |
| `20260303T195134Z-engineering-headless-hono-backend.md`   | Headless Hono backend strategy      |
| `20260303T210000Z-engineering-curation-engine-package.md` | Curation engine as separate package |

---

## `docs/` — Human + Agent Reference

| File                         | Purpose                                                                                           |
| ---------------------------- | ------------------------------------------------------------------------------------------------- |
| `code-standards-examples.md` | GOOD/BAD code examples for RULES.md code standards. Not mandatory agent reading — reference only. |

---

## `.github/` — CI/CD (EP10)

| Path                       | Purpose                                                               |
| -------------------------- | --------------------------------------------------------------------- |
| `.github/workflows/ci.yml` | GitHub Actions CI — runs lint, typecheck, test on push and PR to main |

---

## Monorepo Root Config (EP01)

| File                     | Purpose                                                                                                                                                        |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `package.json`           | Root package — scripts (`build`, `test`, `test:watch`, `lint`, `typecheck`) + devDependencies                                                                  |
| `pnpm-workspace.yaml`    | Declares `packages/*` and `apps/*` as workspace members                                                                                                        |
| `turbo.json`             | Turborepo task graph — build, test, lint, typecheck pipelines                                                                                                  |
| `scripts/demo-srs.ts`    | Demo — exercises `updateMastery`, `FsrsScheduler`, and `composeBatch` end-to-end (Scenarios A–F); run via `pnpm demo`                                          |
| `scripts/quiz-runner.ts` | Terminal quiz runner — interactive stdin quiz loop using `SrsEngine` with real seed data (5 foundational consonants + conversation words); run via `pnpm quiz` |
| `pnpm-lock.yaml`         | Lockfile (auto-generated by pnpm)                                                                                                                              |
| `tsconfig.base.json`     | Shared TypeScript base config — all packages extend this                                                                                                       |
| `eslint.config.ts`       | ESLint 9.x flat config — strict TS rules scoped to `packages/**`                                                                                               |
| `vitest.workspace.ts`    | Root Vitest workspace — discovers `packages/*/vitest.config.ts`                                                                                                |

---

## `packages/` — Internal Packages

Each package owns its own CODEMAP. Navigate there for file-level detail.

| Package                | Purpose                                                                               |
| ---------------------- | ------------------------------------------------------------------------------------- |
| `packages/srs-engine/`    | `@gll/srs-engine` — SRS scheduling engine → [CODEMAP](packages/srs-engine/CODEMAP.md)       |
| `packages/srs-engine-v2/` | `@gll/srs-engine-v2` — Interactive SRS quiz engine (Thai, CLI runner) → [CODEMAP](packages/srs-engine-v2/CODEMAP.md) |
| `packages/api-contract/`  | `@gll/api-contract` — Shared HTTP wire-format types (no runtime deps) → [CODEMAP](packages/api-contract/CODEMAP.md) |

---

## `src/` — Application Source (TBD)

> Not yet created. Will be populated in CODEMAP when implementation begins.

---

## Update Instructions

**Root CODEMAP**: Update only when root-level files, `.agents/` structure, `product-documentation/`, or packages change.
**Package/folder detail**: Update the folder-level `CODEMAP.md` (e.g. `packages/srs-engine/CODEMAP.md`) — not this file.
**Every non-`__tests__` folder** owns its own `CODEMAP.md`. When adding a new package or subfolder, create its CODEMAP.

Do NOT let any CODEMAP drift from actual structure.
