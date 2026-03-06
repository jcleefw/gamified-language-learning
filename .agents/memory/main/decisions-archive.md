# Decisions Archive

Decisions rotated out of `recent-decisions.md` (older than 3 days).

---

## 2026-03-03

### iOS Audio Autoplay — Hybrid Strategy
**Decision**: Session-level `AudioContext` unlock + per-question autoplay attempt + visible play button fallback.

### Headless Hono Backend
**Decision**: Hono on Cloudflare Workers as orchestration layer. Nuxt = plug-and-play consumer.
**ADR**: `20260303T195134Z-engineering-headless-hono-backend.md`

### Curation Engine — Prompt-Builder Pattern
**Decision**: Engine builds prompts + parses responses. 100% synchronous and pure. Calling layer handles API.
**ADR**: `20260303T210000Z-engineering-curation-engine-package.md`

### TTS stays as calling-layer service, not a package
**Decision**: TTS is not encapsulated in a package. Calling layer (backend) handles TTS directly.

### Foundational decks out of curation engine
**Decision**: Foundational deck mechanics are separate from the curation engine.

### Package structure conventions → RULES.md
**Decision**: Package structure conventions codified in RULES.md rather than scattered across ADRs.

---

## 2026-03-04

### Automated Memory Pointer via PostToolUse Hook
**Decision**: `PostToolUse` hook fires when `product-documentation/architecture/*.md` is written. Appends pointer to `recent-decisions.md`.
**ADR**: `20260304T120000Z-agentic-memory-hook.md`

### D1 Batch Assembly < 100ms — Deferred to Gate 2
**Decision**: Achievable with proper schema design. Validate P95 at Gate 2. Needs schema ADR first.

### Mid-Quiz Connection Loss — Discard Batch
**Decision**: Discard in-progress batch. No localStorage in v1. Revisit at Gate 2.

### ANKI Parameters — FSRS Defaults + 90-Day Cap
**Decision**: FSRS desired retention 0.90 + 90-day max interval cap. Gate 1 validation: first-review accuracy ≥ 80%, ANKI fallback rate < 5%.

### Word Pool Deck — Sandbox with Soft Signal
**Decision**: No ANKI side effects. Soft signal: 3 wrong all-time → pull `next_review_at` forward, reset counter.
