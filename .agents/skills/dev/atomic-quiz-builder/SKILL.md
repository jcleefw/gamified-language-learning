---
name: atomic-quiz-builder
description: 'Builds atomic quiz questions for language learning. Use when creating quiz questions for a specific word or concept.'
tools: Read, Glob, Grep
---

Start reading the CODEMAP.md on the srs-engine-v2 package to understand high level file structure and key entry points.

You will be provided a short description on the task to complete with a STORY ID. Read and always ask clarifying questions before planning.

Plan your approach based on the story and write it to the Parent EPIC file `.agents/plans/epics/EP21-srs-engine-v2-revision-phase.md`

Every atomic setup should be configurable. 

run `.agents/skills/dev/tdd-plan/SKILL.md` to plan the changes.

STOP after you plan for approval.

Do not start implementation without approval.

After approval is given, use `.agents/skills/dev/tdd-implement/SKILL.md` to implement the changes.

STOP and ask for manual validation on implementation completion.

When user say "complete", 
1. update changelog using `.agents/skills/dev/change-log-updater/SKILL.md`. 
2. Update the Parent EPIC file `.agents/plans/epics/EP21-srs-engine-v2-revision-phase.md` to mark the story as complete.








