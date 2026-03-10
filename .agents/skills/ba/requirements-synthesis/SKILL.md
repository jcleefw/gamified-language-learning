---
name: requirements-synthesis
description: Synthesize stakeholder inputs (interviews, workshops, emails, documents) into structured, de-duplicated requirements. Use after discovery sessions to turn raw stakeholder input into a requirements baseline. Distinct from product's user-research-synthesis — output here is requirements, not product implications.
model: sonnet
---

Synthesize the following stakeholder input into requirements: $ARGUMENTS

If no input is provided, stop and ask:

1. "Paste the raw input — interview notes, workshop outputs, email threads, or stakeholder feedback."
2. "How many stakeholders or sessions does this cover?"
3. "Is there an existing requirements baseline to merge into, or are we starting fresh?"

---

## Process

1. Read all input before extracting anything
2. Extract raw requirement statements — capture intent, not wording (stakeholders rarely articulate requirements precisely)
3. De-duplicate: merge statements that express the same underlying need
4. Classify: functional vs non-functional, in-scope vs out-of-scope
5. Flag conflicts: where stakeholders have contradictory needs
6. Assign confidence: how clearly was this stated vs interpreted?

---

## Output Structure

### Synthesis Summary

- Sources: how many stakeholders / sessions / documents
- Total raw statements extracted: [N]
- After de-duplication: [N] distinct requirements
- Conflicts identified: [N]

### Functional Requirements

| ID     | Requirement         | Source(s)                  | Confidence          | Notes |
| ------ | ------------------- | -------------------------- | ------------------- | ----- |
| FR-001 | The system shall... | [Stakeholder A, Session 1] | High / Medium / Low |       |

**Confidence levels:**

- **High** — explicitly stated by stakeholder, unambiguous
- **Medium** — implied or inferred from context
- **Low** — derived from a single offhand comment or edge case

### Non-Functional Requirements

| ID      | Category                                 | Requirement | Source(s) | Confidence |
| ------- | ---------------------------------------- | ----------- | --------- | ---------- |
| NFR-001 | Performance / Security / Usability / ... |             |           |            |

### Conflicts

Where stakeholders expressed contradictory needs:

| ID    | Conflict | Stakeholder A position | Stakeholder B position | Recommended resolution path                                |
| ----- | -------- | ---------------------- | ---------------------- | ---------------------------------------------------------- |
| C-001 |          |                        |                        | Escalate to [owner] / Validate with data / Design decision |

### Out of Scope

Requirements captured but excluded from scope — document the reason:

| Statement | Source | Reason excluded |
| --------- | ------ | --------------- |

### Assumptions Made During Synthesis

Every interpretation you made that was not explicitly stated. Each assumption is a risk.

### Open Questions

What is still unclear and needs a follow-up? Include who should answer it.

---

## Constraints

- Write requirements in "The system shall..." form — not solution descriptions
- Do not resolve conflicts — flag them and recommend a resolution path; the stakeholder decides
- Flag any requirement that cannot be tested as written with "[Needs test criteria]"
- If input is too thin to derive meaningful requirements, say so and specify what additional sessions are needed
- Stop after drafting and ask: "Are there missing requirements or conflicts not captured here?"
