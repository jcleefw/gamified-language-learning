#!/usr/bin/env bash
# .agents/tools/archive-set-completed.sh
# Bulk completion-date fixup: overwrite `completed` for every story in an epic.
# Schema-validated; exits 0 on success, non-zero (index untouched) on validation failure.
#
# Usage:
#   archive-set-completed.sh --epic EP20 --date 2026-03-22
#
# Options:
#   --index <path>   archive index (default .agents/changelogs/archive/index.json)
#   --schema <path>  schema         (default .agents/changelogs/archive/schema.json)
#
# Exit 0 on success; non-zero (index untouched) on any validation failure.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec node "$DIR/lib/archive-set-completed.mjs" "$@"
