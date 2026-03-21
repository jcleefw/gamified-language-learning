---
description: Create a new Epic Plan (EP) for a feature or initiative
---

# Create Epic Plan

1. Identify context and next EP number (EP##)
2. Call the **epic-draft** skill to gather requirements, identify dependencies, and draft the content using `EP-TEMPLATE.md`.
3. Ensure all `EP##` placeholders in the draft are replaced with the correct number.
4. Run `.agents/tools/generate-timestamp.sh` and replace the `{TIMESTAMP}` placeholder.
// turbo
5. Call `.agents/tools/generate-filename.sh EP## <slug>` to get the final filename.
6. Present the drafted plan to the user for approval.
7. Once approved, save to `.agents/plans/EP##-<slug>.md`.