# MVP Readiness Assessment — Gap Register

**Date:** 2026-03-04
**Context:** Solo build with AI agents (vibe coding experiment). All four PRDs accepted. Core ADRs in place. Pre-build readiness review.

---

## Verdict

Documentation is **~70–80% ready** for MVP build. Core vision, PRDs, and architecture decisions are solid. The gaps below are blockers or significant rework risks if not addressed before coding starts.

---

## Gap Register

### GAP-01 — No API Contract

**Description:**
The Hono backend ADR describes the orchestration approach but no API surface has been defined. There are no endpoint specs, request/response shapes, or error contracts. Frontend and backend (even when built by the same agent) need an agreed contract to avoid integration rework.

**Risk:** Medium-High. Without this, agents will make incompatible assumptions on both sides and require rework mid-build.

**Who to speak to:** `architect`
**Discussion goal:** Produce an API Surface ADR (`product-documentation/architecture/`) covering: route structure, request/response schemas, auth headers, error envelope format.

---

### GAP-02 — No Database Schema

**Description:**
The Cloudflare/D1 ADR describes the hybrid relational+JSON _approach_ but no schema exists. No tables, columns, relationships, or index strategy are defined. SRS state alone is complex — mastery counts, intervals, active window, stuck words — and must be locked before any engine or backend code connects to D1.

**Risk:** High. Schema decisions ripple through engine types, Hono routes, and migration files. Late schema design causes cascading rework.

**Who to speak to:** `architect`
**Discussion goal:** Produce a Data Model ADR covering: D1 table definitions, JSON column strategies, R2 key conventions, migration approach.

---

### GAP-03 — No Build Sequence

**Description:**
There are four subsystems (User Management, Content Curation, SRS, TTS Audio). No decision exists on which ships first or what the thinnest vertical slice is. Without a sequenced build plan, agents will build in parallel without integration points, or build things that can't be demoed.

**Risk:** Medium. Not a day-one blocker but will cause context-switching and wasted work within the first sprint.

**Who to speak to:** `product` (prioritization) + `scrum` (epic lifecycle setup)
**Discussion goal:** Define Stage 1 scope — the smallest vertical that proves the core learning loop. Likely: Auth → Curation (one deck) → SRS quiz on that deck. Lock the build sequence as an accepted epic list.

---

### GAP-04 — Curation Engine ADR Still "Proposed"

**Description:**
The curation engine ADR (`20260303T210000Z-engineering-curation-engine-package.md`) is marked as Proposed. If treated as decided before it is formally accepted, agents may build against assumptions that are later revised.

**Risk:** Low-Medium. The ADR appears sound, but status must be closed.

**Who to speak to:** `architect`
**Discussion goal:** Review and formally accept (or amend) the curation engine ADR. Update status field to Accepted.

---

### GAP-05 — No E2E Agentic Development Workflow

**Description:**
This project is a vibe coding experiment — agents will own the full development cycle. But there is no defined playbook for how a feature moves from "Accepted" epic to "Completed" in an agentic context. Specifically, the following are undefined:

- **Stage entry/exit criteria** — what must be true before an agent picks up a work item and before it hands off
- **Check-in points** — when does the agent pause and surface findings vs. continue autonomously
- **Commit discipline** — when to commit, what goes in one commit, how conventional commit types map to agentic work phases
- **Unit test requirements** — when are tests written (before, during, after implementation), what coverage is expected per layer (engine vs. backend vs. frontend)
- **PR preparation** — what a PR must contain (description, test evidence, linked ADRs, review checklist)
- **Stage transitions** — what triggers `In Progress → Impl-Complete → BDD Pending → Completed` and who/what validates each gate (ref: Epic Lifecycle in WORKFLOW.md)
- **Stuck/blocked protocol** — how an agent surfaces a blocker vs. attempts to resolve it autonomously

Without this, each agentic session reinvents the process, consistency degrades across sessions, and the "vibe coding experiment" has no observable methodology to learn from.

**Risk:** High for the experiment goal. Medium for functional output. Without a defined workflow, you won't be able to reflect on what's working in the agentic development process.

**Who to speak to:** `agentic` + `scrum`
**Discussion goal:** Define the Stage 1 development playbook as a workflow document or skill set. Cover: agent entry/exit criteria per epic stage, commit cadence, test-writing protocol, PR template, check-in triggers, and transition gates.

---

## Recommended Discussion Order

| Priority | Gap                              | Role                | Dependency                                 |
| -------- | -------------------------------- | ------------------- | ------------------------------------------ |
| 1        | GAP-03 — Build Sequence          | `product` + `scrum` | Unblocks everything else                   |
| 2        | GAP-05 — Agentic Dev Workflow    | `agentic` + `scrum` | Needs build sequence to anchor stages      |
| 3        | GAP-02 — Database Schema         | `architect`         | Needed before any engine touches D1        |
| 4        | GAP-01 — API Contract            | `architect`         | Needed before frontend-backend integration |
| 5        | GAP-04 — Curation ADR Acceptance | `architect`         | Low risk, close quickly                    |

---

## What Is Ready to Build Now

The following can be started without resolving the gaps above:

- `packages/srs-engine` — Pure TypeScript, no I/O, well-defined API. Unit testable immediately.
- `packages/curation-engine` — Same pattern. Prompt-builder + parser. No external dependencies.
- Project scaffolding — pnpm workspaces, Turborepo, port conventions, Docker Compose local env.

These are low-risk starts that will surface schema and API questions organically.
