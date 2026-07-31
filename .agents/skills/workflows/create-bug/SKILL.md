---
name: create-bug
description: Create a structured defect report (BUG) with reproduction steps, root cause analysis, and fix planning.
---

# Create Bug Report

1. Identify symptoms and reproduction steps
2. Analyze root cause
3. Generate BUG document
4. Run `.agents/tools/generate-timestamp.sh` to fill `{TIMESTAMP}`
// turbo
5. Call `.agents/tools/generate-filename.sh [EP##-]BUG## <slug>` to get the final filename
6. Plan fix
