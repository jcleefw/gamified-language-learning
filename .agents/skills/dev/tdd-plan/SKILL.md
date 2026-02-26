---
name: tdd-plan
description: "Investigates a feature request, explores the codebase, and produces a structured TDD implementation plan. Use before tdd-implement, when starting a new feature or significant change. Run with Opus."
model: opus
---

# TDD Plan — Investigation & Implementation Blueprint

When this skill is loaded, produce a thorough implementation plan. Do not write any code.

## Step 1 — Understand the requirement
- What is the feature or change being requested?
- What is the expected behaviour from the user's perspective?
- What are the explicit constraints or acceptance criteria?
- If anything is ambiguous, ask the user before proceeding.

## Step 2 — Explore the codebase
- Locate the relevant files, modules, and entry points.
- Understand how the affected area currently works: data flow, dependencies, side effects.
- Identify what already exists that can be reused or extended.
- Identify what will need to change and what must stay untouched.

## Step 3 — Identify the test surface
- What behaviours need to be tested?
- What edge cases and failure modes must be covered?
- What existing tests are affected or need updating?
- Are there any areas that are hard to test — and if so, why?

## Step 4 — Write the implementation plan

Output a structured plan with the following sections:

```
## Implementation Plan — <feature name>

### Summary
<1–2 sentences: what this change does and why>

### Files to change
- <file path> — <what changes and why>

### Files to leave untouched
- <file path> — <why it must not change>

### Test plan (in order)
1. <Test: what behaviour it covers>
2. <Test: what behaviour it covers>
...

### Implementation steps (in order)
1. <Step: what to do, which file, what the change achieves>
2. ...

### Risks and unknowns
- <Anything uncertain that tdd-implement should watch for>
```

Stop after producing the plan. Hand off to `tdd-implement` to execute it.

## Rules

- Do not write implementation code. Plan only.
- Do not start the plan until the requirement is fully understood.
- Be specific — file paths, method names, test descriptions. No vague steps.
- If the investigation reveals the feature is larger than expected, say so before producing the plan.
