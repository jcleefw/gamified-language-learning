# EP18-ST12: Ticket-Ref Cleanup Script in Root `scripts/`

**Created**: 20260803T003034Z
**Epic**: [EP18 - Monorepo Linting & Boundary Enforcement](../../plans/epics/EP18-monorepo-linting-and-boundary-enforcement.md)
**Status**: Complete ✅
**Track**: project
**Supersedes**: —

## Summary

Follow-up to EP18-ST10 and EP18-ST11 (the `no-ticket-refs-in-comments` / `todo-ticket-refs-in-comments` ESLint rules from EP18-DS03). Those rules flag ticket references left in comments but don't remove them; this story adds the companion `remove-ticket-refs` script that auto-strips flagged references, wired into `lint-staged` so it runs on every `git commit` touching `*.{ts,vue}` (via `.husky/pre-commit`).

The script is general repo-maintenance tooling, not agent-invoked tooling — it runs from a git hook, independent of any agent — so it was placed in a plain root-level `scripts/` directory rather than under `.agents/tools/` (which is reserved for scripts invoked from `.agents/skills/*`). This establishes `scripts/` as a new convention for this repo, since no such directory existed before.

## Files Added

### `scripts/remove-ticket-refs.sh`

- CLI wrapper: `scripts/remove-ticket-refs.sh <package-path>` or `<file...>`
- Delegates to `remove-ticket-refs.mjs` in the same directory

### `scripts/remove-ticket-refs.mjs`

- Implements 15 comment-cleanup patterns that strip flagged ticket references while preserving the rest of the comment
- Imports the shared abbreviation pattern from `eslint-rules/ticket-ref-pattern.ts` (one directory up)

### `scripts/remove-ticket-refs.test.mjs`

- Colocated test covering all 15 cleanup patterns

### `package.json`

- `lint-staged["*.{ts,vue}"]` entry points at `scripts/remove-ticket-refs.sh`

### `scripts/vitest.config.mjs` (new, untracked)

- Mirrors `.agents/tools/vitest.config.mjs` (`include: ['**/*.test.mjs']`, `passWithNoTests: true`) so `scripts/remove-ticket-refs.test.mjs` is runnable via `vitest run --config scripts/vitest.config.mjs`

## Behavior / Verification

- Verified via a direct run of `node --import tsx/esm scripts/remove-ticket-refs.test.mjs` — all 15 assertions pass.
- Verified via a live smoke test through the `.sh` entrypoint against a scratch file: a comment containing `EP18-ST12:` was correctly stripped to plain descriptive text.
- New convention established: `.agents/tools/` is reserved for agent-invoked tooling (called from `.agents/skills/*`); general repo-maintenance scripts triggered by git hooks / npm scripts live in root `scripts/`.

## Next Steps

- Commit `scripts/vitest.config.mjs` (currently untracked) so the colocated test remains runnable.
