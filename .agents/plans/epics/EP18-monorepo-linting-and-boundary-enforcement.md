# EP18 - Monorepo Linting & Boundary Enforcement

**Created**: 20260801T193611Z
**Renamed/Rescoped**: 20260802T171900Z (was "SRS Engine Boundary Enforcement & Pre-Commit Gate" — generalized after Phase 1 completion; \

**Status**: Accepted

<!-- Status: Draft | Accepted | In Progress | Impl-Complete | BDD Pending | Completed | Shelved | Withdrawn -->

**Type**: Epic Plan
**Depends on**: None
**Parallel with**: None
**Predecessor**: None

---

## Problem Statement

Architectural boundary rules across this monorepo's packages exist only as prose (or not even that — some are undocumented-but-real invariants) — e.g. `packages/srs-engine/RULES.md`'s module import restrictions, `packages/logger`/`packages/shared-utils` never importing anything else, `packages/api-contract` staying a pure types/contract package, `apps/db`-style backend concerns never leaking into the frontend, apps never importing each other. Nothing stops any of these from being silently violated as the codebase grows — particularly with AI-assisted contributions, which tend to reach for the nearest available import or invent a new local type rather than checking whether a boundary already excludes that path. Separately, this repo had no pre-commit gate at all: lint, type errors, and test failures were only caught in CI or PR review, after the commit already existed.

## Scope

**In scope**:

- **Phase 1 (done — see EP18-DS01)**: `packages/srs-engine`-specific ESLint boundary rules (internal `shelving`/`review` vs `learn`, external bare-package + `apps/srs-demo`-vs-`/review` blacklists), plus a `husky` + `lint-staged` pre-commit gate (lint-only — typecheck/test enforcement was implemented, verified, and then withdrawn; see Decisions Log).
- **Phase 2 (new — see EP18-DS02, not yet written)**: generalize boundary enforcement beyond `srs-engine`, based on a repo-wide survey of undocumented-but-real invariants:
  - Leaf-lock for `packages/logger` and `packages/shared-utils` — ban any `@gll/*` import inside either (both are confirmed true leaves today; this closes circular-dependency risk by construction, not just convention).
  - `packages/api-contract` purity — ban `@gll/db`, `@gll/server`, and any DB-driver import (confirmed zero current violations; its only dependency is `zod`).
  - `apps/srs-demo` must not import `@gll/db` — same "server-side concern, frontend excluded" logic as the existing `@gll/srs-engine/review` blacklist (confirmed zero current violations).
  - Apps must not import each other's source directly — `apps/server`, `apps/srs-demo`, `apps/cli-demo-db` stay mutually isolated at the import level (confirmed zero current violations). This doesn't touch runtime pairing: `srs-demo`/`server` remain a deployed client/server pair over HTTP, coupled through `@gll/api-contract`, not through a direct import.
  - Circular-import detection for `apps/srs-demo`'s composables — heavier lift than the other four (needs a cycle-detection mechanism/plugin, not a one-line `no-restricted-imports` block; current violation count not measured).
- Incremental adoption carries forward into Phase 2: rules apply going forward only. Four of the five Phase 2 candidates are confirmed zero-violation today (verified by direct grep, not assumed); the fifth (circular-import detection) has an unknown baseline pending tooling investigation in DS02.
- **Phase 3 (new — see EP18-DS03)**: comment-hygiene enforcement, not an import-boundary concern — surfaced mid-session as a repeat violation (a ticket ID written into a new code comment) rather than planned scope. Two new custom local ESLint rules (`eslint-rules/`, first non-import custom rules this repo has needed): `no-ticket-refs-in-comments` (warns on any `EP##`/`ST##`/`DS##`/`ADR##`/etc. reference inside a code comment, going-forward-only via `'warn'` severity) and `todo-ticket-refs-in-comments` (a permanently-`'warn'` exception for `TODO:`-prefixed comments, since a TODO legitimately needs to name the ticket that will resolve it).
- A full-codebase audit of pre-existing ticket-reference comments (`.agents/reports/20260802-comment-epic-story-adr-references-audit.md`, ~50 manually-grepped hits, 71 confirmed once the rule ran) is tracked as a future clean-up PR, not fixed by this epic.

**Out of scope**:

- Doc/code drift checking — already handled by the `review-srs-engine` skill, not lint.
- CI pipeline changes beyond the local pre-commit hook — **narrow exception carried over from Phase 1**: the one step added to the `lint` job running `pnpm test:eslint-config` (see EP18-DS01) stays in scope; no further CI restructuring implied by Phase 2.
- Fixing existing lint violations across the codebase — including the ~71 pre-existing comment-hygiene warnings from Phase 3; tracked as a separate future clean-up PR, not this epic's job.
- Extending Phase 3's comment-hygiene rule to `.vue` files — this config has no ESLint block parsing Vue SFCs at all today (pre-existing gap, unrelated to Phase 3); out of scope here.
- `apps/srs-demo/RULES.md`'s Vue structural conventions (script/template length, composable patterns, routing conventions) — a different shape of rule, not import boundaries; a candidate for its own future epic, not folded in here.
- Detecting/preventing AI-authored duplicate type definitions (e.g. a local `interface` in `srs-demo` re-inventing a shape already exported from `api-contract`/`srs-engine`) — raised and explicitly deferred; this needs semantic shape-comparison (a review skill, akin to `review-srs-engine`), not a lint rule, and does not belong in this epic.
- `packages/curation` (`@gll/srs-curation`) being orphaned (zero consumers import it) — flagged during the survey as a housekeeping question, not a boundary-scoping opportunity; not pursued.
- Deep-import boundary rules for `packages/logger`/`shared-utils`/`db`/`api-contract` — all four expose a single `"."` export today (no subpath map like `srs-engine`'s), and `tsconfig.base.json`'s `moduleResolution: "bundler"` already enforces the `exports` map at typecheck time. Confirmed no raw relative cross-package imports exist repo-wide either. Nothing to add here structurally.

---

## Stories

### Phase 1: SRS Engine Boundary Enforcement & Pre-Commit Gate (EP18-PH01) — Done, see EP18-DS01

### EP18-ST01: Internal import-boundary ESLint rule (Done)

**Scope**: Add a scoped `no-restricted-imports` block flagging any `shelving/`/`review/` import from `learn/` (no exception).

### EP18-ST02: External import-boundary ESLint rule (Done)

**Scope**: Add a scoped ESLint block flagging any non-srs-engine file importing the bare package, and `apps/srs-demo` specifically importing `/review`.

### EP18-ST03: Husky + lint-staged setup (Done)

**Scope**: Install and wire `husky` + `lint-staged` into the pnpm workspace; hook runs `lint-staged` only.

### ~~EP18-ST04: Pre-commit hook — lint + typecheck + affected tests~~ (Withdrawn)

**Scope**: ~~Wire the pre-commit hook to run lint-staged, typecheck, and the test suites of touched packages plus their dependents.~~ Withdrawn during implementation — see Decisions Log. The pre-commit gate stops at `lint-staged` (EP18-ST03); typecheck/test enforcement is deferred to CI rather than run at commit time.

### Phase 2: Generalized Boundary Enforcement (EP18-PH02) — see EP18-DS02

### EP18-ST05: Leaf-package lock — `packages/logger` + `packages/shared-utils`

**Scope**: Add a scoped `no-restricted-imports` block banning any `@gll/*` import inside `packages/logger/src/**` and `packages/shared-utils/src/**`.

### EP18-ST06: `packages/api-contract` purity rule

**Scope**: Add a scoped block banning `@gll/db`, `@gll/server`, and DB-driver imports inside `packages/api-contract/src/**`.

### EP18-ST07: `apps/srs-demo` must not import `@gll/db`

**Scope**: Add a scoped block banning `@gll/db` imports inside `apps/srs-demo/src/**` (mirrors the existing `@gll/srs-engine/review` blacklist).

### EP18-ST08: Apps must not import each other's source directly

**Scope (rescoped)**: Two new `no-restricted-imports` blocks (`apps/server`, `apps/cli-demo-db`) plus one merge into the existing `apps/srs-demo` (ST02b/ST07) block — not three independent new blocks. Each block bans, per the other two apps: (a) bare-segment `patterns` (`**/server/**`, `**/srs-demo/**`, `**/cli-demo-db/**`) for relative-path reach-through, and (b) `paths` bans on the other apps' package names as forward-looking insurance. The two new blocks additionally restate the bare-`@gll/srs-engine` ban already enforced by ST02a, since flat config replaces (not merges) `no-restricted-imports` options across blocks whose `files` overlap for the same file — omitting the restatement would silently regress ST02a's enforcement for these two apps, which is a regression this story would directly cause.

### EP18-ST09: Circular-import detection for `apps/srs-demo` composables

**Scope**: Investigate and wire a cycle-detection mechanism (e.g. `eslint-plugin-import`'s `import/no-cycle`, or an equivalent) scoped to `apps/srs-demo/src/composables/**`; measure current violation baseline before enforcing (unlike ST05–ST08, this one's baseline isn't yet confirmed clean).

### Phase 3: Comment Hygiene Enforcement (EP18-PH03) — see EP18-DS03 (Done)

### EP18-ST10: `no-ticket-refs-in-comments` rule + shared pattern module (Done)

**Scope**: `eslint-rules/ticket-ref-pattern.ts` (shared regex covering every abbreviation in `WORKFLOW.md`'s artifact taxonomy) + `eslint-rules/no-ticket-refs-in-comments.ts`, wired into `eslint.config.ts` at `'warn'`, scoped to `apps/**/*.ts` + `packages/**/*.ts`.

### EP18-ST11: `todo-ticket-refs-in-comments` rule — permanent-warn exception (Done)

**Scope**: `eslint-rules/todo-ticket-refs-in-comments.ts` — a separate rule (not a conditional branch in ST10's rule) so a `TODO:`-prefixed ticket reference can never inherit a future `'error'` escalation of ST10's rule.

---

## Overall Acceptance Criteria

**Phase 1 (met — see EP18-DS01 for verification detail)**:

- [x] ESLint flags a violation when `shelving/` or `review/` imports `learn/` (no exception)
- [x] ESLint flags a bare `@gll/srs-engine` import from any consumer
- [x] ESLint flags `apps/srs-demo` importing `@gll/srs-engine/review`
- [x] Pre-existing violations, if any, do not block rollout — rules apply only to changed files going forward
- [x] `git commit` triggers the pre-commit hook: `lint-staged` runs against staged files
- [x] A commit with a lint failure `lint-staged` can't auto-fix is blocked before the commit is created
- [x] ~~`git commit` triggers... typecheck, and tests for touched package(s) + their dependents~~ — struck, EP18-ST04 withdrawn
- [x] ~~A commit with a... type, or test failure is blocked before the commit is created~~ — struck, EP18-ST04 withdrawn
- [x] ~~Edge case: a commit touching only non-package files (docs, config) skips the test step~~ — struck, moot without a test step in the hook

**Phase 2 (pending — to be detailed in EP18-DS02)**:

- [ ] ESLint flags any `@gll/*` import inside `packages/logger` or `packages/shared-utils`
- [ ] ESLint flags `@gll/db`, `@gll/server`, or a DB-driver import inside `packages/api-contract`
- [ ] ESLint flags `@gll/db` imported from `apps/srs-demo`
- [ ] ~~ESLint flags any direct source import from one app into another...~~ — struck, EP18-ST08 withdrawn
- [ ] A circular-import check runs against `apps/srs-demo`'s composables, with a confirmed baseline (clean or with a known, scoped fix-up list) before enforcement
- [ ] All Phase 2 rules apply going forward only, consistent with Phase 1's incremental-adoption approach

**Phase 3 (met — see EP18-DS03)**:

- [x] `pnpm lint` warns on every ticket-shaped reference (`EP##`/`ST##`/`DS##`/`ADR##`/etc.) in a code comment across `apps/**/*.ts` and `packages/**/*.ts`, without failing the command
- [x] A `TODO:`-prefixed comment containing a ticket ref is flagged by a separate, independently-configured rule that cannot inherit a future `'error'` escalation of the general rule
- [x] No new npm dependency added — both rules use only the already-installed `eslint` package
- [x] Both rules have colocated `RuleTester` unit tests, run via `pnpm test:eslint-config`

---

## Dependencies

- `packages/srs-engine/RULES.md` (source of truth for Phase 1's six boundary rules)
- This session's repo-wide survey (Explore agent findings, not a written doc) — source of truth for Phase 2's candidate rules; confirmed zero-violation baselines cited above were verified by direct grep, not assumed

## Decisions Log

- **Tooling for ST01/ST02**: `no-restricted-imports` (built into the existing `typescript-eslint` setup), not `eslint-plugin-import`/`eslint-plugin-boundaries`. No new dependency; sufficient for these two flat, path-based rules. Revisit only if boundary rules grow into something needing zone/graph semantics.
- **`GraduationPerformance` exception dropped**: it's defined in `review/types.ts`, not `learn/`, so RULES.md's carve-out has no current real case. ST01 ships as a flat block; the exception gets added later if a real cross-boundary import ever needs it.
- **EP18-ST04 withdrawn — typecheck/test dropped from the pre-commit hook, deferred to CI**: implementing ST04 surfaced that `TURBO_SCM_BASE=HEAD turbo run typecheck test --affected` correctly scopes to touched packages + dependents (verified directly), but any commit touching a root-level dependency/config file (e.g. adding a devDependency) is *correctly* treated by turbo as a global-input change, so it fans out to every package — producing unpredictable, sometimes long commit-time latency. Since `.github/workflows/ci.yml` already runs `build`/`lint`/`typecheck`/`test` on every push to every branch, that's already a real enforcement point; running it again at commit time traded fast, predictable commits for a guarantee (no broken commit ever exists locally) that a solo dev pushing to a CI-gated branch doesn't need. `lint-staged` (ST03) stays in the hook — only the typecheck/test step is removed.
- **Epic renamed and rescoped to Phase 1 + Phase 2, rather than closing EP18 and opening a new epic**: the epic doc had never been committed, so there was no shared/merged history to preserve by branching off a separate epic. Phase 1's completed work (ST01–ST04) is rolled up under this epic unchanged; EP18-DS01 is retitled to reflect that it covers Phase 1 only.
- **AI-authored duplicate-type detection (raised during scoping) kept out of this epic entirely**: this is a semantic shape-comparison problem (does a new local type structurally duplicate one already exported from `api-contract`/`srs-engine`?), not something `no-restricted-imports` or any syntactic ESLint rule can catch. It needs a review-skill-style semantic check (like `review-srs-engine`), which is a different mechanism and a different epic — not a boundary-scoping rule.
- **`packages/curation` orphan status and deep-import boundary rules considered and dropped**: `packages/curation` has zero consumers repo-wide (housekeeping question, not a boundary issue — not pursued). `packages/logger`/`shared-utils`/`db`/`api-contract` all expose a single `"."` export with no subpath map, and `moduleResolution: "bundler"` already enforces their `exports` boundary at typecheck time; confirmed zero raw relative cross-package imports exist repo-wide either. No rule needed — the boundary is already structurally airtight.
- **Phase 3 added mid-session, not planned scope**: implementing ST05 surfaced a repeat comment-hygiene violation (a ticket ID copied into a new `eslint.config.ts` comment, mirroring a style already present from Phase 1/2). A full-codebase audit found ~50 pre-existing instances across 24 files spanning 10+ epics. Rather than a one-off manual fix, this became its own enforcement mechanism (EP18-DS03).
- **Two separate rules instead of one rule with a TODO condition**: ESLint applies one configured severity per rule instance — a rule cannot report at a severity different from its own config. Since a future clean-up PR might escalate `no-ticket-refs-in-comments` to `'error'`, the TODO exception had to be its own rule (`todo-ticket-refs-in-comments`), hardcoded `'warn'` in `eslint.config.ts`, so it's structurally immune to that future escalation rather than relying on someone remembering to carve out an exception each time.
- **`'warn'` severity chosen over `'error'` for Phase 3**: turning the general rule on as `'error'` today would fail `pnpm lint` on ~71 pre-existing hits (more than the manual audit found, since the regex also catches bare `ST05`/`DS02`-style refs without an epic prefix). Consistent with this epic's incremental-adoption principle; escalating to `'error'` is deferred to whenever the clean-up PR lands.
- **EP18-ST08 withdrawn — no clean way to implement**: dropped during implementation.

## Next Steps

1. ~~Create Design Spec EP18-DS02 for Phase 2 (EP18-ST05–ST09)~~ (Done — EP18-DS02 accepted)
2. Continue Phase 2 implementation: ST06–ST07 next (ST05 done, ST08 withdrawn), ST09 after its baseline investigation task runs
3. ~~Create Design Spec EP18-DS03 for Phase 3 (EP18-ST10–ST11)~~ (Done — EP18-DS03 accepted)
4. Future: a clean-up PR to resolve the ~71 pre-existing comment-hygiene warnings surfaced by Phase 3 (tracked in `.agents/reports/20260802-comment-epic-story-adr-references-audit.md`), then escalate `no-ticket-refs-in-comments` to `'error'`
