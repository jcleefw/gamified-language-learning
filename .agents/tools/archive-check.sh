#!/usr/bin/env bash
# .agents/tools/archive-check.sh
# Validates archive integrity: ensures index.json matches schema, all knowledge
# references resolve to valid archived stories, and cleanup invariants hold.
#
# Invariants enforced:
#   1. index.json validates against schema.json.
#   2. Every `sources` id in any KNOWLEDGE.md resolves to an archived epic/story.
#   3. No archived epic retains a live changelogs/<EP##>--*/ folder;
#      no archived AGN## retains a live plans/AGN##-*.md plan.
#   4. Every _loose/ entry has both a `domain` and a `fixes`/`relates` reference.
#
# Usage:
#   archive-check.sh                 # check the repo (root = git toplevel)
#   archive-check.sh --root <dir>    # check an alternate tree (used in tests)
#
# Exit 0 = clean; exit 1 = one or more invariants violated (details on stderr).
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DEFAULT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

# Inject a default --root if the caller didn't pass one.
has_root=0
for a in "$@"; do [[ "$a" == "--root" ]] && has_root=1; done
if [[ $has_root -eq 0 ]]; then
  exec node "$DIR/lib/archive-check.mjs" --root "$ROOT_DEFAULT" "$@"
else
  exec node "$DIR/lib/archive-check.mjs" "$@"
fi
