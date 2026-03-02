---
name: gap-analysis
description: Document current state vs desired state and identify the gaps between them. Use when assessing what needs to change to meet a business objective, before defining requirements.
model: sonnet
---

Perform a gap analysis for: $ARGUMENTS

If no input is provided, stop and ask:
1. "What is the area being analyzed — a process, system, capability, or data flow?"
2. "Describe the current state (what exists today) and the desired state (what must be true after)."
3. "What is the business driver for this change?"

---

## Process

1. Establish current state from the input — do not assume or invent
2. Establish desired state — if vague, flag and ask for clarification before proceeding
3. Compare systematically across each dimension
4. Classify each gap by type and impact
5. Prioritize gaps — not all gaps need to be closed

---

## Output Structure

### Context
- **Business driver**: Why is this analysis being done?
- **Scope**: What is in scope? What is out of scope?

### Current State Summary
Concise description of how things work today. Include pain points and known limitations.

### Desired State Summary
Concise description of what must be true after the change. Grounded in business outcomes, not solution design.

### Gap Register

| ID | Dimension | Current State | Desired State | Gap Description | Type | Impact |
|---|---|---|---|---|---|---|
| G-001 | [Process / Data / System / People / Policy] | [What exists] | [What is needed] | [What is missing or misaligned] | Missing / Partial / Misaligned | High / Med / Low |

**Gap Types:**
- **Missing** — capability does not exist at all
- **Partial** — capability exists but does not fully meet the need
- **Misaligned** — capability exists but works differently than required

### Prioritized Gaps
Rank gaps by: impact on the business objective × effort to close.

| Priority | Gap ID | Rationale |
|---|---|---|
| 1 | G-001 | Blocks the primary objective; relatively low effort |

### Recommendations
For each high-priority gap: what needs to happen to close it? State the recommendation as an action, not a solution design.

### Out of Scope Gaps
Gaps identified but not in scope for this effort — document them to avoid losing the signal.

---

## Constraints

- Do not recommend solutions — identify gaps and recommend actions (e.g., "define a policy for X", not "build a module that does X")
- Flag any current state description that is assumed rather than confirmed with "[Assumed — verify]"
- If the desired state is unclear or contradictory, stop and ask before proceeding
- Stop after drafting and ask: "Does this capture the key gaps? Any dimension missing from the analysis?"
