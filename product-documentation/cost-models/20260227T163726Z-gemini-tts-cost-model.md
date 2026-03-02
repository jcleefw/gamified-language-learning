# API Cost Model: Gemini 2.5 Flash TTS

**Date:** 2026-02-27
**Context:** TTS audio generation for the gamified language learning app — evaluating cost and rate feasibility for all 3 audio scopes (full conversation, per sentence, per word) during content curation.
**Status:** completed

---

## Pricing Inputs

| Parameter | Value |
|---|---|
| Provider | Google Gemini API |
| Model | `gemini-2.5-flash-preview-tts` |
| Billing unit | Per 1M input tokens (text sent for synthesis) |
| Free tier cost | $0 |
| Paid tier 1 input cost | $0.50 / 1M tokens |
| Paid tier 1 output cost | $10.00 / 1M tokens [output token rate unknown — not factored in] |

---

## Rate Limits by Tier

| Metric | Free Tier | Paid Tier 1 |
|---|---|---|
| RPM (requests/min) | 3 | 10 |
| TPM (tokens/min) | 10K | 10K |
| RPD (requests/day) | 10 | 250 |

> RPD was not surfaced in the Google AI Studio rate limits view for either tier. It should be confirmed via the [Rate Limit Docs](https://ai.google.dev/gemini-api/docs/rate-limits) before relying on this model for production planning. If RPD is low (e.g., 50), it — not RPM — becomes the binding constraint.

---

## Usage Assumptions (based on real conversation data)

Source: `conversations-2026-02-27.json` (Thai Learning spike data)

| Scope | Requests per conversation | Est. input tokens | Notes |
|---|---|---|---|
| Full conversation | 1 | ~50 tokens | All lines combined in one request |
| Per sentence | 4 | ~50 tokens | One request per line, same text split |
| Per word | 17–31 | ~25–50 tokens | One request per unique word; varies by conversation complexity |
| **All 3 scopes total** | **22–36 requests** | **~125–150 tokens** | Weather (simpler): 22 req; Post office (denser): 36 req |

Conversation parameters assumed: 4 lines, beginner difficulty, Thai language, <10 seconds full audio.

---

## Cost Projections

### Free Tier

| Scenario | Cost | Binding constraint |
|---|---|---|
| Any usage within rate limits | **$0** | RPM = 3 |

### Paid Tier 1

| Scenario | Conversations | Input tokens | Input cost | Notes |
|---|---|---|---|---|
| Low (10 conversations) | 10 | ~1,250 tokens | ~$0.00063 | Negligible |
| Medium (100 conversations) | 100 | ~12,500 tokens | ~$0.0063 | Negligible |
| High (1,000 conversations) | 1,000 | ~125,000 tokens | ~$0.063 | ~$0.06 |

> Output token cost not included — audio token rate unconfirmed. Input cost alone is negligible at all volumes. Output cost could be material depending on audio token encoding rate; verify before committing to paid tier.

---

## Generation Time per Conversation (all 3 scopes)

| Conversation complexity | Requests | Free tier (3 RPM) | Paid tier 1 (10 RPM) |
|---|---|---|---|
| Simple (17 unique words) | 22 req | ~7.3 min | ~2.2 min |
| Dense (31 unique words) | 36 req | ~12 min | ~3.6 min |

### Without word-level TTS (full + sentence only)

| Requests | Free tier | Paid tier 1 |
|---|---|---|
| 5 req | ~1.7 min | <1 min |

---

## Daily Throughput (theoretical max, RPM-limited, no RPD cap)

| Tier | RPM | Max requests/day | Conversations/day (avg 22 req) |
|---|---|---|---|
| Free | 3 | 4,320 | ~196 |
| Paid tier 1 | 10 | 14,400 | ~654 |

> These are theoretical maximums assuming continuous 24/7 generation. In a manual curation workflow, the practical daily throughput is curation session time ÷ minutes per conversation.

---

## Key Observations

1. **Cost is not the constraint at any realistic scale.** Input token cost is negligible even at paid tier 1. The constraint is always rate (RPM) or possibly a hidden RPD cap.

2. **Word-level TTS dominates request count.** It converts ~5 requests (full + sentence) into 22–36. At free tier (3 RPM), this adds 5–10 minutes of wait time per conversation.

3. **Paid tier 1 is 3.3× faster, essentially $0 cost.** The practical question is whether 2–3 min per conversation is acceptable versus 7–12 min at free tier.

4. **RPD is the critical unknown.** If the free tier RPD cap is ≤50, that limits you to ~2 conversations/day regardless of RPM. Confirm before deciding on scope.

5. **TPM is identical across tiers** (10K). Not a differentiator.

---

## Open Decision

> **Word-level TTS in scope?** (from session `20260226T121437Z-admin-path-content-curation.md`)
> User: "If possible why not." Pending cost review.

**Finding:** Cost is not a blocker. The question is UX tolerance for generation wait time during curation:
- Free tier + word-level TTS: 7–12 min per conversation
- Paid tier 1 + word-level TTS: 2–3 min per conversation
- Either tier, no word-level TTS: <2 min per conversation

**Recommended next step:** Run `/architect/cost-analysis` to evaluate whether to include word-level TTS in MVP scope, and whether to use free vs paid tier for the curation workflow.

**Decicion made*:* see `product-documentation/prds/20260302T000000Z-gemini-tts-generation.md`

---

## Cross-links

- Session: `sessions/20260226T121437Z-admin-path-content-curation.md` — TTS decision context
- PRD: `product-documentation/prds/20260226T140000Z-content-curation.md` — TTS audio scopes feature spec