---
name: saving-session-state
description: "Saves the current discussion session state to a timestamped file for resumption in a new thread. Use when ending a discussion session, before starting a new conversation, or when asked to save progress."
---

# Save Session State

When this skill is loaded, immediately perform the following:

1. **Read `.agents/tools/memory-write-guide.md`** for memory update guidelines.

2. **Determine the current timestamp** in ISO 8601 format: `YYYYMMDDTHHMMSSZ` (e.g., `20260226T143000Z`).

3. **Analyze the full current conversation** and extract the following into a structured markdown document.

4. **Derive a short description** — 2–4 words in kebab-case summarizing the main topic of the session (e.g., `agentic-skill-setup`, `auth-flow-design`).

5. **Write to `sessions/<timestamp>-<short-description>.md`** in the workspace root. Create the `sessions/` directory if it does not exist.

## Output Format

```markdown
# Session State — YYYYMMDDTHHMMSSZ-short-description

## Context
> What is the project/feature being discussed? Provide enough background that a new thread can understand the situation without reading prior conversations.

## Decisions Made (User-Directed)
> List every decision explicitly made by the user. These are authoritative and must not be changed.
> Format: `- **[Topic]**: [Decision] (User)`

## Decisions Made (Agent-Suggested, User-Approved)
> List decisions that the agent proposed and the user agreed to or did not contest.
> Format: `- **[Topic]**: [Decision] (Agent-suggested, approved)`

## Points Discussed But Not Decided
> List topics that were raised and discussed but no clear decision was reached.
> Format: `- **[Topic]**: [Summary of discussion so far]`

## Open Questions (To Be Discussed)
> List questions that were explicitly deferred or flagged for future discussion.
> Format: `- **[Topic]**: [The question and any context]`

## Detailed Discussion Record
> For each major topic discussed, provide a detailed summary:
> - What was the user's original statement
> - What clarifications were asked
> - What the user answered
> - What the final understanding is
> This section is the most important — it must contain enough detail to reconstruct the full context.

## Current State of the Spec/Design
> Provide a consolidated snapshot of the current understanding of the design/spec. This should stand alone — a new thread should not need prior session files to understand the current state.

## Next Steps
> What should be tackled next when a new session starts?
```

## Rules

- **Be exhaustive**: Every decision, every clarification, every nuance discussed must be captured. Do not summarize away important details.
- **Attribute correctly**: Clearly distinguish between what the user decided vs what the agent suggested.
- **Do not assume**: If something was ambiguous in the discussion, mark it as ambiguous. Do not fill in gaps with assumptions.
- **Preserve exact numbers and rules**: If the user said "70/20/10", write "70/20/10". If they said "max 8 words", write "max 8 words". Do not paraphrase numerical decisions.
- **One file per session**: Never append to or overwrite an existing session file. Each invocation creates a new timestamped file.
- **Self-contained**: The "Current State of the Spec/Design" section must be complete enough that a new thread needs only this file — not prior session files — to continue the work.
- **Quote the user when precision matters**: For critical design decisions, include the user's own words.
