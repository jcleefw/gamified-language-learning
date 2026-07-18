#!/usr/bin/env bash
# .agents/tools/archive-check.sh
# Integrity guard for the two-axis knowledge architecture. Enforces the cross-axis
# invariants (Two-Axis D5/D9/D10) on demand — there is no schedule (this project
# has no milestone concept, D10). Run it after a rollup, in CI, or by hand.
#
# Invariants enforced:
#   1. index.json validates against schema.json.
#   2. Every `sources` id in any KNOWLEDGE.md resolves to an archive epic/story (D5).
#   3. No archived epic keeps a live changelogs/<EP##>--*/ folder (D10);
#      no archived AGN## keeps a live plans/AGN##-*.md plan (D11).
#   4. No _loose/ entry lacks a `domain` + a `fixes`/`relates` reference (D9).
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
