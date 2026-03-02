---
name: competitive-analysis-research
description: Research phase of competitive analysis. Investigates competitors deeply for a given product area or feature. Run this first, then pass output to competitive-analysis-writeup. Use when evaluating market positioning or feature strategy.
model: opus
context: fork
---

Research competitive landscape for: $ARGUMENTS

If no input is provided, stop and ask: "What product area or feature are we analyzing? Who are the key competitors to include?"

---

## Research Scope

For each competitor provided (or discovered):

1. **Feature inventory** — What does their version of this feature do? What does it not do?
2. **UX approach** — How do users access and interact with it? What is the flow?
3. **Positioning** — How do they describe or market this capability?
4. **Pricing / access tier** — Is this gated behind a paid plan?
5. **Known strengths** — What do users praise? (Look for review signals, public feedback)
6. **Known weaknesses** — What do users complain about? What gaps exist?

---

## Research Sources

Use available tools (web search, public documentation, review sites) to gather evidence. Note the source for each finding so the write-up phase can cite or verify.

Prioritize: official product pages, changelog/release notes, user reviews (G2, Capterra, App Store, Reddit), and public job postings (which signal investment direction).

---

## Output Format

Produce a raw research dump organized by competitor. Do not editorialize or synthesize — that is the write-up phase's job.

For each competitor:
```
## [Competitor Name]
- Feature: [what they have]
- UX: [how it works]
- Positioning: [how they describe it]
- Pricing tier: [free / paid / enterprise]
- Strengths (source): [finding]
- Weaknesses (source): [finding]
- Notable gaps: [what they lack]
```

End with a flat list of gaps across all competitors that no one has addressed well.

---

## Constraints

- Time-box research to 20 minutes per competitor — surface findings, do not chase perfection
- If a competitor's approach is unknown or undocumented, say so explicitly — do not speculate
- Flag any finding that is older than 12 months with "[May be outdated]"
- When done, instruct the user: "Run /competitive-analysis-writeup with this output to produce the structured analysis."

## File Output

Save the raw research dump to: `product-documentation/competitive-analysis/`

Filename format: `YYYYMMDDTHHMMSSZ-<short-description>-research.md`
Example: `20260226T143000Z-export-feature-research.md`

Use the current UTC timestamp and a 2–4 word kebab-case description of the feature area analyzed.

## File Output

Save the raw research dump to:
```
product-documentation/competitive-analysis/YYYYMMDDTHHMMSSZ-<short-description>-research.md
```
Example: `product-documentation/competitive-analysis/20260226T143000Z-export-feature-research.md`

Use the current UTC timestamp, a 2–4 word kebab-case description of the product area, and the `-research` suffix to distinguish from the write-up.
