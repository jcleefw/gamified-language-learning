---
name: process-map
description: Document an as-is or to-be process as a structured narrative with steps, actors, decision points, and handoffs. Use when capturing how a process works today or defining how it should work after a change.
model: sonnet
---

Document the following process: $ARGUMENTS

If no input is provided, stop and ask:
1. "What process are we mapping?"
2. "Is this an as-is (current state) or to-be (future state) map — or both?"
3. "Who are the actors involved? (People, teams, or systems)"

---

## Output Structure

### Process: [Name]
- **Type**: As-Is / To-Be
- **Trigger**: What starts this process?
- **End state**: What signals the process is complete?
- **Actors**: List all people, teams, and systems that participate

### Process Steps

Use a structured table. Each row is one step.

| Step | Actor | Action | Input | Output | Decision? | Notes |
|---|---|---|---|---|---|---|
| 1 | [Who] | [Does what] | [What they receive] | [What they produce] | No | |
| 2 | [Who] | [Does what] | [What they receive] | [What they produce] | Yes → [Step 4 if Y / Step 3 if N] | |

**Decision notation**: If a step is a decision point, note the branches inline (→ Step X if Y, → Step Z if N).

### Handoffs
List every point where responsibility transfers between actors:

| From | To | Trigger | What is handed off |
|---|---|---|---|

### Pain Points (As-Is only)
Where does the process break down, slow down, or create errors? Note each with the step it occurs at.

### Proposed Changes (To-Be only)
What changes from the as-is, and why? Map each change to the business driver.

### Process Metrics
What should be measured to know if this process is performing well?
- Cycle time: time from trigger to end state
- Error rate: where do failures occur and how often?
- Handoff latency: where do things get stuck waiting?

---

## Constraints

- Each step must have exactly one actor — if multiple actors share a step, split it
- Do not describe technology implementation — describe what happens, not how the system does it
- If a step or decision rule is unclear from the input, flag it with "[Clarify — rule unclear]" rather than inventing logic
- For as-is maps: document reality, not the ideal — include workarounds and manual steps that exist
- Stop after drafting and ask: "Does this reflect the process accurately? Any missing steps or decision points?"
