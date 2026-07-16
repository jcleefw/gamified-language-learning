---
name: code-review
description: 'Reviews code for correctness, security, over-engineering, and style. Use when reviewing a file, diff, or PR before merging.'
tools: Read, Glob, Grep
---

# Code Review

When this skill is loaded, perform a structured review. Do not edit any files.

## Review Dimensions

### 1. Correctness

- Does the code do what it claims to do?
- Are there edge cases or error conditions not handled?
- Are there off-by-one errors, null/undefined risks, or race conditions?

### 2. Security

- Any OWASP Top 10 exposure? (injection, broken auth, sensitive data exposure, etc.)
- Is user input validated at system boundaries?
- Are secrets, credentials, or PII handled safely?

### 3. Over-engineering

- Is there unnecessary abstraction or premature generalization?
- Are there helpers, utilities, or patterns added for hypothetical future use?
- Could three similar lines replace an abstraction?

### 4. Style and clarity

- Is the intent clear without needing comments?
- Are names accurate and unambiguous?
- Are functions doing more than one thing?
- Do all exported classes, and exported and non-trivial private functions have a docstring?
  - Docstrings must be human-readable (plain English, no jargon)
  - Max 80 characters per line
- Are any comments **overloading** rather than documenting? Flag comments that narrate the refactor/story instead of the code itself — "mirrors old X", "note the asymmetry with Y", "this used to do Z", references to a specific story/epic/PR number. That belongs in the commit/PR description, not in the file. Test: would the comment still make sense to someone with no knowledge of the prior code or the diff that produced it? If not, it's overloading, not a docstring — flag it as a MINOR/NIT under Style.

## Output Format

For each issue found:

```
[SEVERITY] <dimension>
Location: <file>:<line>
Issue: <what is wrong>
Suggestion: <what to do instead>
```

Severity levels: `BLOCKER` / `MAJOR` / `MINOR` / `NIT`

End with a summary: total issues by severity, and an overall recommendation (approve / approve with minor changes / request changes).

## Rules

- Read-only. Never suggest edits by writing files — output text only.
- Flag BLOCKERs and MAJORs first.
- Do not invent issues. Only flag what is actually present in the code.
- If the code is good, say so explicitly.
