---
name: fix-review
description: 'Addresses a code review comment by understanding the intent, locating the code, making the fix, and verifying tests. Use when responding to review feedback on a PR or diff.'
---

# Fix Review Comment

When this skill is loaded, address the review comment systematically. Ask the user to provide the comment if not already given.

## Step 1 — Understand the intent

Read the review comment carefully.

- What is the reviewer asking for, and why?
- Is it a correctness fix, a style change, a security concern, or a design suggestion?
- If the intent is ambiguous, ask the user to clarify before touching any code.

## Step 2 — Locate the code

Find the exact location the comment refers to.

- Read the file and surrounding context (not just the flagged line).
- Understand what the code does before deciding how to change it.

## Step 3 — Make the fix

Apply the minimal change that satisfies the reviewer's intent.

- Do not fix unrelated issues in the same pass — stay scoped to the comment.
- If fixing it properly requires a larger change, stop and flag it to the user before proceeding.

## Step 4 — Verify

- Run the relevant tests.
- If behavior changed, run the full test suite.
- Confirm the fix directly addresses the review comment — read the comment again after making the change.

## Step 5 — Summarise

Output a short response the user can paste back to the reviewer:

```
Fixed in <file>:<line>. <One sentence explaining what changed and why.>
```

## Rules

- Never interpret a review comment more broadly than intended. Scope creep in review fixes is a common source of regressions.
- If you disagree with the comment, flag it to the user — do not silently ignore it or apply a partial fix.
- If the fix reveals a deeper design issue, note it separately. Do not solve it inline.
- Tests must be green before marking the fix complete.
