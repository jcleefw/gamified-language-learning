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

### Epic (EP##)
**Purpose**: Group related features. Business-focused (WHY/WHAT, not HOW).
**Location**: `.agents/plans/`
**Scope**: 1–4 weeks of work, 3–7 stories
**Lifecycle**: Draft → Accepted → In Progress → Impl-Complete (FREEZE) → BDD Pending → Completed / Shelved / Withdrawn
**Epic Freeze Rule**: No new requirements after `impl-complete`. BDD work is verification only.

---

### Story (ST##)
**Purpose**: One independently testable unit of work.
**Location**: `.agents/changelogs/EP##--slug/`
**Scope**: 1–3 days, one layer (backend OR frontend OR data model)
**Acceptance Criteria**: Testable conditions; if a story is hard to test, it's too big.
**Read List**: Required. Lists files the agent should read to implement this story.

---

### Design Spec (DS##)
**Purpose**: Technical HOW — data structures, APIs, algorithms, architecture.
**Location**: `.agents/changelogs/EP##--slug/`
**Scope**: Detailed specification for 1–3 stories
**Replaces**: Detailed in-code comments; DSs are the source of truth
**Templates**: Include data models, API endpoints, algorithm pseudocode, example flows.

---

### UX Spec (UX##)
**Purpose**: User interaction design, wireframes, state diagrams.
**Location**: `.agents/changelogs/EP##--slug/`
**Scope**: Visual/interaction design for one feature
**Includes**: Wireframes (ASCII art), user flows, edge case handling, mobile breakpoints.

---

### Test Plan (TP##)
**Purpose**: Test strategy + acceptance criteria.
**Location**: `.agents/changelogs/EP##--slug/`
**Scope**: All test scenarios for one story or small feature
**Includes**: Unit test cases, integration scenarios, edge cases, manual test steps.

---

### Task (TA##)
**Purpose**: Generic work unit (refactoring, documentation, infrastructure).
**Location**: `.agents/changelogs/EP##--slug/` (if epic-scoped) or `.agents/changelogs/standalone/` (if standalone)
**Scope**: 1–2 days
**Use when**: Not a story (code feature), bug, chore, or governance improvement.

---

### Bug (BUG##)
**Purpose**: Defect report + fix.
**Location**: `.agents/changelogs/EP##--slug/` (if found during epic) or `.agents/changelogs/standalone/` (if standalone)
**Scope**: Varies
**Found during BDD**: Create standalone `BUG##` (epic freeze rule applies).

---

### Chore (CH##)
**Purpose**: Maintenance, cleanup, non-feature work.
**Location**: `.agents/changelogs/EP##--slug/` (if epic-scoped) or `.agents/changelogs/standalone/` (if standalone)
**Scope**: 1–2 days
**Examples**: Update dependencies, clean up unused imports, refactor legacy code, audit logging.

---

### RFC (RFC##)
**Purpose**: Proposal seeking feedback BEFORE a decision.
**Location**: `.agents/plans/rfcs/`
**Status**: Draft → Under Review → Accepted / Rejected
**Differs from ADR**: RFC is prospective (before decision); ADR is retrospective (after decision).

---

### ADR (ADR##)
**Purpose**: Architecture Decision Record — documents a decision ALREADY MADE.
**Location**: `.agents/plans/adrs/` (standalone) or `.agents/changelogs/EP##--slug/` (epic-scoped)
**Status**: Accepted (immutable once recorded)
**Format**: Decision, Context, Consequences, Alternatives Considered.

---

### AGN (AGN##)
**Purpose**: Agentic governance system improvements.
**Location**: `.agents/changelogs/agentic/`
**Scope**: Changes to workflows, skills, RULES.md, templates.
**Examples**: Improve Token-Saving Protocol, add new skill, create workflow template.

---

### Review (RV##)
**Purpose**: Code or design review.
**Location**: `.agents/changelogs/EP##--slug/`
**Scope**: Formal peer review of stories or specs
**Triggers**: High-risk changes, architectural decisions, security-sensitive code.

---

## Prefix Table

| Type | Prefix | Location |
|------|--------|----------|
| Epic | `EP##` | `.agents/plans/` |
| Design Spec | `EP##-DS##` | `.agents/changelogs/EP##--slug/` |
| UX Spec | `EP##-UX##` | `.agents/changelogs/EP##--slug/` |
| Test Plan | `EP##-TP##` | `.agents/changelogs/EP##--slug/` |
| Story | `EP##-ST##` | `.agents/changelogs/EP##--slug/` |
| Task | `TA##` or `EP##-TA##` | `.agents/changelogs/standalone/` or `.agents/changelogs/EP##--slug/` |
| Bug | `BUG##` or `EP##-BUG##` | `.agents/changelogs/standalone/` or `.agents/changelogs/EP##--slug/` |
| Chore | `CH##` or `EP##-CH##` | `.agents/changelogs/standalone/` or `.agents/changelogs/EP##--slug/` |
| RFC | `RFC##` | `.agents/plans/rfcs/` |
| ADR | `ADR##` | `.agents/plans/adrs/` |
| Review | `EP##-RV##` | `.agents/changelogs/EP##--slug/` |
| AGN | `AGN##` | `.agents/changelogs/agentic/` |

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

## Directory Structure (Changelogs)

```
.agents/changelogs/
├── EP01--user-authentication/
│   ├── 20260302T143022Z-EP01-user-authentication.md (Epic plan)
│   ├── 20260302T143500Z-EP01-DS01-auth-flow.md (Design Spec)
│   ├── 20260302T144000Z-EP01-UX01-login-screen.md (UX Spec)
│   ├── 20260302T144500Z-EP01-TP01-auth-tests.md (Test Plan)
│   ├── 20260302T145000Z-EP01-ST01-google-oauth.md (Story + Changelog)
│   ├── 20260302T150000Z-EP01-ST02-credential-login.md (Story + Changelog)
│   └── 20260302T160000Z-EP01-RV01-code-review.md (Review)
├── EP02--content-curation/
│   └── (same structure)
├── standalone/
│   ├── 20260302T161000Z-TA01-update-dependencies.md
│   ├── 20260302T162000Z-BUG01-quiz-timer-overflow.md
│   └── 20260302T163000Z-CH01-clean-unused-imports.md
└── agentic/
    └── 20260302T164000Z-AGN01-improve-token-saving.md
```

---

## Timestamp Generation

Use this command to generate the current timestamp in UTC+10:

```bash
# macOS/Linux
date -u +"%Y%m%dT%H%M%SZ" | sed 's/Z$//' && TZ=UTC+10 date +"%H%M%SZ"

# Or use Node.js
node -e "console.log(new Date().toISOString().replace(/[-:]/g,'').replace('Z','Z'))"
```

Or manually: `YYYYMMDDTHHmmssZ` (e.g., `20260302T143022Z`)

