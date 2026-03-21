# AGN03: Story Changelog Skill Refactor

**Date**: 20260321T114518Z <!-- Run .agents/tools/generate-timestamp.sh -->
**Type**: Governance | Workflow | Skill
**Files Changed**:
- `.agents/skills/dev/change-log-updater/SKILL.md` (New)
- `.agents/workflows/create-changelog.md` (Deleted)
- `.agents/workflows/code-change-workflow.md` (Updated)
- `.agents/skills/dev/atomic-quiz-builder/SKILL.md` (Updated)

---

## What Changed

- Created the centralized **`change-log-updater`** skill to own the formal documentation of story-level work.
- Deleted the legacy `create-changelog.md` workflow.
- Updated the primary `code-change-workflow.md` (REVIEW phase) and the `atomic-quiz-builder` skill to consume the new specialized skill.
- Decoupled the implementation workflow from the precise details of changelog naming, templating, and timestamping.

## Why

- **Motivation**: To continue the effort of keeping core workflows high-level and readable. The "how-to" of creating a valid changelog (using templates, generating timestamps, naming files) is a distinct operational task that is best handled by a specialized skill. This approach ensures total compliance with documentation standards without cluttering general governance files.

## Before / After

- **Before**: Master workflows and other specialized skills contained redundant, manual steps for inventorying files, loading templates, and calculating timestamps for story logs.
- **After**: These steps are abstracted into the **`change-log-updater`** skill. Consuming layers simply invoke the skill to finalize their story, ensuring standardized artifacts across the entire project.
