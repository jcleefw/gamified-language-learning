#!/usr/bin/env bash
# .agents/tools/archive-append.sh
# Appends a story and/or upserts an epic rollup to the archive, schema-validated.
# Never writes partial or invalid JSON: the story is validated against the schema,
# the whole index is re-validated after mutation, and the file is only written
# if both pass.
#
# Stories are ordered by `completed` timestamp. Provenance must be a PR number
# (integer); commit-SHA-shaped values are rejected by schema validation.
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
