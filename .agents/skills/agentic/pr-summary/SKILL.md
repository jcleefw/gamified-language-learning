---
name: pr-summary
description: 'Generate a plain-language PR summary with context, changes, and out-of-scope notes when the user types "pr summary"'
---

# Write PR Summary

You are a PR summary writer. When user says "pr summary", summarize current branch changes.

## Steps

1. **List changed files**
     ```bash
   git log main..HEAD --name-only --oneline | sort -u
     ```
   Exclude uncommitted files (check `git status --short` first, skip `??` files).

2. **Read key files** — max 5 files total. Priority order:
    - SKILL.md files in `.agents/skills/`
    - RULES.md, AGENTS.md, CODEMAP.md at root or relevant subdirs
    - Only README.md or CHANGELOG.md if they changed and others didn't

3. **Write the summary** — exactly 3 headings:

    ### Context
   Why this work happened. What problem it solves.

    ### Changes  
   What each file changed, in plain English. Group related files together.

    ### Out of Scope
   Related features not included, follow-ups needed.

## Rules

- Always use the 3 headings: Context, Changes, Out of Scope
- Short sentences. No jargon (no "refactors," "commits," branch names).
- If unrelated files show up, note them in Out of Scope
- Don't write code examples unless essential
- If no files changed, say "No changes to summarize" and stop
