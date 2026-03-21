---
name: epic-draft
description: Draft a structured Epic Plan (EP) for a new feature or initiative. Identifies requirements, dependencies, parallelism, and sub-domain phases.
model: sonnet
---

# Epic Draft — High-Level Planning & Strategy

Your goal is to produce a comprehensive Epic Plan (EP) that provides a clear roadmap for a major feature or initiative.

## Step 1 — Gather and Clarify Requirements

If the input is minimal, ask for:
- **The "Why"**: What problem are we solving? Who is the user?
- **The "What"**: What are the 2-3 core features?
- **The Scope**: What is explicitly in and out of scope?

## Step 2 — Map Dependencies & Parallelism

Analyze the proposed work:
- **Depends on**: What must be finished *before* this can start? (e.g., Core Engine, Database Schema)
- **Parallel with**: What other epics can run concurrently with this one once their shared dependencies are met?
- **Predecessor**: Is this a replacement or v2 of an existing epic?

## Step 3 — Structure the Epic

- **Sub-domains**: Does this epic have distinct "chunks" (e.g., Frontend, API, Data Ingestion)? 
- **Phases**: If there are distinct sub-domains, group the stories into Phases (e.g., EP##-PH01, EP##-PH02). If it's a simple, vertical slice, omit Phase headings.
- **Stories**: Identify the high-level stories needed. Each story should be a "deliverable unit" that can be built and tested in 1-3 days.

## Step 4 — Generate the Plan

Produce the Epic Plan in the format defined by `EP-TEMPLATE.md`. 

### Header Block
```markdown
# EP## - {Title}

**Created**: {TIMESTAMP}
**Status**: Draft

**Type**: Epic Plan
**Depends on**: {EP## or N/A}
**Parallel with**: {EP## or N/A}
**Predecessor**: {EP## or N/A}
```

### Problem Statement
Clear, concise explanation of the "Why".

### Scope
- **In scope**: Bullet points of key features.
- **Out of scope**: Bullet points of what we aren't doing yet.

### Stories
Group by Phase if applicable.
Format: `### EP##-ST##: {Title}` followed by `**Scope**: {One-line description}`.

### Overall Acceptance Criteria
A checklist of high-level conditions that must be met for the epic to be considered complete.

---

## Output Rules

- **Use EP## placeholders**: The main agent will replace these with the correct next number.
- **Be specific**: Don't use vague titles like "UI Implementation". Use "Mobile-responsive Dashboard Layout".
- **Focus on Business Value**: Every story should deliver something tangible.
- **Check for edge cases**: Include at least one acceptance criterion related to errors or limit states.
