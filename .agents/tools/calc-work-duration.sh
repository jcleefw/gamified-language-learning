#!/usr/bin/env bash
# .agents/tools/calc-work-duration.sh
# Calculate work duration from git history (first to last commit mentioning an epic/AGN ID)
# Usage: calc-work-duration.sh <EP##|AGN##>
# Output: duration string (e.g., "7h", "1d", "3d 5h") or "undetermined" if not found
set -euo pipefail

ID="${1:-}"
if [[ -z "$ID" ]]; then
  echo "Usage: calc-work-duration.sh <EP##|AGN##>" >&2
  exit 1
fi

# Find commits mentioning this ID
commits=$(git log --all --pretty=format:%H --grep="$ID" 2>/dev/null || true)
if [[ -z "$commits" ]]; then
  echo "undetermined"
  exit 0
fi

# First is last in the list (oldest), last is first (newest)
first_commit=$(echo "$commits" | tail -1)
last_commit=$(echo "$commits" | head -1)

# Get ISO timestamps
first_ts=$(git log "$first_commit" -1 --pretty=format:%aI 2>/dev/null || true)
last_ts=$(git log "$last_commit" -1 --pretty=format:%aI 2>/dev/null || true)

if [[ -z "$first_ts" ]] || [[ -z "$last_ts" ]]; then
  echo "undetermined"
  exit 0
fi

# Convert to Unix timestamps (handle macOS and Linux date command differences)
if date --version >/dev/null 2>&1; then
  # Linux
  first_secs=$(date -d "$first_ts" +%s 2>/dev/null || echo "")
  last_secs=$(date -d "$last_ts" +%s 2>/dev/null || echo "")
else
  # macOS: remove trailing colon from timezone for date -j
  first_iso="${first_ts%:*}${first_ts: -2}"
  last_iso="${last_ts%:*}${last_ts: -2}"
  first_secs=$(date -j -f "%Y-%m-%dT%H:%M:%S%z" "$first_iso" +%s 2>/dev/null || echo "")
  last_secs=$(date -j -f "%Y-%m-%dT%H:%M:%S%z" "$last_iso" +%s 2>/dev/null || echo "")
fi

if [[ -z "$first_secs" ]] || [[ -z "$last_secs" ]]; then
  echo "undetermined"
  exit 0
fi

# Calculate difference in seconds
diff=$((last_secs - first_secs))

# Handle negative (shouldn't happen, but be defensive)
if [[ $diff -lt 0 ]]; then
  echo "undetermined"
  exit 0
fi

# Convert to days, hours, minutes
days=$((diff / 86400))
remaining=$((diff % 86400))
hours=$((remaining / 3600))
minutes=$(((remaining % 3600) / 60))

# Format output
result=""
[[ $days -gt 0 ]] && result+="${days}d"
[[ $hours -gt 0 ]] && result+="${result:+ }${hours}h"
[[ $minutes -gt 0 ]] && result+="${result:+ }${minutes}m"

# If nothing, it was less than a minute
if [[ -z "$result" ]]; then
  echo "0h"
else
  echo "$result"
fi
