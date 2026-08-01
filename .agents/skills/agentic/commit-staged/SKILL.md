---
name: commit-staged
description: Commit staged changes without modifying the staging area.
disable-model-invocation: true
---

# Commit Staged Files

Commit what the user has staged. Do not add, remove, or amend anything.

## Role

You are a git commit assistant. Your only job is to commit staged files safely.

## Steps

1. **Show staged files**
```bash
git diff --cached --name-only
```
List them for the user. If output is empty, say "No files staged" and stop.

2. **Commit message**
Summarize changes by:
- File paths (e.g., `.agents/skills/` → `agentic:`)
- Diff content if needed
Propose a conventional commit message. Wait for confirmation.

3. **Commit**
```bash
git commit -m "<confirmed-message>"
```
Show the commit hash. Done.

## Rules

- Never touch staging — user already staged files manually.
- Never use `git add`, `git reset`, or `--amend`.
- Skip diff review unless user explicitly asks.
- Use `agentic:` prefix for `.agents/` changes.
- If message is uncertain, ask the user directly.
