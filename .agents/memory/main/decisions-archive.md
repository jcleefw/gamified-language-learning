# Decisions Archive

Decisions rotated out of `recent-decisions.md` (older than 3 days).

---

## 2026-03-03

### iOS Audio Autoplay — Hybrid Strategy

**Decision**: Session-level `AudioContext` unlock + per-question autoplay attempt + visible play button fallback.

### Headless Hono Backend

**Decision**: Hono on Cloudflare Workers as orchestration layer. Nuxt = plug-and-play consumer.
**ADR**: `20260303T195134Z-engineering-headless-hono-backend.md`

### Curation Engine — Prompt-Builder Pattern

**Decision**: Engine builds prompts + parses responses. 100% synchronous and pure. Calling layer handles API.
**ADR**: `20260303T210000Z-engineering-curation-engine-package.md`

### TTS stays as calling-layer service, not a package

**Decision**: TTS is not encapsulated in a package. Calling layer (backend) handles TTS directly.

### Foundational decks out of curation engine

**Decision**: Foundational deck mechanics are separate from the curation engine.

### Package structure conventions → RULES.md

**Decision**: Package structure conventions codified in RULES.md rather than scattered across ADRs.

---

## 2026-03-04

### Automated Memory Pointer via PostToolUse Hook

**Decision**: `PostToolUse` hook fires when `product-documentation/architecture/*.md` is written. Appends pointer to `recent-decisions.md`.
**ADR**: `20260304T120000Z-agentic-memory-hook.md`

### D1 Batch Assembly < 100ms — Deferred to Gate 2

**Decision**: Achievable with proper schema design. Validate P95 at Gate 2. Needs schema ADR first.

### Mid-Quiz Connection Loss — Discard Batch

**Decision**: Discard in-progress batch. No localStorage in v1. Revisit at Gate 2.

### ANKI Parameters — FSRS Defaults + 90-Day Cap

**Decision**: FSRS desired retention 0.90 + 90-day max interval cap. Gate 1 validation: first-review accuracy ≥ 80%, ANKI fallback rate < 5%.

### Word Pool Deck — Sandbox with Soft Signal

**Decision**: No ANKI side effects. Soft signal: 3 wrong all-time → pull `next_review_at` forward, reset counter.

---

## 2026-03-05

### 2026-03-05: EP01-ST03 — Three DS01 Spec Gaps

**Gap 1 — `workspace:*` for npm packages**
DS01 specified `"typescript": "workspace:*"` and `"vitest": "workspace:*"` in `packages/srs-engine/devDependencies`. The `workspace:*` protocol is for internal workspace packages only — pnpm errors if applied to npm registry packages. Fixed with version ranges `"^5.7"` and `"^3"` matching root.

**Gap 2 — tsconfig `include` conflicts with `rootDir`**
DS01 included `"__tests__/**/*"` in tsconfig `include` alongside `rootDir: "src"`. TypeScript TS6059: files outside `rootDir` cannot be compiled. Fixed by removing `__tests__/**/*` from `include`. Vitest handles test file transformation via its own bundler — tsc does not compile tests.

**Gap 3 — Vitest 3.x exits 1 with no tests**
DS01 claimed "Vitest exits 0 on no test files found by default." Vitest 3.x exits 1 without `passWithNoTests: true`. Added to `vitest.config.ts`. All three commands now exit 0: `pnpm install`, `pnpm build`, `pnpm test`.

### 2026-03-05: EP01-ST01 — Turbo 2.x `packageManager` Requirement

**Context**: DS01 spec omitted `packageManager` from root `package.json`. Turbo 2.x fails with `Could not resolve workspaces — Missing packageManager field`.
**Decision**: Add `"packageManager": "pnpm@10.30.1"` to root `package.json`. Pin to installed version.
**Impact**: All future monorepo setups must include this field. DS01 spec has a gap but is frozen — noted here instead.

### 2026-03-05: GAP-05 — Epic Lifecycle Gates

**`Accepted → In Progress`**: Design spec ready, ADRs accepted, schema available (if DB epic), no unresolved upstream dependencies. Agent self-checks before starting.

**`In Progress → Impl-Complete`**: All stories Done, local tests pass, changelog + CODEMAP + memory updated. Human approves transition.

**`Impl-Complete → BDD Pending`**: PRD agent writes BDD scenarios (product owns what). Human confirms before QA agent picks up. QA agent writes test implementation. Two-strike rule applies to QA agent locally.

**`BDD Pending → Completed`**: Agent creates PR only. Human monitors CI, human merges. CI monitoring is out of scope for agents.

### 2026-03-05: GAP-05 — Branching Model

Story branches (`feature/EP##-ST##-slug`) → merged to epic branch (`feature/EP##-slug`) when story Done → epic branch merged to `main` via human-approved PR at Impl-Complete.

### 2026-03-05: GAP-05 — Story Creation Sequence

Rough titles first → Design spec written → Stories fleshed out in full detail → Epic Accepted → agent picks up ST##01.

### 2026-03-05: GAP-05 — Unit Test Protocol

Engines: strict TDD, high coverage (all paths). Backend routes: pragmatic, contract-level. Frontend: pragmatic, happy path. Done gate for all layers: full package suite passes (Option B — catches regressions before story branch merge). BDD deferred to UI stage.

### 2026-03-05: GAP-05 — Commit Discipline

One commit per story at end of REVIEW phase. Implementation + tests together. Format: `feat(EP##-ST##): [what]` with why in body. Types: feat/fix/chore/docs/refactor.

### 2026-03-05: GAP-05 — Story Sizing + Splitting

One layer per story max. Split triggers: layer bleed, multiple independent ACs, >~5 files in PLAN. Agent proposes splits inline (no files created until human approves). Splitting in PLAN phase only — CODE started = no splitting.

### 2026-03-05: GAP-05 — PR Template + Story States

PR must contain: What (story ID + summary), Why (AC closed), Test evidence, Linked artifacts, Checklist (suite pass + CODEMAP + changelog + memory). Story states: no formal states — PLAN/CODE/TEST/REVIEW phases are sufficient.

## ST01: Store design — seedStore pattern (not self-seeding)

**Decision**: `store.ts` starts empty and exposes `seedStore(states, details)`. Caller populates.
**Rejected**: Self-seeding store that reads files at module load (like quiz-runner).
**Reason**: User clarified data is supplied by the server, not owned by the state module. Enables testability and supports multiple data sources (file, Postman, CURL).

## ST01: No cross-package data imports

**Decision**: Server does not import from `packages/srs-engine/data/`. No changes to srs-engine package.
**Reason**: SRS engine should never provide unprocessed data. Server supplies its own data.

## ST01: engine.ts config values

**Decision**: `DEFAULT_SRS_CONFIG` mirrors `scripts/quiz-runner.ts` values exactly (`batchSize: 15`, etc.).
**Reason**: Consistency with existing demo tooling per DS01.