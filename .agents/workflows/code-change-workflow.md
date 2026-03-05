---
description: Master workflow for ANY story implementation. Ensures consistency and quality. Always follow this sequence — do not skip steps or auto-proceed.
---
# Code Change Workflow

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
4. Write memory:
   - `current-focus.md` — story complete, what's next
   - `session-log.md` — if this is the end of the session
5. Commit: `feat(EP##-ST##): <what>. <why in body>.` — one commit per story
6. **STOP** — ask "Ready for next story?"
