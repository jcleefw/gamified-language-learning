#!/bin/bash

# .agents/tools/generate-filename.sh
# Ensures timestamp is consistent every time according to file naming convention in RULES.md and WORKFLOW.md

# Usage: .agents/tools/generate-filename.sh <PREFIX> <SLUG>
# Example: .agents/tools/generate-filename.sh EP01 userAuthFlow
# Result: 20260321T101450Z-EP01-user-auth-flow.md

PREFIX=$1
SLUG=$2

if [ -z "$PREFIX" ] || [ -z "$SLUG" ]; then
    echo "Error: Missing arguments." >&2
    echo "Usage: $0 <PREFIX> <SLUG>" >&2
    exit 1
fi

# 1. Generate Timestamp (UTC+10 fixed according to WORKFLOW.md)
# Note: Etc/GMT-10 is POSIX standard for UTC+10
TIMESTAMP=$(.agents/tools/generate-timestamp.sh)

# 2. Convert SLUG from camelCase to kebab-case
# Replace uppercase with hyphen and lowercase, then remove leading hyphen if any
KEBAB_SLUG=$(echo "$SLUG" | sed 's/\([A-Z]\)/-\1/g' | tr '[:upper:]' '[:lower:]' | sed 's/^-//')

# 3. Output the formatted filename
echo "${TIMESTAMP}-${PREFIX}-${KEBAB_SLUG}.md"
