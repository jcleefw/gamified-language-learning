#!/usr/bin/env bash
# .agents/tools/archive-append.sh
# Append one story (and/or upsert one epic rollup) to the archive time axis
# (Two-Axis D4), schema-validated. Never writes partial or invalid JSON: the
# story is validated against the schema's story shape, the whole index is
# re-validated after mutation, and the file is only written if both pass.
#
# Stories are kept ordered by `completed` — the organising key for playback (D9).
# Provenance is `pr` (integer); a commit-SHA-shaped value is rejected by the
# schema (D4).
#
# Usage:
#   archive-append.sh --story <file|->                       # append a story
#   archive-append.sh --story <file|-> --replace             # replace by id (idempotent re-runs)
#   archive-append.sh --epic EP44 --data <file|->            # upsert an epic rollup
#   archive-append.sh --story s.json --epic EP44 --data e.json   # both at once
#
# Options:
#   --index <path>   archive index (default .agents/changelogs/archive/index.json)
#   --schema <path>  schema         (default .agents/changelogs/archive/schema.json)
#
# Exit 0 on success; non-zero (index untouched) on any validation failure.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec node "$DIR/lib/archive-append.mjs" "$@"
