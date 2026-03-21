# AGN04: Commit Discipline Skill Refactor

**Date**: 20260321T120101Z <!-- Run .agents/tools/generate-timestamp.sh -->
**Type**: Governance | Workflow | Skill
**Files Changed**:
- `.agents/skills/dev/commit-discipline/SKILL.md` (New)
- `RULES.md` (Updated)
- `.agents/workflows/code-change-workflow.md` (Updated)

---

## What Changed

- Abstracted the project's commitment standards into a dedicated **`commit-discipline`** skill.
- Refactored `RULES.md` to point to the skill instead of containing raw implementation details.
- Updated the master `code-change-workflow.md` to explicitly invoke the `commit-discipline` skill during the finalization step of a story.
- Formally added `agentic` as a conventional commit type in the governance system.

## Why

- **Motivation**: To continue the modularization of the governance system. Commit standards (atomicity, header formatting, prefixing) are operational constraints that are better enforced by a specialized skill than by static text in a general rules file. This ensures consistent version control quality across all implementation tasks.

## Before / After

- **Before**: Commit rules were documented as bullet points in `RULES.md`. Agents had to manually refer to this list during every story completion.
- **After**: The `commit-discipline` skill owns these standards. Consuming workflows link directly to it, ensuring that every commit follows the same atomicity and formatting protocol regardless of the task context.
