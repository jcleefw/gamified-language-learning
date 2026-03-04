# Memory Consolidation Guide

Instructions for consolidating branch memory into main.

---

## When to Consolidate

Before or after merging a feature branch to main.

## How

```bash
.agents/tools/memory-consolidate.sh main
```

**What It Does**:
1. Merges decisions from feature branch into main's decision log
2. Updates current-focus.md with branch's last state
3. Merges session logs
4. Creates a consolidation record
5. Leaves branch memory intact (can be deleted later)

**Consolidation Record**: `.agents/memory/main/TIMESTAMP-consolidated-from-{branch}.md`

---

## Consolidation Mechanics

### Decision Consolidation
```
feature-branch/recent-decisions.md
     ↓
    [Extract new decisions]
     ↓
main/recent-decisions.md [APPEND]
```

### Current Focus Update
```
feature-branch/current-focus.md
     ↓
    [Copy entire file]
     ↓
main/current-focus.md [OVERWRITE with last state]
```

### Session Log Merge
```
feature-branch/session-log.md
     ↓
    [Extract sessions]
     ↓
main/session-log.md [APPEND]
```

### Blocked Items
```
feature-branch/blocked-items.md
     ↓
    [Manual review]
     ↓
main/blocked-items.md [UNBLOCKING HISTORY updated when resolved]
```

---

## Example Workflow

### Day 1: Feature Development
```bash
git checkout -b feature-user-auth
# (memory auto-created at .agents/memory/feature-user-auth/)
# Implement stories, update memory files
```

### Day 2: Merge to Main
```bash
git checkout main
git merge feature-user-auth

# Consolidate memory
.agents/tools/memory-consolidate.sh main

# Commit memory updates
git add .agents/memory/main
git commit -m "chore: consolidate memory from feature-user-auth"

# Optional: Delete feature branch memory
rm -rf .agents/memory/feature-user-auth
```

---

## Manual Memory Management

### Create a New Branch Memory
```bash
mkdir -p .agents/memory/my-feature-branch
cp .agents/memory/main/*.md .agents/memory/my-feature-branch/
```

### Reset Branch Memory
```bash
rm -rf .agents/memory/{branch}
mkdir -p .agents/memory/{branch}
cp .agents/memory/main/*.md .agents/memory/{branch}/
```

### Clean Up Old Branch Memory
```bash
rm -rf .agents/memory/old-branch-name
git add .agents/memory/
git commit -m "chore: clean up memory for deleted branch"
```

---

## Troubleshooting

**Q: Memory file doesn't exist for my branch**
A: Create it manually: `mkdir -p .agents/memory/{branch}` and copy from main.

**Q: Consolidation created duplicate entries**
A: Harmless. Review and manually clean up if needed.

**Q: I deleted a branch but memory is still there**
A: Manually delete: `rm -rf .agents/memory/{old-branch-name}` and commit.

**Q: What if I need to revert a merge?**
A: Revert the consolidation record (the TIMESTAMP file), not the memory files.
