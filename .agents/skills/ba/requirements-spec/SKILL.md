---
name: requirements-spec
description: Generate a structured requirements specification (functional and non-functional) for a feature, system, or change. Use when translating a business need into development-ready requirements.
model: sonnet
---

Write a requirements specification for: $ARGUMENTS

If no input is provided, stop and ask:

1. "What system, feature, or change needs to be specified?"
2. "Who are the stakeholders and what is the business driver?"

---

## Output Structure

### 1. Overview

- **Purpose**: What business problem does this address?
- **Scope**: What is included? What is explicitly excluded?
- **Stakeholders**: Who requested this, who is affected, who must sign off?

### 2. Functional Requirements

Each requirement must be:

- Numbered (FR-001, FR-002, ...)
- Written as: "The system shall [action] when [condition]."
- Testable — a QA engineer can write a test for it without asking clarifying questions
- Atomic — one requirement, one behavior

| ID     | Requirement         | Priority (MoSCoW) | Source              |
| ------ | ------------------- | ----------------- | ------------------- |
| FR-001 | The system shall... | Must              | [Stakeholder / doc] |

### 3. Non-Functional Requirements

Cover applicable categories only — omit irrelevant ones:

| ID      | Category     | Requirement              | Measure        |
| ------- | ------------ | ------------------------ | -------------- |
| NFR-001 | Performance  | Response time under load | < 500ms at p95 |
| NFR-002 | Security     | Authentication required  | All endpoints  |
| NFR-003 | Availability | Uptime target            | 99.9% monthly  |
| NFR-004 | Scalability  | Concurrent users         | Up to 10,000   |

### 4. Constraints

Technical, regulatory, or business constraints that shape the solution. These are not requirements — they are boundaries the solution must operate within.

### 5. Assumptions

List every assumption made. Each assumption is a risk — if it turns out to be wrong, requirements may need to change.

### 6. Dependencies

What must exist or be complete before this can be built or tested? List systems, APIs, data sources, or upstream work.

### 7. Open Items

Unresolved questions that would affect requirements. Include owner and target resolution date.

---

## Constraints

- Flag any requirement that cannot be tested as written with "[Needs test criteria]"
- Flag any requirement derived from assumption (not confirmed stakeholder input) with "[Assumed]"
- Do not include solution design — requirements describe _what_, not _how_
- Stop after drafting and ask: "Are there missing requirements or any that need refinement?"
