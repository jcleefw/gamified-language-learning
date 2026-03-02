---
name: requirements-traceability
description: Build a requirements traceability matrix mapping requirements to acceptance criteria and test cases. Use when verifying coverage before testing, during sign-off, or when assessing change impact.
model: haiku
---

Build a traceability matrix for: $ARGUMENTS

If no input is provided, stop and ask:
1. "Provide the requirements list (IDs and descriptions)."
2. "Do you have existing acceptance criteria and/or test cases to map? If so, paste them. If not, I will draft them."

---

## Output Structure

### Traceability Matrix

| Req ID | Requirement | Acceptance Criteria ID(s) | Test Case ID(s) | Status |
|---|---|---|---|---|
| FR-001 | The system shall... | AC-001, AC-002 | TC-001, TC-002 | Covered / Partial / Not covered |

**Status definitions:**
- **Covered** — at least one test case exists and maps to at least one acceptance criterion
- **Partial** — some acceptance criteria have test cases; others do not
- **Not covered** — no acceptance criteria or test cases exist for this requirement

### Coverage Summary

| Metric | Count |
|---|---|
| Total requirements | |
| Fully covered | |
| Partially covered | |
| Not covered | |
| Coverage % | |

### Gaps
Requirements that are partially covered or not covered at all:

| Req ID | Gap description | Recommended action |
|---|---|---|
| FR-003 | No test case for the error flow in AC-003 | Add test case for [scenario] |

### Change Impact (if applicable)
If a requirement has changed, list which acceptance criteria and test cases are affected and need updating:

| Changed Req ID | Affected AC IDs | Affected TC IDs | Action needed |
|---|---|---|---|

---

## Acceptance Criteria Format (if drafting)
If acceptance criteria do not yet exist, draft them using Given/When/Then:
```
AC-001 (for FR-001):
  Given [precondition]
  When [action]
  Then [expected result]
```

---

## Constraints

- One-to-many is normal: one requirement can have multiple acceptance criteria and test cases
- Do not mark a requirement as "Covered" if a test case exists but does not verify the full requirement
- Flag any acceptance criterion that cannot be mapped to a specific requirement with "[Orphaned AC — clarify]"
- Flag any test case that has no corresponding acceptance criterion with "[Orphaned TC — clarify]"
