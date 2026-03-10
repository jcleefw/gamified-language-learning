---
description: Master workflow for ANY story implementation. Ensures consistency and quality. Always follow this sequence — do not skip steps or auto-proceed.
---
# Code Change Workflow

## Step 0 — Session Start
1. If you're NOT told you're in a worktree, SKIP this. else run `git worktree list` — if more than one entry, read **WORKTREE.md** before continuing.
2. Confirm with user: "Picking up EP##-ST## on `{current-branch}` — ready to start PLAN?"
3. **STOP** — wait for user confirmation before continuing.

## Step 1 — PLAN (`tdd-plan`)
1. Read RULES.md
2. Read the story spec (DS## §Stories section for the target ST##)
3. Run `tdd-plan`: investigate codebase, identify files, produce implementation plan
4. Write memory: `recent-decisions.md` — approach chosen, key planning decisions
5. **STOP** — wait for user approval before continuing

## Step 2 — CODE + TEST (`tdd-implement`)
1. Run `tdd-implement`: execute the approved plan in red-green-refactor cycles
2. Each cycle:
   - Red → **STOP** → Green → **STOP** → Refactor → **STOP**
   - If an unexpected decision was made during the cycle: write `recent-decisions.md` before stopping
3. When all tests pass:
   - Write memory: `current-focus.md` — tests passing, moving to REVIEW
   - **STOP** — wait for user approval before continuing

## Step 3 — REVIEW
1. Self-review: check code standards (RULES.md §Code Standards)
2. Write ST changelog using `ST-CHANGELOG-TEMPLATE.md` → save to `.agents/changelogs/EP##--slug/`
3. Update `CODEMAP.md` if any files were added, removed, or repurposed
4. If this is the last story of the epic: update epic plan `**Status**` → `Impl-Complete`
5. Write memory to `.agents/memory/{your-branch}/` (NOT `.agents/memory/main/`):
   - `current-focus.md` — story complete, what's next
   - `session-log.md` — if this is the end of the session
6. Commit: `feat(EP##-ST##): <what>. <why in body>.` — one commit per story
7. **If more stories remain**: **STOP** — ask "Ready for next story?"
8. **If this is the last story of the epic**:
   - **In a worktree**: `git push origin {branch}` → `gh pr create --base main` → **STOP. Tell human PR is ready.**
   - **On main**: **STOP** — ask human to review and confirm epic is complete.
