# WORKFLOW.md

## Naming Conventions

**Timestamp Format**: `YYYYMMDDTHHmmssZ` | **Timezone**: UTC+10

**File Naming**: `[TIMESTAMP]-[PREFIX]-[SLUG].md`

Example: `20260302T143022Z-EP01-user-authentication.md`

| Element | Convention | Example |
|---------|-----------|---------|
| Slug | camelCase (converted to kebab in filenames for readability) | `userAuthFlow` → file: `user-auth-flow` |
| Components | PascalCase | `UserCard.tsx`, `WordQuizBatch.vue` |
| Utilities | camelCase | `formatDate.ts`, `parseWordBreakdown.ts` |
| CSS variables | kebab-case | `--primary-foreground`, `--quiz-bg-dark` |
| Constants | UPPER_SNAKE_CASE | `MAX_ACTIVE_WORDS`, `ANKI_INITIAL_INTERVAL` |
| Database tables | snake_case | `user_sessions`, `word_mastery` |
| Database columns | snake_case | `created_at`, `mastery_count` |

---

## Epic/Story Hierarchy

```
Epic (EP##)
  ├── Phase (EP##-PH##)     ← optional planning grouping; NOT a story container
  ├── Design Spec (DS##)
  ├── UX Spec (UX##)
  ├── Test Plan (TP##)
  ├── Story (ST##)
  ├── Task (TA##)
  ├── Bug (BUG##)
  ├── Chore (CH##)
  ├── Review (RV##)
  └── ADR (ADR##)

Standalone (not attached to epics)
  ├── RFC (RFC##)
  ├── ADR (ADR##)
  ├── AGN (AGN##)
  ├── Task (TA##)
  ├── Bug (BUG##)
  └── Chore (CH##)
```

> **Phase vs Story**: Phase is a planning label grouping related stories within an epic. Stories always belong to the Epic directly — not to a Phase. A Phase has no separate artifact file; it is declared as a section heading inside the Epic plan and Design Spec.

---

## Work Item Definitions

| Type | Prefix | Purpose | Location | Scope |
|------|--------|---------|----------|-------|
| Epic | `EP##` | Group related features (WHY/WHAT) | `.agents/plans/` | 1–4 weeks, 3–7 stories |
| Phase | `EP##-PH##` | Planning grouping within an epic — describes implementation approach and sequencing. Not a story container; stories belong to the Epic directly. Declared as a section in the Epic plan and DS, not a separate file. | Within Epic plan / DS | Multiple stories, one sub-domain |
| Story | `EP##-ST##` | One testable unit of work | `changelogs/EP##--slug/` | 1–3 days, one layer |
| Design Spec | `EP##-DS##` | Technical HOW (data, APIs, algorithms) | `changelogs/EP##--slug/` | 1–3 stories |
| UX Spec | `EP##-UX##` | Interaction design, wireframes | `changelogs/EP##--slug/` | One feature |
| Test Plan | `EP##-TP##` | Test strategy + acceptance criteria | `changelogs/EP##--slug/` | One story/feature |
| Task | `TA##` / `EP##-TA##` | Generic work (refactor, docs, infra) | `changelogs/standalone/` or epic | 1–2 days |
| Bug | `BUG##` / `EP##-BUG##` | Defect report + fix | `changelogs/standalone/` or epic | Varies |
| Chore | `CH##` / `EP##-CH##` | Maintenance, cleanup | `changelogs/standalone/` or epic | 1–2 days |
| RFC | `RFC##` | Proposal BEFORE a decision | `.agents/plans/rfcs/` | — |
| ADR | `ADR##` | Decision record AFTER decision | `.agents/plans/adrs/` or epic | — |
| AGN | `AGN##` | Agentic governance improvements | `changelogs/agentic/` | — |
| Review | `EP##-RV##` | Code/design review | `changelogs/EP##--slug/` | — |

> All `changelogs/` paths are under `.agents/changelogs/`.

---

## Epic Lifecycle (Two-Stage Model)

```
Draft → Accepted → In Progress → Impl-Complete → BDD Pending → Completed / Shelved / Withdrawn
                                  ↑ FREEZE POINT
```

**Stage 1: Implementation**
- All stories, design specs, tasks, and chores are completed
- Code is merged and ready for testing
- Scope is FROZEN — no new requirements

**Stage 2: BDD (Behavior-Driven Development)**
- Write BDD tests against acceptance criteria
- Verify all stories meet acceptance criteria
- Bugs found → create standalone `BUG##` (do not modify epic scope)
- Once all tests pass → Completed

**Lifecycle States**:
- **Draft**: Being planned
- **Accepted**: Approved by product; ready to start
- **In Progress**: Implementation underway
- **Impl-Complete**: All stories implemented, code merged, ready for BDD
- **BDD Pending**: BDD tests running, verification in progress
- **Completed**: All acceptance criteria verified, in production
- **Shelved**: Paused, may resume later
- **Withdrawn**: Cancelled, will not proceed

---

## Epic Lifecycle Gates

| Transition | Entry Criteria | Validator |
|---|---|---|
| `Accepted → In Progress` | Design spec ready, ADRs accepted, schema available (if DB epic), all upstream deps are `Impl-Complete`. Multiple parallel epics (same `Depends on`) may enter `In Progress` simultaneously. | Agent self-check |
| `In Progress → Impl-Complete` | All stories Done, local tests pass, changelog + CODEMAP + memory updated | Human approves |
| `Impl-Complete → BDD Pending` | PRD agent writes BDD scenarios, human confirms before QA picks up | Human confirms |
| `BDD Pending → Completed` | Agent creates PR; human monitors CI, merges when green | Human |

---

## Branching Model

```
main → feature/EP##-slug → feature/EP##-ST##-slug
```

Story branch merges to epic branch when Done. Epic branch merges to main via human-approved PR at Impl-Complete.

### Parallel Epics

When multiple epics share a dependency and can run concurrently, each branches independently from `main` after the shared dependency is merged:

```
main (EP02 merged)
  ├── feature/EP03-batch-composition
  ├── feature/EP04-active-window
  └── feature/EP05-foundational-deck
```

- Each parallel epic produces its own PR and merges to `main` independently
- The downstream epic (e.g., EP06 orchestrator) may only start after all parallel epic branches are merged
- Parallel epics must not import from each other's feature branches

---

## Story Creation Sequence

Titles → Design spec → Stories detailed → Epic Accepted → agent picks up ST##01.

---

## BDD Protocol

- PRD agent: writes scenarios (owns **what**). QA agent: writes test impl (owns **how**).
- Two-strike rule applies during QA local test build.
- CI monitoring out of scope for agents — agents create PR only; human merges.

---

## Story Sizing

- One layer per story max. Cross-layer = split before CODE.
- Split triggers: layer bleed, multiple independent ACs, >~5 files found in PLAN.
- Agent proposes split inline, waits for approval — no files created until approved.
- PLAN phase only. CODE started = no splitting.

---

## PR Template

```
## What
[Story ID + one-line summary]

## Why
[Acceptance criteria this closes]

## Test evidence
[Test command + pass/fail summary]

## Linked artifacts
[Story file, Design spec, ADR(s)]

## Checklist
- [ ] Full package suite passes
- [ ] CODEMAP updated
- [ ] Changelog entry written
- [ ] Memory updated
```

---

## Work Item Numbering

### Sequential Numbering (Per Type)
- **EP##**: `EP01`, `EP02`, `EP03`, ... (continues forever)
- **RFC##**: `RFC01`, `RFC02`, ... (continues forever)
- **ADR##**: `ADR01`, `ADR02`, ... (continues forever)
- **AGN##**: `AGN01`, `AGN02`, ... (continues forever)
- **Standalone TA/BUG/CH**: `TA01`, `BUG01`, `CH01`, ...

### Nested Numbering (Per Epic)
- **PH##**: `EP01-PH01`, `EP01-PH02`, ... (per epic — planning label only, no file)
- **DS##**: `EP01-DS01`, `EP01-DS02`, ... (per epic)
- **UX##**: `EP01-UX01`, `EP01-UX02`, ... (per epic)
- **TP##**: `EP01-TP01`, `EP01-TP02`, ... (per epic)
- **ST##**: `EP01-ST01`, `EP01-ST02`, `EP01-ST03`, ... (per epic)
- **Epic-scoped TA/BUG/CH**: `EP01-TA01`, `EP01-BUG01`, `EP01-CH01`, ...
- **RV##**: `EP01-RV01`, `EP01-RV02`, ... (per epic)
- **ADR in epic**: `EP01-ADR01` (rare, usually standalone)

---

## Story Completion Protocol

See **RULES.md §Story Completion Protocol** for the full checklist.

---

## Changelog Directory

Files go in `.agents/changelogs/{EP##--slug|standalone|agentic}/` named `{TIMESTAMP}-{PREFIX}-{slug}.md`.

