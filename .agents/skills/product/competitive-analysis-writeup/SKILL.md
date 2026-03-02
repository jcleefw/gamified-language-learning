---
name: competitive-analysis-writeup
description: Write-up phase of competitive analysis. Synthesizes raw research findings into a structured competitive analysis document. Run after competitive-analysis-research. Use when turning research into a shareable deliverable or strategic input.
model: sonnet
---

Synthesize the following competitive research into a structured analysis: $ARGUMENTS

If no input is provided, stop and ask: "Paste the raw research output from /competitive-analysis-research."

---

## Output Structure

### Executive Summary
2–3 sentences: What is the competitive landscape for this feature area? What is the most important strategic implication?

### Feature Comparison Matrix

| Capability | [Competitor A] | [Competitor B] | [Competitor C] | Us (current) |
|---|---|---|---|---|
| [Feature 1] | ✓ / ✗ / partial | | | |
| [Feature 2] | | | | |

Use ✓ (full), ~ (partial), ✗ (absent) for clarity.

### Competitor Profiles
For each competitor, one concise paragraph:
- What they do well in this area
- Where they fall short
- How they position it

### Whitespace Analysis
What gaps exist that no competitor addresses well? Rank by:
- **High value / low coverage** — strong opportunity
- **High value / high coverage** — table stakes; we must match
- **Low value / low coverage** — ignore for now

### Strategic Implications
What should we do differently, match, or avoid given this landscape? Be concrete — "we should" or "we should not" statements.

### Assumptions & Confidence
List any findings that are uncertain or outdated. Note what would change the analysis if those assumptions are wrong.

---

## Constraints

- Do not pad — if a section has nothing meaningful to say, say "N/A — insufficient data"
- Separate facts (from research) from interpretation (your analysis) — use "[Fact]" and "[Interpretation]" labels where it's ambiguous
- Stop after drafting and ask: "Does this capture what you need? Any section to adjust?"

## File Output

Save the document to: `product-documentation/competitive-analysis/`

Filename format: `YYYYMMDDTHHMMSSZ-<short-description>-analysis.md`
Example: `20260226T143000Z-export-feature-analysis.md`

Use the current UTC timestamp and a 2–4 word kebab-case description of the feature area analyzed.
