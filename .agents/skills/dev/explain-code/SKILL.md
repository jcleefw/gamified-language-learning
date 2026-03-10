---
name: explain-code
description: 'Produces a deep walkthrough of an unfamiliar module or file. Use when onboarding to a new part of the codebase or trying to understand how something works before modifying it.'
tools: Read, Glob, Grep
---

# Explain Code

When this skill is loaded, produce a thorough explanation of the target code. Do not edit any files.

## What to Cover

### 1. Purpose

What problem does this code solve? What is its responsibility in the system?

### 2. Data flow

Trace the main execution path from entry point to output:

- What comes in (inputs, parameters, external data)?
- What transformations happen?
- What goes out (return values, side effects, events emitted)?

### 3. Key dependencies

- What does this code depend on (imports, services, databases, APIs)?
- What depends on this code?

### 4. Non-obvious behaviour

- Are there edge cases, special conditions, or subtle logic that aren't immediately clear?
- Are there implicit assumptions baked into the code?
- Are there known gotchas or footguns?

### 5. State and side effects

- Does this code mutate shared state?
- Does it have side effects (I/O, network, events, cache)?
- Is it safe to call multiple times (idempotent)?

### 6. Test coverage

- What is tested and what is not?
- Are there behaviours that are hard to test and why?

## Output Format

Write the explanation in plain prose with code references formatted as `file:line`. Avoid bullet-point dumps — write as if explaining to a competent engineer joining the team.

End with: **"Safe to modify if..."** — conditions under which changes can be made with confidence.

## Rules

- Read-only. Do not suggest changes — explain only.
- Be specific. Reference actual file paths and line numbers, not abstractions.
- If you find something unclear or inconsistent in the code, flag it as an observation, not a suggestion.
