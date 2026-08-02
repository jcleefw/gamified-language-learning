# EP18-DS03: Comment-Hygiene ESLint Rules Specification

**Date**: 20260802T191006Z
**Status**: Completed
**Epic**: [EP18 - Monorepo Linting & Boundary Enforcement](../../plans/epics/EP18-monorepo-linting-and-boundary-enforcement.md)
**Covers**: A new concern, not part of DS02's scope (which covers ST05–ST09 import-boundary rules only) — a comment-content rule, not an import rule.

---

## 1. Feature Overview

Two new custom ESLint rules, plus one shared helper module, all under a new `eslint-rules/` folder at repo root — the first local (non-import-boundary) ESLint rules this repo has needed, so no existing mechanism could be reused; `no-restricted-imports` only inspects the AST (imports), not comment text.

- `no-ticket-refs-in-comments`: flags any code comment that contains an epic/story/ADR/ticket-shaped reference (e.g. `EP18-ST05`, `DS02`, `ADR-07`). Configured `'warn'`, scoped to `apps/**/*.ts` and `packages/**/*.ts`, going-forward-only in spirit (nothing is fixed retroactively by this DS).
- `todo-ticket-refs-in-comments`: a deliberately separate rule that only inspects `TODO:`-prefixed comments, flagging any ticket ref inside them too — but hardcoded `'warn'` permanently, because a TODO comment legitimately needs to name the ticket that will resolve it (a forward-looking pointer, not after-the-fact narration). Splitting this into its own rule means it can never be swept up if `no-ticket-refs-in-comments` is later escalated to `'error'` as part of a clean-up pass.
- `ticket-ref-pattern.ts`: shared regex (`\b(?:EP|PH|DS|UX|TP|ST|TA|BUG|CH|RV|ADR|RFC|AGN)-?\d+(?:-(?:...)-?\d+)*\b`, case-insensitive) and a `isTodoComment` helper, covering every abbreviation in `WORKFLOW.md`'s artifact taxonomy (epic-attached: Phase, Design Spec, UX Spec, Test Plan, Story, Task, Bug, Chore, Review, ADR; standalone: RFC, Agentic Plan).

**Origin**: this emerged mid-session, not from planned scope. While implementing EP18-ST05 (Phase 2 boundary rules), a new comment was written with an `EP18-ST05:` prefix — copying a style already present elsewhere in `eslint.config.ts`. The user caught this as a repeat violation of `RULES.md`'s existing "no ticket references in comments" rule and asked for a full-codebase audit (`.agents/reports/20260802-comment-epic-story-adr-references-audit.md`, ~50 manually-grepped hits) followed by an enforcement mechanism, rather than another one-off manual fix.

## 2. Core Requirements

| Requirement | Decision | Rationale |
| --- | --- | --- |
| Detection mechanism | Custom ESLint rule reading `context.sourceCode.getAllComments()`, regex-tested per comment | No built-in ESLint rule inspects comment *text*; `no-restricted-imports`/`no-restricted-syntax` only see AST nodes. A custom rule is the zero-new-dependency option — ESLint's own `Rule` type and comment API are already available via the `eslint` package this repo depends on. |
| Severity | `'warn'`, not `'error'` | Turning this on as `'error'` today would fail `pnpm lint` on ~71 pre-existing hits (more than the manual grep found, since the regex also catches bare `DS01`/`ST05`-style refs without an epic prefix). Consistent with this epic's "rules apply going forward only" principle (see EP18 Decisions Log). |
| Scope | `apps/**/*.ts`, `packages/**/*.ts` | Matches every other file-scoping pattern already used in `eslint.config.ts`. Does **not** reach `.vue` files — this config has no block targeting `**/*.vue` at all today (a pre-existing gap unrelated to this rule; `lint-staged` lists `*.{ts,vue}` but no ESLint block parses Vue SFCs yet). |
| TODO exception | A second, separate rule (`todo-ticket-refs-in-comments`), not a conditional inside the general rule | ESLint applies one configured severity per rule instance — there's no way for a rule to self-report at a severity different from its config. The only way to guarantee a TODO-tagged ticket ref can *never* become a build-failing error (even after a future clean-up pass flips the general rule to `'error'`) is to give it its own rule name, hardcoded `'warn'` in config, with a comment explaining why it must stay that way. |
| Compound-ID matching | Regex chains on hyphens so `EP18-ST05` is captured as one match, not just `EP18` | The first version only matched the first segment; caught during review — a warning message should show the whole ID a reader recognizes, not a truncated fragment. |
| File organization | `eslint-rules/` folder, one file per rule + a shared pattern module + an `index.ts` aggregator | Requested explicitly — keeps custom rule implementations out of `eslint.config.ts` (which stays wiring-only) and gives room to add more local rules later without the config file growing unbounded. |
| Testing approach | ESLint's own `RuleTester`, colocated `*.test.ts` next to each rule | More direct than the fixture-file-based `withFixture`/`restrictedImportViolations` harness in `eslint-boundary-rules.test.ts` (which round-trips through real files and a full `ESLint.lintFiles()` call) — `RuleTester` tests the rule module directly with inline code strings, no filesystem I/O. Requested explicitly as "own test, not boundary rule, put test closer to code." |

## 3. Data Structures

```typescript
// eslint-rules/ticket-ref-pattern.ts
export function ticketRefPattern(): RegExp; // fresh RegExp per call (stateless — .exec() on a shared global-less instance needs no lastIndex reset, but a factory function avoids any doubt)
export function isTodoComment(commentValue: string): boolean;

// eslint-rules/no-ticket-refs-in-comments.ts
export const noTicketRefsInComments: Rule.RuleModule; // messageId: 'ticketRef', data: { match: string }

// eslint-rules/todo-ticket-refs-in-comments.ts
export const todoTicketRefsInComments: Rule.RuleModule; // messageId: 'todoTicketRef', data: { match: string }

// eslint-rules/index.ts
export const localRules: {
  'no-ticket-refs-in-comments': Rule.RuleModule;
  'todo-ticket-refs-in-comments': Rule.RuleModule;
};
```

## 4. User Workflows

```
START → developer writes `// EP18-ST12: refactor this later` in apps/srs-demo/src/*.ts
      → git commit → lint-staged runs eslint --fix on staged file
      → no-ticket-refs-in-comments warns (does not block commit) → commit succeeds, warning visible in output
      → developer optionally rewords the comment to drop the ticket ID

START → developer writes `// TODO: EP18-ST12 — revisit after the audio epic lands`
      → git commit → lint-staged runs eslint --fix
      → todo-ticket-refs-in-comments warns (never blocks, by design) → commit succeeds
      → the TODO stays discoverable via `pnpm lint` output, not silently exempted
```

## 5. Stories

### EP18-ST10: `no-ticket-refs-in-comments` rule + shared pattern module _(Done)_

**Scope**: `eslint-rules/ticket-ref-pattern.ts` (shared regex + TODO-detection helper) and `eslint-rules/no-ticket-refs-in-comments.ts`, wired into `eslint.config.ts` at `'warn'`.
**Read List**: `eslint.config.ts`, `RULES.md` (comment-style section)
**Tasks**:

- [x] Write `ticketRefPattern()` covering all 13 abbreviations from `WORKFLOW.md`'s taxonomy, chaining compound IDs on hyphens
- [x] Write `noTicketRefsInComments` rule, skipping TODO-prefixed comments (delegated to ST11's rule instead)
- [x] Wire into `eslint.config.ts`, scoped to `apps/**/*.ts` + `packages/**/*.ts`, severity `'warn'`
- [x] Add `RuleTester`-based test (`no-ticket-refs-in-comments.test.ts`) covering a simple ref, a compound ref, an ADR-style ref, and two control cases (a clean comment, a TODO-prefixed comment that this rule must NOT flag)
      **Acceptance Criteria**:
- [x] `pnpm lint` surfaces every existing ticket-shaped comment reference as a warning, blocks nothing
- [x] A TODO-prefixed comment is never flagged by this rule (verified by a passing "valid" case in the test)

### EP18-ST11: `todo-ticket-refs-in-comments` rule (permanent-warn exception) _(Done)_

**Scope**: `eslint-rules/todo-ticket-refs-in-comments.ts`, wired into `eslint.config.ts` at `'warn'` with a comment documenting it must never change to `'error'`.
**Read List**: `eslint-rules/no-ticket-refs-in-comments.ts` (the counterpart rule it must stay independent from)
**Tasks**:

- [x] Write `todoTicketRefsInComments`, only inspecting comments where `isTodoComment()` is true
- [x] Wire into `eslint.config.ts` as a second, independent rule entry — not a shared severity with ST10's rule
- [x] Add `RuleTester`-based test (`todo-ticket-refs-in-comments.test.ts`) covering a TODO with a ticket ref, a TODO without one (valid), and a non-TODO comment with a ticket ref (valid — out of this rule's scope, ST10's rule owns that case)
      **Acceptance Criteria**:
- [x] A `TODO:`-prefixed comment containing a ticket ref is flagged by this rule specifically (not by ST10's rule)
- [x] Flipping ST10's rule to `'error'` in `eslint.config.ts` (hypothetically) would not affect this rule's severity, since they are registered as two separate `rules` entries

## 6. Success Criteria

1. `pnpm lint` warns on every ticket-shaped reference in a code comment across `apps/**/*.ts` and `packages/**/*.ts`, without failing the command (0 errors introduced)
2. TODO-prefixed comments are exempted from ST10's rule and covered instead by ST11's rule, which is independently configured and cannot inherit a future `'error'` escalation of ST10's rule
3. All new rule logic has colocated `RuleTester` unit tests, run via `pnpm test:eslint-config` (the existing `vitest run --project tooling` script), registered in `vitest.workspace.ts`
4. No new npm dependency added — both rules use only the `eslint` package already installed
5. No type errors

**Post-implementation note**: when staging this work for commit, the `git add -p`-staged slice of `eslint.config.ts` initially carried the Phase 3 rule block without the `import { localRules } from './eslint-rules/index.js'` line that makes it work — a `ReferenceError: localRules is not defined` at ESLint load time, caught before commit by checking `git show :eslint.config.ts` against the working tree. Fixed by staging just that one import hunk (`printf 'y\nn\nn\n' | git add -p eslint.config.ts`), leaving the unrelated Phase 2 (ST05) hunk and a comment-cleanup hunk unstaged. Verified via `git show :eslint.config.ts | grep localRules` and a real `pnpm eslint` run.
