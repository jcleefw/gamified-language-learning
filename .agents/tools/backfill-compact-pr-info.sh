#!/usr/bin/env bash
# .agents/tools/backfill-compact-pr-info.sh
# Resolves the PR number of the commit that compacted a given epic's changelog
# folder, by searching git history for a commit message containing
# "compact <EP_NUMBER>". If that commit was brought in via a squash-merge
# ("Merge pull request #N"), the PR number is extracted from it.
#
# Usage:
#   backfill-compact-pr-info.sh <EP_NUMBER>     # e.g. backfill-compact-pr-info.sh EP01
#
# Output (stdout):
#   <integer>      the resolved PR number
#   undetermined   no matching commit, or no PR number found in it
set -euo pipefail

if [[ $# -ne 1 || -z "$1" ]]; then
  echo "Usage: backfill-compact-pr-info.sh <EP_NUMBER>" >&2
  exit 1
fi

EP_NUMBER="$1"
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

MATCH="$(git -C "$ROOT" log --all --grep="compact ${EP_NUMBER}" --format='%H %s%n%b' -- 2>/dev/null || true)"

if [[ -z "$MATCH" ]]; then
  echo "undetermined"
  exit 0
fi

PR_NUMBER="$(printf '%s\n' "$MATCH" | grep -oE 'Merge pull request #[0-9]+' | head -1 | grep -oE '[0-9]+' || true)"

if [[ -z "$PR_NUMBER" ]]; then
  echo "undetermined"
  exit 0
fi

echo "$PR_NUMBER"
