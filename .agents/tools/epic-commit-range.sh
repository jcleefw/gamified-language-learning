#!/usr/bin/env bash
# .agents/tools/epic-commit-range.sh
# Gathers the commit-range candidates for an epic — the inputs the
# archive-epic skill's "Find the units" step feeds to domains-from-diff.sh —
# and reports them for a human to confirm. It never silently resolves an
# ambiguous case: some epics' history is genuinely not clean (a shared
# boundary commit between two epics, or a squash-merge that interleaves two
# epics' work in one commit), and picking a side automatically would corrupt
# which units get flagged for KNOWLEDGE.md updates downstream.
#
# Resolution order — main is checked first because it's authoritative for any
# epic that has already merged; branch-divergence is only a fallback for an
# epic with zero presence on main yet (genuinely still in progress). Checking
# the current branch first would be wrong: an already-merged epic's own
# commits are ancestors of main and can never appear in `main..HEAD`, so
# anything a branch-first check finds there is necessarily unrelated noise
# (a different in-progress task's commits sitting on whatever branch is
# checked out), not remaining work for the epic being asked about.
#   1. History-scan (main only). Walks every commit reachable from main that
#      touches `.agents/changelogs/<EP>--*`, oldest to newest, and for each
#      one records whether it also touches ANOTHER epic's changelog folder
#      (entanglement) and whether it's a revert. A suggested range is still
#      computed (excluding reverts), but the full candidate list is always
#      returned alongside it.
#   2. Branch-divergence (cheap, exact) — only when step 1 finds nothing on
#      main at all. If the current branch has commits beyond main that touch
#      this epic's folder, use `git merge-base main HEAD` / HEAD directly.
#      The caller is trusted to run this from the branch that actually holds
#      the epic; the branch name isn't checked.
#
# status: firm           no anomalies — suggested range is safe to use as-is.
#         indeterminate  anomalies found (see flags) — a human should pick
#                         the range from the candidate list, not trust the
#                         suggestion blindly.
#         not_found      no commits reference this epic's changelog folder.
#
# Usage:
#   epic-commit-range.sh <EP_NUMBER>     e.g. epic-commit-range.sh EP26
#
# Output (stdout, key: value lines + one `candidate:` line per commit):
#   epic: <EP##>
#   status: firm | indeterminate | not_found
#   source: branch-divergence | history-scan
#   suggested_first_commit: <sha>
#   suggested_last_commit: <sha>
#   suggested_diff_range: <first>^ <last>
#   flags: comma-separated, empty if none
#   candidate: <sha> <date> is_add=<yes|no> is_revert=<yes|no> also_touches=<EP##,...> subject=<subject>
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec node "$DIR/lib/epic-commit-range.mjs" "$@"
