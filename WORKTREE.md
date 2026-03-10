# WORKTREE.md

**Read this if you are working in a directory that is NOT the main project root.**

---

## What Is a Worktree?

A git worktree is an isolated working directory attached to the same git repository but checked out on a **different branch**. Each worktree has its own files on disk — changes in one worktree do not appear in another.

This project uses worktrees to run multiple epics **in parallel**. Each worktree = one epic = one feature branch = one Claude session.

---

## Step 0 — Orient Yourself First (Before Doing Anything)

Run these two commands at the start of every session:

```bash
git worktree list              # shows all worktrees and their branches
git rev-parse --abbrev-ref HEAD  # confirms which branch YOU are on
```

Example output:

```
/path/to/project                     [main]          ← coordination window (human)
/path/to/project/.worktrees/ep05     [feature/EP05-srs-active-window-stuck-words]  ← your window
/path/to/project/.worktrees/ep06     [feature/EP06-srs-foundational-deck]          ← another agent
```

If your branch is `feature/EP05-...`, your epic is EP05. Go read `.agents/memory/feature/EP05-.../current-focus.md`.

---

## The Invariants (Never Break These)

### 1. You are already on the right branch. Do not create another one.

```bash
# WRONG — agent creates a new branch from inside a worktree
git checkout -b feature/EP05-ST01-something

# RIGHT — you are already on feature/EP05-srs-active-window-stuck-words
# just start working
```

### 2. Your memory folder is the feature branch folder, not `main/`.

```bash
# WRONG
.agents/memory/main/current-focus.md

# RIGHT
.agents/memory/feature/EP05-srs-active-window-stuck-words/current-focus.md
```

The folder name matches your branch name exactly. If the folder doesn't exist yet, create it.

### 3. You own exactly the files listed in your epic plan. Touch nothing else.

Other worktrees are running parallel epics on other branches. Even though the files look present in your directory (because worktrees share git history), **do not edit files belonging to other epics**. Check your epic plan's file ownership section if unsure.

### 4. Your job ends at PR creation. The human merges.

```
ALLOWED:   git add
ALLOWED:   git commit
ALLOWED:   git push origin <your-branch>
ALLOWED:   gh pr create   →  STOP after this
FORBIDDEN: git checkout main
FORBIDDEN: git merge
FORBIDDEN: gh pr merge
FORBIDDEN: git branch -D / git reset --hard (without explicit human instruction)
```

After `gh pr create`, say: "PR is open at [URL]. Waiting for your review and merge." Then stop.

---

## Session Workflow

```
START
  │
  ├─ git worktree list → confirm you're in a worktree
  ├─ git rev-parse --abbrev-ref HEAD → confirm your branch
  ├─ cat .agents/memory/feature/{your-branch}/current-focus.md → where you left off
  ├─ read RULES.md
  │
  ▼
WORK (stories, TDD, CODEMAP, changelog, memory updates)
  │
  ├─ Write memory to:  .agents/memory/feature/{your-branch}/
  ├─ NOT to:           .agents/memory/main/
  │
  ▼
DONE WITH EPIC
  │
  ├─ git push origin {your-branch}
  ├─ gh pr create --base main --head {your-branch}
  └─ STOP. Notify human.
```

---

## Worktree ↔ Epic ↔ Branch Map

| Worktree path        | Branch                                       | Epic                                       |
| -------------------- | -------------------------------------------- | ------------------------------------------ |
| `.worktrees/ep05`    | `feature/EP05-srs-active-window-stuck-words` | EP05 — Active Window + Stuck Words         |
| `.worktrees/ep06`    | `feature/EP06-srs-foundational-deck`         | EP06 — Foundational Deck                   |
| _(main project dir)_ | `main`                                       | Coordination only — no implementation here |

> Update this table when new worktrees are created.

---

## Common Mistakes and Fixes

### "I can't find my memory file"

Your memory folder is `.agents/memory/feature/{your-full-branch-name}/`. Run `git rev-parse --abbrev-ref HEAD` to get the exact branch name. The folder must match exactly.

### "Should I create a new branch for each story?"

No. One worktree = one branch = one epic. All stories within the epic commit to the same feature branch. Story separation is via commit messages, not branches.

### "git checkout main says 'branch already checked out'"

Correct — main is locked to the main project directory. You cannot and should not check it out in a worktree. Stay on your feature branch.

### "I finished the epic. What do I push?"

Push your feature branch: `git push origin $(git rev-parse --abbrev-ref HEAD)`. Then create the PR. Do not push to main.

### "There are files from another epic in my directory"

Because worktrees share git history, you can see files committed to other branches only after those PRs are merged to main. Do not copy, edit, or delete them.

---

## How Worktrees Are Created (Human Only)

Only the human creates worktrees. Agents do not create worktrees.

```bash
# Human runs from main project directory:
git worktree add .worktrees/ep05 -b feature/EP05-srs-active-window-stuck-words
git worktree add .worktrees/ep06 -b feature/EP06-srs-foundational-deck
```

Each worktree is then opened in a separate terminal/VSCode window and a separate Claude session.

---

## How to Tell You Are NOT in a Worktree

If `git worktree list` shows only one entry (the main project dir), you are working serially on main. The worktree rules do not apply — follow the standard workflow in `RULES.md §Story Completion Protocol (On main)`.
