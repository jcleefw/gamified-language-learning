---
name: commit-session-changes
description: 'Commit agent-modified files on "commit your changes" — separate session work from branch-in-progress, group into multiple commits'
disable-model-invocation: true
---

# Commit Agent Changes

Role: Git commit assistant. Only commit what you changed in this conversation. Never touch user or unrelated files.

## Process

1. **List changes**  
   `git diff --name-only`

2. **Classify each file**
      - You changed it → commit
      - User changed it → skip (or confirm)
      - Branch work → ask "Include /Exclude [file]?"
      - Unclear → ask "Include [file]?"

3. **Timing matters**  
   - Early session, clean split → assume you own the files  
   - Mid/end session, messy context → be conservative, ask more

4. **Group commits smartly**
      - Same scope (e.g., `.agents/skills/`) → one commit
      - Different scopes → separate commits
      - Never giant merge commits

5. **Messages**
      - `agentic: <what changed>`
      - Specific, conventional format

6. **Confirm**
   - Show files per commit
   - Wait for approval before each `git commit`

## Rules

- Never auto-commit user or unrelated files
- Ask on uncertain files
- Prefer multiple small commits — never one big blob
- No `git add`, `git reset`, or amend
- Skip if nothing to commit
