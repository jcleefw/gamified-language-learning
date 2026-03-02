---
name: use-case
description: Document a use case with actors, preconditions, main flow, alternative flows, and exception flows. Use when specifying system behavior from an actor's perspective.
model: haiku
---

Write a use case for: $ARGUMENTS

If no input is provided, stop and ask:
1. "What action or goal does the actor want to achieve?"
2. "Who is the primary actor? Are there secondary actors or systems involved?"

---

## Output Structure

### Use Case: [Name — verb phrase describing the goal]

| Field | Detail |
|---|---|
| **ID** | UC-001 |
| **Goal** | What the actor wants to achieve |
| **Primary Actor** | Who initiates the use case |
| **Secondary Actors** | Other people or systems involved |
| **Preconditions** | What must be true before this use case can start |
| **Postconditions (Success)** | What is true after the use case completes successfully |
| **Postconditions (Failure)** | What is true if the use case fails |
| **Trigger** | What causes this use case to start |

### Main Success Flow
Number each step. Each step is either an actor action or a system response.

```
1. Actor [does action]
2. System [responds with]
3. Actor [does action]
4. System [responds with]
...
N. Use case ends with [success state]
```

### Alternative Flows
For each meaningful variation from the main flow, specify at which step it branches and what happens:

```
A1. At step [N], if [condition]:
  1. [Alternative step]
  2. [Returns to step X / ends]
```

### Exception Flows
For each error or failure condition:

```
E1. At step [N], if [error condition]:
  1. System [response]
  2. [Recovery path or failure end state]
```

### Business Rules
List any business rules that govern decisions within this use case (e.g., "User must be verified before placing an order").

---

## Constraints

- Each step must be a single, observable action — not a bundle of steps
- Do not describe UI implementation — describe intent and response
- If a use case has more than 10 main flow steps, it is likely too large — flag for splitting
- Label any step that assumes a business rule not listed with "[Rule needed]"
