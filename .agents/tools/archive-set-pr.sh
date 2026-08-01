#!/usr/bin/env bash
# .agents/tools/archive-set-pr.sh
# Bulk PR backfill: find all stories in an epic with pr: null, set pr: [number].
# Schema-validated; exits 0 on success, non-zero (index untouched) on validation failure.
#
# Usage:
#   archive-set-pr.sh --epic EP08 --pr 8
#
# Options:
#   --index <path>   archive index (default .agents/changelogs/archive/index.json)
#   --schema <path>  schema         (default .agents/changelogs/archive/schema.json)
#
# Exit 0 on success; non-zero (index untouched) on any validation failure.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec node "$DIR/lib/archive-set-pr.mjs" "$@"
