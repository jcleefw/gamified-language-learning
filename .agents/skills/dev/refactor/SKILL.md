---
name: refactor
description: "Safely refactors code while preserving behavior. Use when cleaning up existing code, extracting logic, or improving structure without changing what the code does."
---

# Refactor

When this skill is loaded, follow this sequence. Do not change behavior — only structure.

## Step 1 — Establish the safety net
Before touching any code:
- Confirm tests exist for the code being refactored.
- Run the test suite. It must be green before you start.
- If tests are missing, stop and tell the user. Do not refactor untested code.

## Step 2 — Understand the current design
- Read the code and map what it does: inputs, outputs, side effects, dependencies.
- Identify what is being changed and what must stay identical (public interface, return values, error behaviour).
- State the refactoring goal explicitly: what structural problem is being solved?

## Step 3 — Refactor in small steps
- Make one structural change at a time.
- Run the full test suite after every change.
- If tests break, revert the last change immediately — do not proceed.
- Show each change and its test result before moving to the next.

## Step 4 — Verify the public interface
- Confirm the public interface is identical to before.
- Run the full test suite one final time.
- Show the before/after diff summary.

## Rules

- Never change behavior as part of a refactor. If a bug is found, note it separately — do not fix it inline.
- Never refactor and add features in the same pass.
- Red tests mean stop and revert, not push through.
- If the refactor requires changing the public interface, stop and align with the user first.
