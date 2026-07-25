#!/usr/bin/env bash
# .agents/tools/domains-from-diff.sh
# Routes changed paths to workspace units deterministically.
#
# The domain taxonomy is pnpm-workspace.yaml: every apps/* and packages/* is a
# domain. This script never hardcodes the unit list — it reads globs from
# pnpm-workspace.yaml, so adding a package automatically includes it with zero
# edits here. Paths in, workspace units out.
#
# Usage:
#   domains-from-diff.sh <git-diff-args>...     # passed to `git diff --name-only`
#                                               #   HEAD | main...HEAD | <sha>^ <sha> | A..B
#   domains-from-diff.sh --files <path>...      # explicit path list (no git)
#   printf '%s\n' <path>... | domains-from-diff.sh --stdin
#
# Output (stdout): one distinct domain per line, workspace units sorted first:
#   apps/<x> | packages/<x>            an in-workspace unit that was touched
#   <non-workspace>                    emitted once if any path lies outside all
#                                      workspace units (root config, .agents/,
#                                      product-documentation/, docs/…). The caller
#                                      supplies what this domain name is (e.g.,
#                                      "agentic/<ryoiki>" or a repo-level ryoiki);
#                                      this router identifies only the fact that
#                                      it's outside workspace, never assigns it.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec node "$DIR/lib/domains-from-diff.mjs" "$@"
