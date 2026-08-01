---
name: change-log-updater
description: Generate story-level changelog at story completion. Document work, files modified, outcomes.
tools: Read, Write, Exec
role: Documentation specialist ensuring traceable story artifacts compliant with project governance
---

# Change Log Updater

**Trigger**: Call at end of every story after implementation completes (tests pass).

## Steps

1. **Summarize Output**: Technical summary of what changed and behavioral shifts.
2. **Inventory Files** (Git-backed):
    - Run: `git diff --name-status HEAD^..HEAD` → list modified/added/deleted files
    - Filter to project-relevant paths (ignore test coverage reports, lockfiles if not in scope)
3. **Draft Changelog**: Use template `.agents/plans/templates/ST-CHANGELOG-TEMPLATE.md`.
    - Fill `Track` (`project` | `agentic`)
    - Fill `Supersedes` (if applicable)
4. **Run Timestamp Tool:** `.agents/tools/generate-timestamp.sh` → replace all `{TIMESTAMP}` placeholders
5. **Generate Filename:** `.agents/tools/generate-filename.sh EP##-ST## <slug>` → determine destination path
6. **Write Artifact**: Save to `.agents/changelogs/EP##--<slug>/[timestamp]-EP##-ST##-<slug>.md`
7. **Sync CODEMAP:** Invoke `code-mapper` skill if documented changes affect folder-level `CODEMAP.md`.

## Compliance (Non-Negotiable)

| Rule | Enforcement |
|------|-------------|
| Use timestamp tool for `{TIMESTAMP}` | No manual calculation |
| Use filename tool for path generation | Follow RULES.md §Mandatory Tooling |
| Slug must be descriptive + concise | e.g., `add-fsrs-persistence` not `changes` |
| Link Story ID + Epic ID clearly | Frontmatter or header |

## What This Skill Does NOT Do

- Compaction to time archive (handled by `historical/compact-epic` after PR merge)
- Domain knowledge updates (`KNOWLEDGE.md` — separate step)

**Done condition**: Changelog written, CODEMAP synced, human notified.
