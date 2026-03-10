---
name: prioritize
description: Apply a prioritization framework to a feature or backlog list. Outputs a ranked list with scoring rationale. Use when deciding what to build next or when preparing for planning.
model: sonnet
---

Prioritize the following: $ARGUMENTS

If no input is provided, stop and ask:

1. "Paste the list of features or items to prioritize."
2. "Which framework should I use: RICE, MoSCoW, or Impact/Effort? (Default: RICE if unsure)"
3. "What is the strategic goal or constraint this prioritization should optimize for?"

---

## Framework Definitions

### RICE

Score = (Reach × Impact × Confidence) / Effort

- **Reach**: How many users affected per quarter? (number)
- **Impact**: How much does it move the needle? (3=massive, 2=significant, 1=low, 0.5=minimal)
- **Confidence**: How sure are we? (100%=high, 80%=medium, 50%=low)
- **Effort**: Person-weeks to build

### MoSCoW

Classify each item as:

- **Must Have** — launch-blocking; product fails without it
- **Should Have** — high value, not launch-blocking
- **Could Have** — nice to have, cut if time-pressed
- **Won't Have** — explicitly out of scope for this cycle

### Impact/Effort

Score each on two axes (High/Low):

- **Impact**: user value + business value
- **Effort**: time + complexity + risk

Quadrants: Quick Wins (High/Low), Major Bets (High/High), Fill-Ins (Low/Low), Thankless Tasks (Low/High)

---

## Output Structure

### Scores / Classification

Table showing each item with its score or classification and the key inputs used.

### Ranked List

Ordered list with brief rationale for each item's position.

### Calls to Validate

List any scores or classifications that rest on weak assumptions and need validation before the ranking should be trusted.

### Items to Drop

Flag any items that scored so low they should be removed from consideration entirely, with a one-line reason.

---

## Constraints

- If scoring inputs are missing, use "[Estimated]" and note the assumption
- Do not let any single dimension dominate — if an item scores extremely high on one axis and low on all others, flag it for discussion
- Stop after producing the ranked list and ask: "Do the rankings match your intuition? Any item to revisit?"

## File Output

Save the document to: `product-documentation/prioritization/`

Filename format: `YYYYMMDDTHHMMSSZ-<short-description>.md`
Example: `20260226T143000Z-q2-backlog-rice.md`

Use the current UTC timestamp and a 2–4 word kebab-case description of the backlog or cycle being prioritized.
