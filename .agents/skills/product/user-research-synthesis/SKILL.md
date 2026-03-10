---
name: user-research-synthesis
description: Synthesize raw user research (interviews, surveys, feedback, support tickets) into themes, insights, and product implications. Use after a discovery round to turn qualitative data into actionable findings.
model: sonnet
---

Synthesize the following user research: $ARGUMENTS

If no input is provided, stop and ask: "Paste the raw research input — interview notes, survey responses, feedback, or support tickets."

---

## Process

1. Read all input before drawing any conclusions
2. Identify recurring patterns — look for frequency and intensity, not just frequency
3. Distinguish between what users say, what they do, and what they need (these often differ)
4. Surface contradictions — conflicting signals are often the most important findings

---

## Output Structure

### Research Context

Summarize: source type (interviews / surveys / tickets), number of participants or data points, and any notable sampling gaps.

### Key Themes

For each theme:

- **Theme name** (2–4 words)
- What the data shows (evidence-based, not interpreted yet)
- Frequency: how many participants/data points surfaced this
- Intensity: how strongly did users express this? (frustration / mild preference / blocker)

### Insights

Interpret the themes. What do they mean for the product? An insight connects observed behavior to an underlying need or motivation.

Format: "[Observation] suggests [user need/motivation], which means [implication]."

### Product Implications

Concrete recommendations for what to explore, validate, or build — ranked by confidence:

- **High confidence** (multiple sources, strong signal): act on this
- **Medium confidence** (one source or weak signal): validate before acting
- **Low confidence** (single data point or speculative): monitor, don't act yet

### Open Questions

What did the research not answer? What would the next research round need to resolve?

---

## Constraints

- Separate observation from interpretation — label which is which
- Do not recommend specific solutions — that is the PM's job; stop at implications
- Flag any data that appears anomalous or that contradicts the dominant pattern
- If the input is too sparse to draw conclusions, say so and specify what additional data is needed

## File Output

Save the document to: `product-documentation/research/`

Filename format: `YYYYMMDDTHHMMSSZ-<short-description>.md`
Example: `20260226T143000Z-onboarding-research-synthesis.md`

Use the current UTC timestamp and a 2–4 word kebab-case description of the research topic.

## File Output

Save the completed document to:

```
product-documentation/research/YYYYMMDDTHHMMSSZ-<short-description>.md
```

Example: `product-documentation/research/20260226T143000Z-onboarding-interview-round2.md`

Use the current UTC timestamp and a 2–4 word kebab-case description of the research source or topic.
