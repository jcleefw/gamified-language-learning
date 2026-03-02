---
name: api-cost-model
description: Model the cost of a specific API at different usage volumes. Use before committing to an API-based feature to understand cost implications at scale. Produces a scenario cost table.
model: sonnet
---

Model API usage costs for: $ARGUMENTS

If no input is provided, stop and ask:
1. "Which API and pricing tier are we modeling? (e.g., Gemini TTS, Standard tier)"
2. "What is the billing unit? (e.g., per character, per request, per token)"
3. "What is the expected usage? Give low/medium/high estimates if possible (e.g., requests per day, data volume per request)."
4. "Are there free tier limits, volume discounts, or budget caps to factor in?"

---

## Process

1. Confirm pricing from the user — do not look up or assume pricing. Ask the user to provide the current price per unit.
2. Establish usage parameters: unit size, frequency, and volume tiers.
3. Calculate cost for each volume scenario.
4. Flag any usage pattern that crosses a pricing tier boundary.
5. Mark all assumed figures clearly.

---

## Output Structure

### API Cost Model: [API Name]

**Date:** [current UTC date, YYYY-MM-DD]

#### Pricing Inputs

| Parameter | Value |
|---|---|
| Provider | |
| Billing unit | (e.g., per 1M characters) |
| Price per unit | |
| Free tier limit | |
| Volume discount thresholds | |

#### Usage Assumptions

| Scenario | [dimension 1] | [dimension 2] | Requests/day | Units/request | Units/day |
|---|---|---|---|---|---|
| Low | | | | | |
| Medium | | | | | |
| High | | | | | |

#### Cost Projections

| Scenario | Daily | Monthly | Annual | Notes |
|---|---|---|---|---|
| Low | | | | |
| Medium | | | | |
| High | | | | |

#### Key Observations

- Highlight crossover points where cost grows non-linearly
- Flag pricing tier boundaries hit at medium or high volume
- Note any assumed vs confirmed figures

---

## Constraints

- Do not look up or assume current pricing — ask the user to confirm it
- Mark every assumed figure with "[Assumed — verify]"
- If usage assumptions are vague, ask for clarification before calculating
- After output, stop and ask: "Does this model match your assumptions? Anything to adjust?"

## Cross-links

If medium or high volume cost is significant enough to warrant evaluating alternatives (self-hosted, different provider, or caching strategy), suggest:

> "This may be worth a fuller tradeoff analysis — run `/architect/cost-analysis` to evaluate alternatives."
