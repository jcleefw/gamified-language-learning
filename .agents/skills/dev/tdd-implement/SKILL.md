---
name: tdd-implement
description: "Executes a TDD implementation plan from tdd-plan, writing code in red-green-refactor cycles. Use after tdd-plan has produced an implementation plan. Run with Sonnet."
model: sonnet
---

# TDD Implement — Code Execution

When this skill is loaded, execute the implementation plan produced by `tdd-plan`. If no plan is present in context, ask the user to run `tdd-plan` first.

## Execution Loop

Work through each test in the plan's **test plan** in order. For each:

### Red
- Write the failing test exactly as described in the plan.
- Run it. Confirm it fails for the right reason (not a syntax error or wrong import).
- Show the test and the failure output.
- Stop. Wait for user confirmation before continuing.

### Green
- Write the minimum implementation code to make the test pass.
- Run the test. Confirm it passes.
- Show the implementation change.
- Stop. Wait for user confirmation before continuing.

### Refactor
- Clean up if needed. Run the full test suite to confirm nothing broke.
- Show what changed.
- Stop. Wait for user confirmation before continuing.

Move to the next test in the plan.

## Hard Stop Protocol

When working on a failing test, start an internal 2-minute clock. If the test is still not passing when the clock expires, **stop immediately**. Do not attempt another fix. Do not continue reasoning.

Summarise and ask for advice:

```
HARD STOP — 2 min limit reached

Problem: <Exactly what is failing and what the error says>

What was tried:
- <Approach and outcome>
- <Approach and outcome>

What was discovered: <What is now understood about the failure that wasn't known before — even if no fix was found, what did the investigation reveal?>

Advice needed: <Specific question for the user — what decision or insight is needed to unblock this?>
```

Wait for the user's response. They may provide a direction, a hint, or choose to escalate to Opus. Do not proceed until they respond.

## Completion

When all tests in the plan pass:
- Run the full test suite one final time.
- Confirm every item in the plan's **implementation steps** is done.
- Report: tests written, tests passing, files changed.

## Rules

- Follow the plan. Do not improvise new tests or changes not in the plan.
- If the plan turns out to be wrong or incomplete, stop and flag it — do not silently adapt.
- Never weaken a test to make it pass.
- The 2-minute clock starts when active fixing begins on a stuck test — not from the start of the whole session.
- Do not reset the clock by switching to a different approach. The clock runs continuously until the test passes or time expires.
- Hard stop means hard stop — do not sneak in one more attempt after the clock expires.
