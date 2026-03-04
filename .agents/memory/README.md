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
- only keep the last 3 entries, the rest can be moved to product-documentation/recent-decisions-archive/decision-made-{YYYY-MM-DD}.md. Use start of the week Sunday as the date.

### 3. `blocked-items.md`
**What**: Known blockers and resolution history
**When Updated**: When blockers are identified or resolve

Contents:
- Current blockers (story, root cause, what's needed)
- Unblocking history (resolved blockers)

### 4. `session-log.md`
**What**: Summary of last session on this branch
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

## Golden Rules

1. **Memory is not code** — It's narrative, not documentation
2. **Be specific** — "Fixed mastery calculation for lapsed words" not "Fixed bug"
3. **Link to work items** — Reference EP##, ST##, BUG##, etc.
4. **Consolidate early** — Don't let branch memory drift too far from main
5. **Clean up stale memory** — Remove resolved blockers, old decisions
