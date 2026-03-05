# EP09 - Agentic Dev Workflow (GAP-05)

**Created**: 20260305T135334Z
**Status**: Completed
**Status Changed**: 20260305T135334Z
<!-- Status: Draft | Accepted | In Progress | Impl-Complete | BDD Pending | Completed | Shelved | Withdrawn -->
**Type**: Epic Plan
**Depends on**: N/A
**Predecessor**: N/A

---

## Problem Statement

Without a defined agentic dev workflow, each stage would be inconsistent in how commits are made, how tests are required, how epics transition through lifecycle states, and how stories are sized. This creates unpredictable quality gates and makes handoff between agent and human unclear.

## Scope

**In scope**:
- Epic lifecycle gates (Accepted → In Progress → Impl-Complete → BDD Pending → Completed)
- Branching model (story branches → epic branch → main via human PR)
- Story creation sequence (titles → design spec → full detail → Accepted)
- Unit test protocol by layer (engines: strict TDD; backend: pragmatic; frontend: pragmatic)
- Commit discipline (one commit per story, impl+tests together, conventional format)
- Story sizing rules (one layer max, split in PLAN phase only)
- PR template
- BDD ownership (PRD agent writes scenarios, QA agent implements)

**Out of scope**:
- CI/CD pipeline configuration — post-MVP
- BDD test implementation — deferred to UI stage (Stage 4+)

---

## Stories

*(All resolved via GAP-05 discussion — no implementation stories required)*

---

## Overall Acceptance Criteria

- [x] Epic lifecycle gates defined with entry criteria and validator for all 4 transitions
- [x] Branching model documented
- [x] Story creation sequence documented
- [x] Unit test protocol defined per layer
- [x] Commit discipline rules documented
- [x] Story sizing rules documented
- [x] PR template defined
- [x] BDD ownership split documented

---

## Dependencies

- N/A

## Resolution

Resolved as GAP-05 during pre-build readiness phase (2026-03-05). Full workflow documented in `.agents/memory/main/current-focus.md`. Applied to all Stage 1+ work.
