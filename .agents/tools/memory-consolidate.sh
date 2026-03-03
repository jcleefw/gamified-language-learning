#!/bin/bash
# memory-consolidate.sh
# Consolidates memory from a feature branch into main (or target branch)
# Usage: ./.agents/tools/memory-consolidate.sh [target-branch]
# Example: ./.agents/tools/memory-consolidate.sh main

set -e

TARGET_BRANCH="${1:-main}"
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
MEMORY_DIR=".agents/memory"
TIMESTAMP=$(date -u +"%Y%m%dT%H%M%SZ")

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}Memory Consolidation Tool${NC}"
echo "Consolidating from: $CURRENT_BRANCH → $TARGET_BRANCH"
echo ""

# Check if we're consolidating from a feature branch
if [ "$CURRENT_BRANCH" == "$TARGET_BRANCH" ]; then
  echo -e "${YELLOW}⚠️  Already on $TARGET_BRANCH. Consolidation not needed.${NC}"
  exit 0
fi

# Verify memory directories exist
if [ ! -d "$MEMORY_DIR/$CURRENT_BRANCH" ]; then
  echo -e "${YELLOW}⚠️  No memory folder for branch '$CURRENT_BRANCH'. Creating empty one.${NC}"
  mkdir -p "$MEMORY_DIR/$CURRENT_BRANCH"
  touch "$MEMORY_DIR/$CURRENT_BRANCH/.gitkeep"
fi

if [ ! -d "$MEMORY_DIR/$TARGET_BRANCH" ]; then
  echo -e "${YELLOW}⚠️  No memory folder for target branch '$TARGET_BRANCH'. Creating.${NC}"
  mkdir -p "$MEMORY_DIR/$TARGET_BRANCH"
  cp "$MEMORY_DIR/$CURRENT_BRANCH"/*.md "$MEMORY_DIR/$TARGET_BRANCH/" 2>/dev/null || true
fi

# Consolidation logic
echo -e "${BLUE}Consolidating memory files:${NC}"

# 1. Merge recent-decisions.md
if [ -f "$MEMORY_DIR/$CURRENT_BRANCH/recent-decisions.md" ]; then
  echo "  ✓ Consolidating decisions..."

  # Extract new decisions from branch and append to target
  tail -n +10 "$MEMORY_DIR/$CURRENT_BRANCH/recent-decisions.md" >> "$MEMORY_DIR/$TARGET_BRANCH/recent-decisions.md" 2>/dev/null || true
fi

# 2. Update current-focus.md
if [ -f "$MEMORY_DIR/$CURRENT_BRANCH/current-focus.md" ]; then
  echo "  ✓ Updating current focus..."

  # Extract the last session's outcome and add to target
  cp "$MEMORY_DIR/$CURRENT_BRANCH/current-focus.md" "$MEMORY_DIR/$TARGET_BRANCH/current-focus.md"
fi

# 3. Merge session-log.md
if [ -f "$MEMORY_DIR/$CURRENT_BRANCH/session-log.md" ]; then
  echo "  ✓ Merging session logs..."

  tail -n +12 "$MEMORY_DIR/$CURRENT_BRANCH/session-log.md" >> "$MEMORY_DIR/$TARGET_BRANCH/session-log.md" 2>/dev/null || true
fi

# 4. Clear blocked-items if any are resolved
if [ -f "$MEMORY_DIR/$CURRENT_BRANCH/blocked-items.md" ]; then
  echo "  ✓ Reviewing blockers..."

  # This is a manual step — agent should review and clean up
  echo "    (Review blocked-items.md manually for resolved items)"
fi

# Create consolidation record
echo ""
echo -e "${BLUE}Creating consolidation record:${NC}"

CONSOLIDATION_FILE="$MEMORY_DIR/$TARGET_BRANCH/$TIMESTAMP-consolidated-from-$CURRENT_BRANCH.md"

cat > "$CONSOLIDATION_FILE" << EOF
# Memory Consolidation Record

**From Branch**: $CURRENT_BRANCH
**To Branch**: $TARGET_BRANCH
**Timestamp**: $TIMESTAMP
**Merged By**: ${USER:-AI Agent}

## Changes Consolidated

- Recent decisions from $CURRENT_BRANCH appended to main decisions
- Current focus updated from $CURRENT_BRANCH
- Session logs merged
- Blocked items reviewed

## Files Processed

- $MEMORY_DIR/$CURRENT_BRANCH/recent-decisions.md
- $MEMORY_DIR/$CURRENT_BRANCH/current-focus.md
- $MEMORY_DIR/$CURRENT_BRANCH/session-log.md
- $MEMORY_DIR/$CURRENT_BRANCH/blocked-items.md

## Next Steps

1. Review \`$MEMORY_DIR/$TARGET_BRANCH/blocked-items.md\` for any unresolved blockers
2. Update \`$MEMORY_DIR/$TARGET_BRANCH/current-focus.md\` with next work
3. Clean up \`$MEMORY_DIR/$CURRENT_BRANCH/\` if branch is being deleted

---

*Automated consolidation for memory branch strategy*
EOF

echo -e "  ✓ Created: $CONSOLIDATION_FILE"

# Summary
echo ""
echo -e "${GREEN}✅ Memory consolidation complete!${NC}"
echo ""
echo "Memory location: $MEMORY_DIR/$TARGET_BRANCH"
echo ""
echo "Next steps:"
echo "  1. Review consolidated decisions and blockers"
echo "  2. Update current-focus.md with next work"
echo "  3. Commit memory updates: git add $MEMORY_DIR && git commit -m 'chore: consolidate memory from $CURRENT_BRANCH'"
echo "  4. If deleting feature branch: you can clean up $MEMORY_DIR/$CURRENT_BRANCH"
echo ""
