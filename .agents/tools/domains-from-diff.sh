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

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
WORKSPACE_FILE="$ROOT/pnpm-workspace.yaml"

if [[ ! -f "$WORKSPACE_FILE" ]]; then
  echo "Error: $WORKSPACE_FILE not found (needed for the domain taxonomy, D1)." >&2
  exit 1
fi

# ── Collect changed paths ────────────────────────────────────────────────────
declare -a FILES=()
if [[ "${1:-}" == "--files" ]]; then
  shift
  FILES=("$@")
elif [[ "${1:-}" == "--stdin" ]]; then
  while IFS= read -r line; do [[ -n "$line" ]] && FILES+=("$line"); done
else
  if [[ $# -eq 0 ]]; then
    echo "Error: no arguments. Pass git diff args, --files <paths>, or --stdin." >&2
    exit 2
  fi
  # Everything else is forwarded to git diff verbatim (ranges, refs, sha^ sha).
  while IFS= read -r line; do [[ -n "$line" ]] && FILES+=("$line"); done \
    < <(git -C "$ROOT" diff --name-only "$@")
fi

if [[ ${#FILES[@]} -eq 0 ]]; then
  exit 0  # nothing changed → no domains
fi

# ── Read workspace globs → literal prefixes ──────────────────────────────────
# Parse the `packages:` list from pnpm-workspace.yaml; the literal prefix of each
# glob (the part before `*`) is what we match paths against.
declare -a PREFIXES=()
while IFS= read -r glob; do
  [[ -z "$glob" ]] && continue
  PREFIXES+=("${glob%%\**}")   # 'packages/*' → 'packages/'
done < <(awk '
  /^[^[:space:]#]/ { insec = 0 }                       # any top-level key ends the section
  /^packages:[[:space:]]*$/ { insec = 1; next }
  insec && /^[[:space:]]*-[[:space:]]*/ {
    line = $0
    sub(/^[[:space:]]*-[[:space:]]*/, "", line)         # strip "- "
    gsub(/["'\'']/, "", line)                            # strip quotes
    sub(/[[:space:]]+$/, "", line)                       # strip trailing ws
    if (line != "") print line
  }
' "$WORKSPACE_FILE")

if [[ ${#PREFIXES[@]} -eq 0 ]]; then
  echo "Error: no package globs found under 'packages:' in $WORKSPACE_FILE." >&2
  exit 1
fi

# ── Route each path to a unit, or flag it non-workspace ──────────────────────
declare -a UNITS=()
NON_WORKSPACE=0
for file in "${FILES[@]}"; do
  matched=0
  for prefix in "${PREFIXES[@]}"; do
    if [[ -n "$prefix" && "$file" == "$prefix"* ]]; then
      rest="${file#"$prefix"}"     # 'srs-demo/src/App.vue'
      seg="${rest%%/*}"            # 'srs-demo'
      if [[ -n "$seg" ]]; then
        UNITS+=("${prefix}${seg}") # 'apps/srs-demo'
        matched=1
        break
      fi
    fi
  done
  [[ $matched -eq 0 ]] && NON_WORKSPACE=1
done

# ── Emit distinct domains: workspace units sorted, catch-all last ────────────
if [[ ${#UNITS[@]} -gt 0 ]]; then
  printf '%s\n' "${UNITS[@]}" | sort -u
fi
if [[ $NON_WORKSPACE -eq 1 ]]; then
  echo "<non-workspace>"
fi
