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

---

## Work Item Definitions

| Type | Prefix | Purpose | Location | Scope |
|------|--------|---------|----------|-------|
| Epic | `EP##` | Group related features (WHY/WHAT) | `.agents/plans/` | 1–4 weeks, 3–7 stories |
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

## Work Item Numbering

### Sequential Numbering (Per Type)
- **EP##**: `EP01`, `EP02`, `EP03`, ... (continues forever)
- **RFC##**: `RFC01`, `RFC02`, ... (continues forever)
- **ADR##**: `ADR01`, `ADR02`, ... (continues forever)
- **AGN##**: `AGN01`, `AGN02`, ... (continues forever)
- **Standalone TA/BUG/CH**: `TA01`, `BUG01`, `CH01`, ...

### Nested Numbering (Per Epic)
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

