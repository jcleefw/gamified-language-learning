---
name: debug-investigation
description: "Systematically investigates a bug to find the root cause before attempting a fix. Use when a bug is unclear, intermittent, or the obvious fix hasn't worked."
---

# Debug Investigation

When this skill is loaded, follow this sequence. Do not skip to a fix before completing the investigation.

## Step 1 — Reproduce
Establish a reliable reproduction case.
- What are the exact inputs, state, and conditions that trigger the bug?
- Can you reproduce it consistently? If not, what makes it intermittent?
- State the reproduction steps explicitly before proceeding.

## Step 2 — Isolate
Narrow the blast radius.
- Which layer owns the failure — input, logic, data, output, external dependency?
- What is the smallest code path that still exhibits the bug?
- Read relevant files. Trace the execution path from trigger to failure.

## Step 3 — Hypothesize
Form a specific, falsifiable hypothesis.
- State the hypothesis: "The bug occurs because X causes Y under condition Z."
- List what evidence would confirm or disprove it.
- Stop. Present the hypothesis and evidence plan to the user before continuing.

## Step 4 — Verify
Test the hypothesis, do not assume it.
- Add targeted logging or inspection to confirm the root cause.
- Run the reproduction case.
- If the hypothesis is wrong, return to Step 2.

## Step 5 — Fix
Only after the root cause is confirmed:
- Fix the root cause, not the symptom.
- Write a test that would have caught this bug.
- Run the full test suite to confirm no regression.

## Rules

- Never apply a fix based on a guess. Hypotheses must be verified first.
- If the fix requires changing more than 3 files, stop and present findings — the scope is larger than a bug fix.
- Document what the root cause was in a comment if the code is non-obvious.
