# Recent Decisions

**Branch**: main
**Updated**: 20260306T140000Z
**Rolling window**: Keep last 3 days only. Older decisions archived to `decisions-archive.md`.

## Decision Index (1-liner each)

| Date | Decision | Related |
|------|----------|---------|
| 03-09 | All exported and non-trivial private functions require a docstring — plain English, max 80 chars/line | code-review SKILL |
| 03-07 | EP05: `batchesSinceLastProgress` is caller-managed — not set by `updateMastery`; calling layer increments/resets after each batch | EP05-ST02 |
| 03-07 | EP05: Active window marker = `srsM2_review` phase; no extra `isActive` flag on `WordState` | EP05-ST01 |
| 03-07 | EP05: Stuck word cap — newest stuck word shelved when cap reached; 3rd+ words simply wait (no displacement) | EP05 Design |
| 03-07 | EP05: `pnpm build` required after adding new source files before `tsx` scripts can resolve them from `dist/` | EP05-ST03 |
| 03-07 | EP04: `composeBatch` always returns deterministic priority order; shuffling questions for display is the caller's responsibility (UI/API layer) | EP04-DS01 |
| 03-06 | Parallel epics via git worktrees — one worktree per epic, one Claude session per worktree | EP04/05/06 parallel dev |
| 03-06 | Worktree agents: STOP at `gh pr create` — FORBIDDEN to checkout main, merge, or gh pr merge | WORKTREE.md |
| 03-06 | Memory for feature branch agents goes to `.agents/memory/feature/{branch}/` NOT `main/` | WORKTREE.md |
| 03-06 | No story-level branches in worktrees — all stories commit to single epic feature branch | code-change-workflow |
| 03-06 | Project memory unified to `.agents/memory/` — skill-patterns moved out of Claude auto-memory | MEMORY.md cleanup |
| 03-06 | EP02-ST05: demo script converted to integration test — `__tests__/integration/srs-lifecycle.test.ts` owns CI correctness; demo kept for human-readable output | EP02-ST05 |
| 03-06 | EP02-ST05: FSRS interval growth requires backdating `lastReview` by `scheduledDays` between calls — `scheduleReview` always passes `new Date()` so elapsed time must be simulated | EP02-ST05 |
| 03-06 | EP02-ST05: root `package.json` needs `"type": "module"` for tsx to resolve ESM-only `@gll/srs-engine` exports | EP02-ST05 |
| 03-06 | EP02-ST04: `enable_short_term: false` required in ts-fsrs — default mode schedules new cards in minutes, not days | EP02-ST04 |
| 03-06 | EP02: Unit tests live in `src/**/__tests__/` (co-located), not top-level `__tests__/unit/` — vitest include updated | EP02 review |
| 03-05 | EP01-ST03: DS01 spec `workspace:*` for npm deps (typescript, vitest) is invalid — use version ranges | EP01-ST03 implementation |
| 03-05 | EP01-ST03: tsconfig `include: __tests__/**/*` conflicts with `rootDir: src` — removed __tests__ from include | EP01-ST03 implementation |
| 03-05 | EP01-ST03: Vitest 3.x exits 1 with no test files — added `passWithNoTests: true` to vitest.config.ts | EP01-ST03 implementation |
| 03-05 | EP01-ST02: ESLint 9.x requires `jiti` to load `eslint.config.ts` — added as root devDependency | EP01-ST02 implementation |
| 03-05 | EP01-ST01: Turbo 2.x requires `packageManager` field in root `package.json` — added `pnpm@10.30.1` | EP01-ST01 implementation |
| 03-05 | GAP-01: API surface ADR accepted — flat namespace, wrapped envelope, Bearer JWT, api-contract package | `20260305T200000Z-engineering-api-surface.md` |
| 03-05 | GAP-04: Curation engine ADR accepted; shared types resolved inline | `20260303T210000Z-engineering-curation-engine-package.md` |
| 03-05 | GAP-05: Epic entry criteria defined for all 4 lifecycle transitions | GAP-05 discussion |
| 03-05 | GAP-05: Branching = story branches → epic branch → main (human PR at Impl-Complete) | GAP-05 discussion |
| 03-05 | GAP-05: BDD ownership — PRD agent writes scenarios, QA agent implements | GAP-05 discussion |
| 03-05 | GAP-05: CI monitoring out of scope for agents; agents create PR only | GAP-05 discussion |
| 03-05 | GAP-05: Story creation sequence — titles → design spec → full detail → Accepted | GAP-05 discussion |
| 03-05 | GAP-05 resolved: full agentic dev workflow defined | GAP-05 discussion |
| 03-05 | GAP-05: Unit tests — strict TDD for engines, pragmatic for backend/UI, full package suite (B) for all | GAP-05 discussion |
| 03-05 | GAP-05: Commit = one per story, impl+tests together, conventional commits with story scope | GAP-05 discussion |
| 03-05 | GAP-05: Story sizing — one layer max, agent proposes splits inline, PLAN phase only | GAP-05 discussion |
| 03-05 | GAP-05: PR template — What/Why/Test evidence/Linked artifacts/Checklist | GAP-05 discussion |
| 03-05 | GAP-05: Story states — no formal states, PLAN/CODE/TEST/REVIEW phases sufficient | GAP-05 discussion |
| 03-05 | GAP-05: Two-strike rule applies to QA agent locally, not to CI | GAP-05 discussion |
| 03-05 | GAP-03 resolved: 10-stage build sequence accepted | `20260305T142801Z-stage1-build-sequence.md` |
| 03-05 | Stage 1 = terminal proof (no infra, no HTTP, no DB) | roadmap slice |
| 03-05 | Hono before DB — prove API layer with in-memory state first | roadmap slice |
| 03-05 | DB persistence tech-agnostic: local SQLite first, D1 is deployment | roadmap slice |
| 03-05 | 1 feature per stage, learning loop proven before content pipeline | roadmap slice |
| 03-04 | Memory pointer, D1 batch, mid-quiz, ANKI params, word pool decisions | archived → decisions-archive.md |
| 03-03 | Hono backend, curation engine, TTS, foundational deck, package structure decisions | archived → decisions-archive.md |

## Recent Details (last 3 days only)

### 2026-03-06: Parallel Epic Development via Git Worktrees

**Context**: EP04, EP05, EP06 can run concurrently. Needed a way to isolate each epic so agents don't collide on files or git history.

**Decision**: One git worktree per epic (`git worktree add .worktrees/ep0X -b feature/EP0X-slug`), one Claude session per worktree. Human coordinates from the main project dir on `main`.

**Worktree rules** (captured in WORKTREE.md, AGENT.md, RULES.md, code-change-workflow.md):
- Agent reads `WORKTREE.md` at session start if `git worktree list` shows >1 entry
- No new branch creation inside a worktree — already on the right epic branch
- No story-level branches — all stories commit to the single epic feature branch
- Memory writes go to `.agents/memory/feature/{branch}/` (NOT `main/`)
- Job ends at `gh pr create` — FORBIDDEN: `git checkout main`, `git merge`, `gh pr merge`

**What went wrong before this decision**:
- Agents created new branches in the main project dir instead of using the worktree
- Agents wrote memory to `main/` folder instead of their feature branch folder
- Agents merged directly to main instead of opening PRs
- RULES.md said "code merged" in the completion checklist — agents interpreted this as a self-merge instruction

**Files updated**: WORKTREE.md (new), AGENT.md, RULES.md, code-change-workflow.md

### 2026-03-06: Memory Unified to `.agents/memory/`

**Decision**: All project memory goes to `.agents/memory/{branch}/`. Claude auto-memory (`~/.claude/`) stripped of project content — now holds only cross-project user working preferences. `skill-patterns.md` moved to `.agents/memory/main/skill-patterns.md`.

### 2026-03-06: EP02 — Unit Test Location Convention Correction

**Context**: EP02-ST02 placed `mastery.test.ts` in `packages/srs-engine/__tests__/unit/` — a top-level directory. RULES.md §Package Structure specifies unit tests are co-located per domain, in `__tests__/` subdirectories next to source.
**Decision**: Moved to `src/__tests__/mastery.test.ts`. Future unit tests follow same pattern (e.g., `src/scheduling/__tests__/FsrsScheduler.test.ts`). Integration tests remain at package-root `__tests__/integration/`.
**vitest.config.ts**: Updated `include` from `__tests__/**/*.test.ts` to `['src/**/__tests__/**/*.test.ts', '__tests__/integration/**/*.test.ts']`.

---

## Rotation Policy

- Keep only decisions from the last 3 days in "Recent Details"
- Decision Index keeps 1-liner summaries indefinitely (trim when > 20 rows)
- When trimming: move full details to `decisions-archive.md`
