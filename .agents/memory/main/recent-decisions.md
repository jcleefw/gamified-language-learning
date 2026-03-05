# Recent Decisions

**Branch**: main
**Updated**: 2026-03-05
**Rolling window**: Keep last 3 days only. Older decisions archived to `decisions-archive.md`.

## Decision Index (1-liner each)

| Date | Decision | Related |
|------|----------|---------|
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
| 03-04 | Memory pointer via PostToolUse hook on ADR writes | `20260304T120000Z-agentic-memory-hook.md` |
| 03-04 | D1 batch < 100ms — deferred to Gate 2, needs schema ADR | SRS PRD §8.3 |
| 03-04 | Mid-quiz disconnect — discard batch, no localStorage v1 | SRS PRD §10 |
| 03-04 | ANKI params — FSRS 0.90 retention + 90-day max interval | SRS PRD §13 |
| 03-04 | Word pool — sandbox mode, soft signal at 3 wrong | SRS PRD §5.11 |
| 03-03 | Headless Hono backend for orchestration | `20260303T195134Z-engineering-headless-hono-backend.md` |
| 03-03 | Curation engine — prompt-builder + response-parser | `20260303T210000Z-engineering-curation-engine-package.md` |
| 03-03 | TTS stays as calling-layer service, not a package | — |
| 03-03 | Foundational decks out of curation engine | — |
| 03-03 | Package structure conventions → RULES.md | — |

## Recent Details (last 3 days only)

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

### 2026-03-04: Automated Memory Pointer via PostToolUse Hook
**Decision**: `PostToolUse` hook fires when `product-documentation/architecture/*.md` is written. Appends pointer to `recent-decisions.md`.
**Related ADR**: `20260304T120000Z-agentic-memory-hook.md`

### 2026-03-04: D1 Batch Assembly < 100ms — Deferred to Gate 2
**Decision**: Achievable with proper schema design. Validate P95 at Gate 2. Needs schema ADR first.

### 2026-03-04: Mid-Quiz Connection Loss — Discard Batch
**Decision**: Discard in-progress batch. No localStorage in v1. Revisit at Gate 2.

### 2026-03-04: ANKI Parameters — FSRS Defaults + 90-Day Cap
**Decision**: FSRS desired retention 0.90 + 90-day max interval cap. Gate 1 validation: first-review accuracy ≥ 80%, ANKI fallback rate < 5%.

### 2026-03-04: Word Pool Deck — Sandbox with Soft Signal
**Decision**: No ANKI side effects. Soft signal: 3 wrong all-time → pull `next_review_at` forward, reset counter.

### 2026-03-03: iOS Audio Autoplay — Hybrid Strategy
**Decision**: Session-level `AudioContext` unlock + per-question autoplay attempt + visible play button fallback.

### 2026-03-03: Headless Hono Backend
**Decision**: Hono on Cloudflare Workers as orchestration layer. Nuxt = plug-and-play consumer.

### 2026-03-03: Curation Engine — Prompt-Builder Pattern
**Decision**: Engine builds prompts + parses responses. 100% synchronous and pure. Calling layer handles API.

---

## Rotation Policy

- Keep only decisions from the last 3 days in "Recent Details"
- Decision Index keeps 1-liner summaries indefinitely (trim when > 20 rows)
- When trimming: move full details to `decisions-archive.md`
