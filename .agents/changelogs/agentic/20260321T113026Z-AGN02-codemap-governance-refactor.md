# AGN02: CODEMAP Governance Refactor

**Date**: 20260321T113026Z <!-- Run .agents/tools/generate-timestamp.sh -->
**Type**: Governance | Documentation | Skill
**Files Changed**:
- `RULES.md`
- `WORKFLOW.md`
- `.agents/docs/code-map-guide.md` (New)
- `.agents/skills/dev/code-mapper/SKILL.md`
- `.agents/workflows/code-change-workflow.md`
- `.agents/workflows/create-code-map.md` (Deleted)

---

## What Changed

- Refactored CODEMAP update rules out of `RULES.md` and the master implementation workflow.
- Created a centralized `Code Map Guide` at `.agents/docs/code-map-guide.md` for mandatory update steps.
- Updated the `code-mapper` skill to point to the central guide and removed the duplicated rule definitions in the skill file.
- Minimized all references to operational details in `RULES.md` and `WORKFLOW.md` to keep them as navigational guidance.

## Why

- **Motivation**: Governance files were becoming cluttered with operational details for specific tasks. To maintain high-level readability in `RULES.md`, the update logic should live within the specialized skill and documentation. This refactor establishes a single source of truth for codemap maintenance rules and minimizes cross-document noise.

## Before / After

- **Before**: `RULES.md` and the master `code-change-workflow.md` contained 15+ lines of specific triggers for when to update `CODEMAP.md`, which were partially duplicated in the `code-mapper` skill.
- **After**: `RULES.md` and `WORKFLOW.md` only refer to "CODEMAP sync" as a high-level step. The detailed update triggers and maintenance rules are now centralized in `.agents/docs/code-map-guide.md` and linked directly from the `code-mapper` skill.
