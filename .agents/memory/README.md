# Memory System

Persistent cross-session context storage for AI agents.

**Location**: `.agents/memory/EP##--slug/`

**Epic-per-memory strategy**: Each epic has its own memory folder. Memory persists across all sessions and branches working on that epic.

---

## Memory Files

Each epic has four memory files:

### 1. `current-focus.md`

**What**: Your active work within the epic
**When Updated**: After completing a story or when changing focus
**What to Read**: Session start (tells you where you left off)

Contents:

- Active epic and story
- Current status
- Last session outcome
- Immediate next steps

### 2. `recent-decisions.md`

**What**: Architecture and technical decisions made on this epic
**When Updated**: When a decision is made that affects multiple stories
**What to Read**: When designing features or reviewing PRs

Contents:

- Decision title and timestamp
- Context (why the decision was needed)
- Decision and rationale
- Alternatives considered
- Impact and related ADRs

### 3. `blocked-items.md`

**What**: Known blockers and resolution history
**When Updated**: When blockers are identified or resolve

Contents:

- Current blockers (story, root cause, what's needed)
- Unblocking history (resolved blockers)

### 4. `session-log.md`

**What**: Summary of last session on this epic
**When Updated**: End of each session
**What to Read**: When starting a new session or onboarding

Contents:

- Per-session summaries (goal, completed, blockers)
- Files modified
- Session statistics
- Next session guidance

---

## Epic Memory Strategy

### During Active Development

1. Identify your epic: `EP##--slug` (from the branch, git log, or ask the user)
2. Read `.agents/memory/EP##--slug/current-focus.md` at session start
3. Update memory files as you progress (see trigger points in `RULES.md §Memory Protocol`)
4. At session end, update `session-log.md`

### When Epic Completes and Archives

When the epic is archived/compacted post-merge, the memory folder may be consolidated or archived alongside the epic's changelog — but this is deferred to future automation. For now, memory folders persist indefinitely.

### Session Start Checklist

```
1. Identify your epic (EP##--slug) — from git branch, log, or ask user
2. cat .agents/memory/EP##--slug/current-focus.md
3. Read RULES.md
4. Read PLAYBOOK.md
5. Navigate to your current story
```

---

## Golden Rules

1. **Memory is not code** — It's narrative, not documentation
2. **Be specific** — "Fixed mastery calculation for lapsed words" not "Fixed bug"
3. **Link to work items** — Reference EP##, ST##, BUG##, etc.
4. **Keep it fresh** — Update memory as you discover things, not at session end
5. **Clean up stale items** — Remove resolved blockers, old decisions
