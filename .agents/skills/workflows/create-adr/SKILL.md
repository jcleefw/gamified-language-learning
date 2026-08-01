---
name: create-adr
description: Create an Architecture Decision Record (ADR) to document significant technical decisions with context, rationale, and consequences.
---

# Create ADR

1. Identify the decision needing documentation
2. Gather context: current behavior, problem statement, constraints
3. Document alternatives considered (pros/cons/tradeoffs)
4. Generate ADR using `.agents/plans/templates/ADR-TEMPLATE.md` in `.agents/plans/adrs/`
5. Run `.agents/tools/generate-timestamp.sh` to fill `{YYYY-MM-DD}` placeholder
6. Call `.agents/tools/generate-filename.sh ADR## <slug>` to get the consistent filename
7. Review with user
