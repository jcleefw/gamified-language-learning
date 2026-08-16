#!/usr/bin/env bash
# .agents/tools/write-ryoiki.sh
# Standalone id -> ryoiki writer for index.json. NOT an archive step (no
# commit-range resolution, no draft/confirm lifecycle) — writes an
# already-decided mapping (e.g. from a verified epic-summary report)
# directly by id. Creates a new entry outright if the id doesn't already
# exist in index.json (using whatever fields are supplied), or patches
# just `ryoiki` if it does. See AGN08.
#
# Usage:
#   write-ryoiki.sh --data -   # JSON array of {id, ryoiki, ...} on stdin
#   write-ryoiki.sh --data path/to/mapping.json
#
# Each entry needs at least {id, ryoiki}. For a new id, also pass
# {summary, domain, title?, completed?, duration?, pr?, compact_pr?} —
# anything omitted is filled with a placeholder (undetermined/null).
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec node "$DIR/lib/write-ryoiki.mjs" "$@"
