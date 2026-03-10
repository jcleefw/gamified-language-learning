---
name: metrics-definition
description: Define success metrics, leading/lagging indicators, and instrumentation plan for a feature or initiative. Use when starting a feature to establish how success will be measured before building.
model: sonnet
---

Define metrics for: $ARGUMENTS

If no input is provided, stop and ask:

1. "What feature or initiative are we defining metrics for?"
2. "What is the primary goal — acquisition, activation, retention, revenue, or referral?"
3. "Do we have a baseline or current benchmark to compare against?"

---

## Metric Types

- **Primary metric** — The one number that defines success for this feature. If everything else degrades but this improves, you have won.
- **Secondary metrics** — Supporting signals that indicate the primary metric is moving for the right reasons.
- **Guardrail metrics** — Things that must not degrade. If they do, the feature is causing harm even if the primary metric improves.
- **Leading indicators** — Early signals (days/weeks post-launch) that predict whether the primary metric will move.
- **Lagging indicators** — Outcomes that confirm success weeks or months later (retention, LTV, NPS delta).

---

## Output Structure

### North Star for This Feature

One sentence: "This feature succeeds when [primary metric] moves from [baseline] to [target] within [timeframe]."

### Metric Set

| Metric | Type      | Definition | Baseline | Target | Timeframe |
| ------ | --------- | ---------- | -------- | ------ | --------- |
|        | Primary   |            |          |        |           |
|        | Secondary |            |          |        |           |
|        | Guardrail |            |          |        |           |
|        | Leading   |            |          |        |           |
|        | Lagging   |            |          |        |           |

### Instrumentation Plan

What events need to be tracked to measure these metrics? For each metric:

- Event name and properties to capture
- Where in the user flow it fires
- Who owns implementation (product / eng / analytics)

### Anti-metrics

What could game these metrics without actually delivering value? Note these so the team avoids optimizing for them.

### Open Questions

What do we not know that would affect how we define or interpret these metrics?

---

## Constraints

- Define one primary metric only — multiple primaries create conflicting incentives
- Guardrail metrics are non-negotiable — flag immediately if a launch decision would require ignoring one
- If baseline is unknown, flag it and recommend how to establish one before launch
- Do not define metrics for things that cannot be instrumented — note the gap and suggest an alternative proxy

## File Output

Save the document to: `product-documentation/metrics/`

Filename format: `YYYYMMDDTHHMMSSZ-<short-description>.md`
Example: `20260226T143000Z-onboarding-metrics.md`

Use the current UTC timestamp and a 2–4 word kebab-case description of the feature or initiative.
