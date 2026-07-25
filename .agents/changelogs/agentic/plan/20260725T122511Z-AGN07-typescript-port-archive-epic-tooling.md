# AGN07: Port `archive-epic` Tooling to `.mjs` — Implementation Plan

**Date**: 20260725T122511Z <!-- Run .agents/tools/generate-timestamp.sh -->
**Type**: Tool
**Status**: **Draft**
**Track**: agentic
**Related**: AGN06 (Package-Scoped Knowledge Filtering — built the bash this plan ports)

---

## 1. Overview

`archive-epic.sh` (AGN06-ST04) is a 467-line bash orchestrator: 10 subcommands
that read/write `index.json` via inline `jq` filter strings, parse other
scripts' stdout with `sed`/`awk`, and shell out to sibling `.sh` tools.
Debugging it means reading `jq` programs embedded as string literals with no
type checking, tracing failures through `set -euo pipefail` short-circuits
with no stack trace.

Two siblings (`archive-append.sh`, `archive-check.sh`) are **already**
one-line shims over plain `.mjs` in `.agents/tools/lib/` — that port happened
during AGN06 itself. This plan extends the same pattern to the three
remaining bash-heavy scripts:

| Script | What it does |
| --- | --- |
| `domains-from-diff.sh` | routes changed paths → workspace units via `pnpm-workspace.yaml` |
| `epic-commit-range.sh` | git history scan → firm/indeterminate/not_found commit range |
| `archive-epic.sh` | orchestrator — all 10 subcommands, calls the two above + `archive-append`/`archive-check` |

`backfill-compact-pr-info.sh` (~30 lines, one `git log --grep`) is folded into
the orchestrator port rather than kept as a separate script — its only caller
is `archive-epic.sh backfill`.

**Scope guard.** Mechanical port, not a redesign. The CLI contract (subcommand
names, flags, stdout key:value / `candidate:` line formats) is load-bearing —
`.agents/skills/agentic/archive-epic/SKILL.md` parses that exact output. No
behavior change, no new subcommands, no schema change to `index.json` or the
reference files. No other `.agents/tools/*.sh` scripts are touched.

## 2. Core Requirements

| Requirement | Decision | Rationale |
| --- | --- | --- |
| Language | Plain `.mjs` (ESM, zero npm deps), not `.ts` | Matches the existing `archive-append.mjs`/`archive-check.mjs`/`jsonschema.mjs` precedent; no build step |
| Runtime invocation | Thin `.sh` shim (`exec node "$DIR/lib/<name>.mjs" "$@"`) at the same path | Callers keep invoking `archive-epic.sh discover EP07` unchanged |
| CLI contract | Byte-for-byte stdout/stderr/exit-code parity per subcommand | `SKILL.md` pattern-matches `status:`/`range:`/`candidate:` lines |
| `jq` filters → JS | Native object/array manipulation over `JSON.parse`/`JSON.stringify` | The actual pain point being fixed |
| Git/shell calls | `node:child_process` `execFileSync` with argv arrays | Avoids shell-interpolation risk from epic ids/paths |
| Testability | Each subcommand exported as a function taking explicit args, not reading `process.argv`/`cwd()` mid-logic | Enables real unit tests — none exist today for this tooling |
| Verification | Vitest suite comparing ported `.mjs` output against the original bash on real repo fixtures | Directly proves "behavior doesn't change" rather than asserting it |

## 3. Port Strategy

```
.agents/tools/
  domains-from-diff.sh    → exec node lib/domains-from-diff.mjs "$@"
  epic-commit-range.sh    → exec node lib/epic-commit-range.mjs "$@"
  archive-epic.sh         → exec node lib/archive-epic.mjs "$@"
  lib/
    domains-from-diff.mjs   (new)
    epic-commit-range.mjs   (new)
    archive-epic.mjs        (new — imports the two above + existing
                              archive-append.mjs/archive-check.mjs)
    archive-epic.test.mjs   (new — parity tests, see §4)
```

Port order: `domains-from-diff` and `epic-commit-range` first (leaves of the
dependency graph), then `archive-epic` orchestrator, which imports both
in-process instead of shelling out to them.

## 4. Testing Approach

Vitest, run standalone (`pnpm exec vitest run .agents/tools`), not wired into
`turbo test` — this is ops tooling, not a workspace package.

- **Parity tests**: for each ported script, run both the original bash
  (kept temporarily under a `.orig.sh` suffix during the port) and the new
  `.mjs`/shim against identical fixtures/repo state, assert identical stdout,
  stderr shape, and exit code.
- **Unit tests** on pure functions extracted during the port
  (`workspacePrefixes`, `routeDomains`, `blacklistFor`, `excludedBy`,
  range-flag derivation) — these had zero test coverage in bash form.
- Fixtures: a scratch `index.json`/`ryoiki-blacklist.json` copy (never the
  real repo files) plus real git history reads (read-only, safe).

## 5. Stories

### AGN07-ST01: `domains-from-diff` → `.mjs` — *status: done*

**Scope**: Port path-routing logic: parse `packages:` globs from
`pnpm-workspace.yaml`, compute literal prefixes, route each changed path to
`apps/<x>` / `packages/<x>` / `<non-workspace>`.
**Tasks**:
- [x] `lib/domains-from-diff.mjs`: hand-rolled `packages:` block parser
      (no YAML dependency — same scope as the original awk).
- [x] Support all three input modes: forwarded `git diff --name-only <args>`,
      `--files <path>...`, `--stdin`.
- [x] Same output: distinct workspace units sorted first, `<non-workspace>`
      last if any path falls outside all units.
- [x] `domains-from-diff.sh` reduced to a one-line shim.

**Acceptance**:
- [x] For every invocation form used by `archive-epic.sh`, stdout is
      byte-identical between the bash and `.mjs` versions on the same input.
- [x] Adding a new `packages/*` workspace member requires zero code changes.

### AGN07-ST02: `epic-commit-range` → `.mjs` — *status: done*

**Scope**: Port the two-pass range resolution: main-branch history-scan
(entanglement/revert/merge-marker flags → firm/indeterminate), fallback to
branch-divergence, plus the prior-archive already-archived/reverted check.
**Tasks**:
- [x] `lib/epic-commit-range.mjs`: `execFileSync('git', [...])` replacing
      each interpolated `git -C "$ROOT" ...` call.
- [x] Preserve resolution order (main history-scan first, branch-divergence
      only when main has zero trace) and all five flags.
- [x] Same stdout format: `epic:`/`status:`/`source:`/
      `suggested_first_commit:`/`suggested_last_commit:`/
      `suggested_diff_range:`/`flags:`/one `candidate:` line per commit.
- [x] `epic-commit-range.sh` reduced to a one-line shim.

**Acceptance**:
- [x] Clean epic → `firm` with identical `suggested_diff_range` to bash, same
      repo state.
- [x] A known cross-epic entangled commit → `indeterminate` with identical
      flags and candidate list.
- [x] No changelog-folder commits → `not_found`, no side effects.

### AGN07-ST03: `archive-epic` orchestrator → `.mjs`

**Scope**: Port all 10 subcommands, replacing every inline `jq` filter with
native JS, folding in `backfill-compact-pr-info.sh`'s lookup as an internal
function.
**Tasks**:
- [ ] Each subcommand exported as a function taking explicit args (root,
      epic id, overrides) — the seam that makes it testable without
      shelling out.
- [ ] `draft`/`confirm`/`blacklist`/`scaffold`/`check` read/write
      `index.json`/`ryoiki-blacklist.json` via native JSON ops, 1:1
      replacing each `jq` filter.
- [ ] `blacklistFor()`/`excludedBy()` (longest-prefix cascade, `"*"` global
      key merge) ported as small pure functions with direct unit tests.
- [ ] `verify` calls `archive-check.mjs`'s logic in-process (not a re-exec).
- [ ] `compact` still only **prints** commands — never executes them
      (Golden Rule 3 unchanged).
- [ ] `archive-epic.sh` reduced to a one-line shim.

**Acceptance**:
- [ ] `discover`/`status`/`scaffold`/`check`/`backfill`/`compact` produce
      byte-identical stdout to bash for a real epic already in `index.json`.
- [ ] `draft` on a scratch copy of `index.json` produces the same JSON
      (key order aside) as bash for the same input changelog folder.
- [ ] `confirm`/`blacklist` mutate `index.json`/`ryoiki-blacklist.json`
      identically to bash given the same `--data`/`--add` input.
- [ ] Tool never commits, never writes `KNOWLEDGE.md`, never deletes
      `state` or invents a ryoiki (Golden Rule 3 — carried over unchanged).
- [ ] `.agents/skills/agentic/archive-epic/SKILL.md` runs unmodified against
      the ported tool.

### AGN07-ST04: Cutover + regression pass

**Scope**: Swap all remaining `.sh` entry points to shims, delete dead bash
bodies and `backfill-compact-pr-info.sh`, run a real epic through the full
flow end-to-end.
**Tasks**:
- [ ] Run `discover` → `draft` → `status` → `confirm` → `blacklist` →
      `scaffold` → `check` → `verify` end-to-end on a real (or scratch-copied)
      epic; diff every output against a pre-cutover bash run.
- [ ] Delete `backfill-compact-pr-info.sh` once no longer shelled out to.
- [ ] Confirm no other script/skill references deleted bash bodies directly.

**Acceptance**:
- [ ] Full flow output matches the pre-port bash run exactly.
- [ ] `grep -r` across `.agents/` turns up only preserved `.sh` shim paths.
- [ ] Bash bodies removed, `.mjs` + tests added, shims thinned to one line.

## 6. Not built

- No test suite is added beyond this tooling's own parity/unit tests — not a
  repo-wide testing initiative.
- No change to `index.json`'s schema, `ryoiki-aliases.json`, or
  `ryoiki-blacklist.json` shapes.
- No new subcommands or flags.
- No port of unrelated `.agents/tools/*.sh` scripts.

## 7. Success Criteria

1. All three scripts are `.mjs` under `.agents/tools/lib/`, called through
   unchanged one-line `.sh` shims.
2. Every subcommand's stdout/stderr/exit-code is unchanged from bash for the
   same input, proven by a parity test suite — `SKILL.md` requires zero edits.
3. `jq` filter strings are gone; JSON manipulation is native JS a human can
   step through with a debugger.
4. Git calls use `execFileSync` with argv arrays, not interpolated strings.
5. Golden Rule 3 (tool never invents a ryoiki/blacklist entry, never commits,
   never writes `KNOWLEDGE.md`) holds unchanged.
