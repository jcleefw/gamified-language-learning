---
name: change-log-updater
description: 'Generates and updates story-level changelogs (ST). Use at the end of every story to document work, modified files, and outcomes.'
tools: Read, Write, Exec
---

# Change Log Updater

This skill handles the formal documentation of story-level work in the project.

## Standard Procedure

1.  **Summarize Results**: Analyze the completed implementation and summarize the output. Focus on technical changes and behavior shifts.
2.  **Inventory Changes**: List every file touched, added, or removed.
3.  **Draft from Template**: Use **[.agents/plans/templates/ST-CHANGELOG-TEMPLATE.md](../../../plans/templates/ST-CHANGELOG-TEMPLATE.md)** as the base structure.
4.  **Generate Identifiers**:
    - Run **`.agents/tools/generate-timestamp.sh`** to populate all `{TIMESTAMP}` placeholders in the document body.
    - Run **`.agents/tools/generate-filename.sh EP##-ST## <slug>`** to determine the final destination path.
5.  **Finalize Artifact**: Write the completed changelog to the correct epic subfolder in `.agents/changelogs/`.
6.  **Trigger Map Sync**: Once the log is written, use the **`code-mapper`** skill to verify if any folder-level `CODEMAP.md` requires updates based on the documented changes.

## Compliance Requirements

- **Slugified Filenames**: Ensure the `<slug>` provided to the filename tool is descriptive yet concise.
- **Story Context**: Ensure the log clearly links to the relevant Story ID (`ST##`) and Epic ID (`EP##`).
- **No Manual Timestamps**: Never manually calculate or guess the `YYYYMMDDTHHmmssZ` timestamp; always use the provided tool.
