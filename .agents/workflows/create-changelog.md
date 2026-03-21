---
description: Document completed work in a Story Changelog (ST)
---

# Create Changelog

1. Summarize work completed
2. List files modified
3. Generate ST using `ST-CHANGELOG-TEMPLATE.md`
4. Run `.agents/tools/generate-timestamp.sh` to fill `{TIMESTAMP}`
// turbo
5. Call `.agents/tools/generate-filename.sh EP##-ST## <slug>` to get the final filename
6. Update CODEMAP if necessary