# EP33 - Playwright BDD Setup + Mastered-Words Regression Fix

**Created**: 20260625T010253Z
**Status**: In Progress

<!-- Status: Draft | Accepted | In Progress | Impl-Complete | BDD Pending | Completed | Shelved | Withdrawn -->

**Type**: Epic Plan
**Depends on**: EP31, EP32
**Parallel with**: N/A
**Predecessor**: N/A

---

## Problem Statement

srs-demo has a regression: after mastering words in a deck and returning to the deck list, re-entering the same deck shows the already-mastered words instead of new unmastered words. No E2E test coverage exists to catch this or future regressions.

### Root Cause

In `apps/srs-demo/src/App.vue:initSession()`, mastered words are collected into `recheckIds` and passed to `initAdaptiveSession()`. In `packages/srs-engine-v2/src/engine/adaptive-session.ts`, recheckItems fill the active pool **first**. With `wordsPerBatch=3` and 3 mastered words, all 3 active slots are filled with mastered words — no room for new words.

## Scope

**In scope**:
- Install Playwright + `playwright-bdd` in `apps/srs-demo`
- `playwright.config.ts` with two `webServer` entries (Hono + Vite with `VITE_CHEAT_MODE=true`)
- Gherkin feature file for the mastered-words regression scenario
- Step definitions using `VITE_CHEAT_MODE` hint to answer correctly
- Bug fix in `apps/srs-demo/src/App.vue:initSession()`

**Out of scope**:
- Turbo integration for `pnpm e2e`
- Additional feature scenarios
- Database seeding utilities

---

## Stories

### EP33-ST01: Install and configure Playwright + playwright-bdd

**Scope**: Add deps and config — no test files yet

### EP33-ST02: Write failing Gherkin feature + step definitions

**Scope**: Write feature file + step defs; run to confirm failure

### EP33-ST03: Fix App.vue bug + confirm test passes

**Scope**: One-function edit to `initSession`; confirm test goes green

---

## Overall Acceptance Criteria

- [ ] `pnpm e2e` command exists in `apps/srs-demo/package.json`
- [ ] `playwright.config.ts` starts both servers automatically
- [ ] `e2e/features/session-mastery.feature` exists with the regression scenario
- [ ] Running `pnpm e2e` on the buggy code → test fails
- [ ] After fix to `App.vue:initSession()`, `pnpm e2e` → test passes
- [ ] Mastered words do not appear when re-entering the same deck

---

## Dependencies

- EP31 (HTTP persistence via Hono + SQLite)
- EP32 (v1 cleanup, clean API contract)

## Next Steps

1. Review and approve plan
2. Begin implementation ST01 → ST02 → ST03
