# Memory System

Persistent cross-session context storage for AI agents.

**Location**: `.agents/memory/{branch}/`

**Branch-per-memory strategy**: Each git branch has its own memory folder. Memory is consolidated when merging.

---

## Memory Files

Each branch has four memory files:

### 1. `current-focus.md`
**What**: Your active work
**When Updated**: After completing a story or when changing focus
**What to Read**: Session start (tells you where you left off)

Contents:
- Active epic and story
- Current status
- Last session outcome
- Immediate next steps

### 2. `recent-decisions.md`
**What**: Architecture and technical decisions made on this branch
**When Updated**: When a decision is made that affects multiple stories
**What to Read**: When designing features or reviewing PRs

Contents:
- Decision title and timestamp
- Context (why the decision was needed)
- Decision and rationale
- Alternatives considered
- Impact and related ADRs

### 3. `blocked-items.md`
**What**: Issues blocking progress
**When Updated**: As soon as a blocker is identified
**What to Read**: When you need to know what's stuck

Contents:
- Current blockers (story, root cause, what's needed)
- Unblocking history (resolved blockers)

### 4. `session-log.md`
**What**: Summary of all sessions on this branch
**When Updated**: End of each session
**What to Read**: When starting a new session or onboarding

Contents:
- Per-session summaries (goal, completed, blockers)
- Files modified
- Session statistics
- Next session guidance

---

## Branch Memory Strategy

### Feature Branch (e.g., `feature-auth`)
1. Create `.agents/memory/feature-auth/` with same structure as `main/`
2. Work on stories, updating memory files
3. When ready to merge: run consolidation script
4. Memory from feature branch merges into `main/`

### Main Branch
- Accumulates consolidated memory from all merged branches
- Single source of truth for project-wide decisions
- Preserved indefinitely

### Session Start Checklist

```
1. git status → which branch?
2. cat .agents/memory/{branch}/current-focus.md
3. Read RULES.md
4. Read PLAYBOOK.md
5. Navigate to your current story
```

---

## Memory Consolidation

**When**: Before or after merging a feature branch to main
**How**: `.agents/tools/memory-consolidate.sh main`

**What It Does**:
1. Merges decisions from feature branch into main's decision log
2. Updates current-focus.md with branch's last state
3. Merges session logs
4. Creates a consolidation record
5. Leaves branch memory intact (can be deleted later)

**Consolidation Record**: `.agents/memory/main/TIMESTAMP-consolidated-from-{branch}.md`
- Documents what was consolidated
- Timestamp for traceability

---

## Example Workflow

### Day 1: Feature Development
```bash
git checkout -b feature-user-auth
# (memory auto-created at .agents/memory/feature-user-auth/)

# Implement EP01-ST01
# ... complete story ...
# Update .agents/memory/feature-user-auth/current-focus.md

# End of session
# Update .agents/memory/feature-user-auth/session-log.md
```

### Day 2: Continue Feature
```bash
git checkout feature-user-auth
cat .agents/memory/feature-user-auth/current-focus.md  # ← What were you doing?

# Implement EP01-ST02
# ... complete story ...
# Update memory files
```

### Day 3: Merge to Main
```bash
git checkout main
git merge feature-user-auth

# Consolidate memory
.agents/tools/memory-consolidate.sh main

# Review merged decisions and blockers
cat .agents/memory/main/recent-decisions.md
cat .agents/memory/main/current-focus.md

# Commit memory updates
git add .agents/memory/main
git commit -m "chore: consolidate memory from feature-user-auth"

# Optional: Delete feature branch memory
rm -rf .agents/memory/feature-user-auth
```

---

## Consolidation Mechanics

### Decision Consolidation
```
feature-user-auth/recent-decisions.md
     ↓
    [Extract new decisions]
     ↓
main/recent-decisions.md [APPEND]
```

### Current Focus Update
```
feature-user-auth/current-focus.md
     ↓
    [Copy entire file]
     ↓
main/current-focus.md [OVERWRITE with last state]
```

### Session Log Merge
```
feature-user-auth/session-log.md
     ↓
    [Extract sessions]
     ↓
main/session-log.md [APPEND]
```

### Blocked Items
```
feature-user-auth/blocked-items.md
     ↓
    [Manual review]
     ↓
main/blocked-items.md [UNBLOCKING HISTORY updated when resolved]
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
# Before restarting work on a branch
rm -rf .agents/memory/{branch}
# Re-create from main
mkdir -p .agents/memory/{branch}
cp .agents/memory/main/*.md .agents/memory/{branch}/
```

### Clean Up Old Branch Memory
```bash
# After branch is deleted
rm -rf .agents/memory/old-branch-name
git add .agents/memory/
git commit -m "chore: clean up memory for deleted branch"
```

---

## Guidelines

### Updating Memory During Work

**current-focus.md**:
- Update after finishing a story
- Update if changing focus (e.g., switching to a blocker)

**recent-decisions.md**:
- Record decisions when they affect multiple stories
- Record immediately when decision is made (don't wait until EOD)

**blocked-items.md**:
- Record blockers as soon as identified
- Update when blockers are resolved

**session-log.md**:
- Log at end of session (5 minutes)
- Include what was done, what's in progress, next steps

### Reading Memory

**Session Start**: Always read `current-focus.md` first
**Design Phase**: Read `recent-decisions.md` to understand past choices
**Stuck**: Check `blocked-items.md` for known issues
**Onboarding**: Read `session-log.md` to understand recent work

### Golden Rules

1. **Memory is not code** — It's narrative, not documentation
2. **Be specific** — "Fixed mastery calculation for lapsed words" not "Fixed bug"
3. **Link to work items** — Reference EP##, ST##, BUG##, etc.
4. **Consolidate early** — Don't let branch memory drift too far from main
5. **Clean up stale memory** — Remove resolved blockers, old decisions

---

## Troubleshooting

**Q: Memory file doesn't exist for my branch**
A: Create it manually: `mkdir -p .agents/memory/{branch}` and copy templates from main

**Q: Consolidation created duplicate entries**
A: This is OK; the duplicates are harmless. Review and manually clean up if needed.

**Q: I deleted a branch but memory is still there**
A: Manually delete: `rm -rf .agents/memory/{old-branch-name}` and commit

**Q: What if I need to revert a merge?**
A: Revert the consolidation record (the TIMESTAMP file), not the memory files. Past memory is immutable once consolidated.

---

## Related Documentation

- [AGENT.md](../AGENT.md) — Bootstrap reading order includes memory check
- [PLAYBOOK.md](../PLAYBOOK.md) — Memory commands reference
- [RULES.md](../RULES.md) — Memory protocol requirements
