---
name: prd
description: Generate a structured Product Requirements Document from a feature brief or problem statement. Use when starting work on a new feature or initiative.
model: sonnet
---

Write a Product Requirements Document for: $ARGUMENTS

If no input is provided, stop and ask: "What feature or problem should this PRD cover? Provide a brief description."

---

## Output Structure

Begin the document with this header block:

```markdown
> **Status**: Draft
> **Created**: YYYYMMDDTHHMMSSZ
> **Scope**: <one-line summary of what this PRD covers and what it explicitly excludes>
```

Use the current UTC timestamp in `YYYYMMDDTHHMMSSZ` format. Do not use `YYYY-MM-DD`.

Then produce the following sections in order. Be specific and concrete — avoid filler.

### 1. Problem Statement

What user or business problem does this solve? Who is affected and how often? What is the cost of not solving it?

### 2. Goals

What does success look like? List 2–4 measurable outcomes.

### 3. Non-Goals

What is explicitly out of scope for this version? This section prevents scope creep — be direct.

### 4. Users & Context

Who uses this feature? Describe the primary user and their context (device, workflow, frequency of use).

### 5. Requirements

List functional requirements as numbered items. Each requirement must be:

- Testable (can a QA engineer verify it?)
- Scoped to this version (not "someday maybe")
- Written from the user's perspective where possible

### 6. Success Metrics

How will we know this feature worked? List leading indicators (engagement, adoption) and lagging indicators (retention, conversion). Include baseline if known.

### 7. Open Questions

What decisions are still unresolved? Who owns each question? Include a target resolution date if known.

---

## Constraints

- Do not invent requirements that were not implied by the input
- Flag any assumption you make with "[Assumed]" inline
- Keep the PRD to one page where possible — depth in requirements, brevity everywhere else
- **Describe functionality, not UI** — write requirements in terms of what the user can do, not how the interface looks. Avoid specifying UI containers (panels, sidebars, modals) or layout details. The UI is not determined at PRD stage.
- Stop after drafting and ask: "Does this capture the intent? Any sections to revise?"

## File Output

Save the document to: `product-documentation/prds/`

Filename format: `YYYYMMDDTHHMMSSZ-<short-description>.md`
Example: `20260226T143000Z-user-onboarding-prd.md`

Use the current UTC timestamp and a 2–4 word kebab-case description of the feature.

## File Output

Save the completed document to:

```
product-documentation/prds/YYYYMMDDTHHMMSSZ-<short-description>.md
```

Example: `product-documentation/prds/20260226T143000Z-user-onboarding-flow.md`

Use the current UTC timestamp and a 2–4 word kebab-case description of the feature or problem.
