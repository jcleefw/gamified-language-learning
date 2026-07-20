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

if [[ $# -ne 1 || -z "$1" ]]; then
  echo "Usage: epic-commit-range.sh <EP_NUMBER>" >&2
  exit 1
fi

EP="$1"
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
PATHSPEC=".agents/changelogs/${EP}--*"

emit_flags() {
  local IFS=','
  echo "flags: ${*:-}"
}

# ── Path 1: history-scan — main only. archive-epic is a post-merge rollup,
# so an epic's canonical history is whatever landed on main; commits that
# exist only on some other unmerged branch (this tool's own or anyone
# else's in-progress work) aren't part of that epic's story. ───────────────
mapfile -t SHAS < <(git -C "$ROOT" log main --reverse --format='%H' -- "$PATHSPEC")

if [[ ${#SHAS[@]} -eq 0 ]]; then
  # ── Path 2: branch-divergence — only reachable when main has no trace of
  # this epic at all, i.e. it may still be in progress. ────────────────────
  BRANCH="$(git -C "$ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")"
  if [[ "$BRANCH" != "main" && -n "$BRANCH" ]] && git -C "$ROOT" show-ref --verify --quiet refs/heads/main; then
    BASE="$(git -C "$ROOT" merge-base main HEAD)"
    TIP="$(git -C "$ROOT" rev-parse HEAD)"
    if [[ "$BASE" != "$TIP" ]] && [[ -n "$(git -C "$ROOT" log --format='%H' "${BASE}..${TIP}" -- "$PATHSPEC")" ]]; then
      echo "epic: ${EP}"
      echo "status: firm"
      echo "source: branch-divergence"
      echo "suggested_first_commit: ${BASE}"
      echo "suggested_last_commit: ${TIP}"
      echo "suggested_diff_range: ${BASE}^ ${TIP}"
      emit_flags
      exit 0
    fi
  fi

  echo "epic: ${EP}"
  echo "status: not_found"
  exit 0
fi

declare -a CLEAN_SHAS=()
FLAG_ENTANGLED=0
FLAG_REVERT=0
FLAG_NO_MERGE_MARKER=1
declare -a CANDIDATE_LINES=()

for sha in "${SHAS[@]}"; do
  date="$(git -C "$ROOT" log -1 --format='%ad' --date=short "$sha")"
  subject="$(git -C "$ROOT" log -1 --format='%s' "$sha")"

  is_add="no"
  [[ -n "$(git -C "$ROOT" show --diff-filter=A --name-only --format='' "$sha" -- "$PATHSPEC")" ]] && is_add="yes"

  is_revert="no"
  [[ "$subject" =~ ^Revert ]] && is_revert="yes"

  also_touches="$(
    git -C "$ROOT" show --name-only --format='' "$sha" \
      | grep -oE '^\.agents/changelogs/EP[0-9]+' \
      | grep -oE 'EP[0-9]+' \
      | sort -u \
      | grep -v -x "$EP" \
      | paste -sd',' - || true
  )"

  [[ -n "$also_touches" ]] && FLAG_ENTANGLED=1
  [[ "$is_revert" == "yes" ]] && FLAG_REVERT=1
  [[ "$subject" =~ (Merge\ pull\ request\ #[0-9]+|\(#[0-9]+\)$) ]] && FLAG_NO_MERGE_MARKER=0

  [[ "$is_revert" == "no" ]] && CLEAN_SHAS+=("$sha")

  CANDIDATE_LINES+=("candidate: ${sha} ${date} is_add=${is_add} is_revert=${is_revert} also_touches=${also_touches} subject=${subject}")
done

SUGGESTED_FIRST=""
SUGGESTED_LAST=""
if [[ ${#CLEAN_SHAS[@]} -gt 0 ]]; then
  SUGGESTED_FIRST="${CLEAN_SHAS[0]}"
  SUGGESTED_LAST="${CLEAN_SHAS[-1]}"
fi

# ── Prior archive check ──────────────────────────────────────────────────────
ALREADY_ARCHIVED=0
ARCHIVE_REVERTED=0
ARCHIVE_HIT="$(
  git -C "$ROOT" log main --format='%H %s' \
    | grep -E '^\S+ docs\(archive\):' \
    | grep -i "${EP}" \
    || true
)"
if [[ -n "$ARCHIVE_HIT" ]]; then
  ALREADY_ARCHIVED=1
  REVERT_HIT="$(
    git -C "$ROOT" log main --format='%H %s' \
      | grep -E '^\S+ Revert "docs\(archive\)' \
      | grep -i "${EP}" \
      || true
  )"
  [[ -n "$REVERT_HIT" ]] && ARCHIVE_REVERTED=1
fi

declare -a FLAGS=()
[[ $FLAG_ENTANGLED -eq 1 ]] && FLAGS+=("entangled_commits_present")
[[ $FLAG_REVERT -eq 1 ]] && FLAGS+=("revert_commit_present")
[[ $FLAG_NO_MERGE_MARKER -eq 1 ]] && FLAGS+=("no_merge_marker_found")
[[ $ALREADY_ARCHIVED -eq 1 ]] && FLAGS+=("already_archived")
[[ $ARCHIVE_REVERTED -eq 1 ]] && FLAGS+=("archive_was_reverted")

STATUS="firm"
[[ ${#FLAGS[@]} -gt 0 ]] && STATUS="indeterminate"

echo "epic: ${EP}"
echo "status: ${STATUS}"
echo "source: history-scan"
echo "suggested_first_commit: ${SUGGESTED_FIRST}"
echo "suggested_last_commit: ${SUGGESTED_LAST}"
echo "suggested_diff_range: ${SUGGESTED_FIRST}^ ${SUGGESTED_LAST}"
emit_flags "${FLAGS[@]}"
printf '%s\n' "${CANDIDATE_LINES[@]}"
