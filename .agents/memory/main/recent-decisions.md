# Recent Decisions

**Branch**: main
**Updated**: 2026-03-05
**Rolling window**: Keep last 3 days only. Older decisions archived to `decisions-archive.md`.

## Decision Index (1-liner each)

| Date | Decision | Related |
|------|----------|---------|
| 03-04 | Memory pointer via PostToolUse hook on ADR writes | `20260304T120000Z-agentic-memory-hook.md` |
| 03-04 | D1 batch < 100ms — deferred to Gate 2, needs schema ADR | SRS PRD §8.3 |
| 03-04 | Mid-quiz disconnect — discard batch, no localStorage v1 | SRS PRD §10 |
| 03-04 | ANKI params — FSRS 0.90 retention + 90-day max interval | SRS PRD §13 |
| 03-04 | Word pool — sandbox mode, soft signal at 3 wrong | SRS PRD §5.11 |
| 03-03 | Headless Hono backend for orchestration | `20260303T195134Z-engineering-headless-hono-backend.md` |
| 03-03 | Curation engine — prompt-builder + response-parser | `20260303T210000Z-engineering-curation-engine-package.md` |
| 03-03 | TTS stays as calling-layer service, not a package | — |
| 03-03 | Foundational decks out of curation engine | — |
| 03-03 | Package structure conventions → RULES.md | — |

## Recent Details (last 3 days only)

### 2026-03-04: Automated Memory Pointer via PostToolUse Hook
**Decision**: `PostToolUse` hook fires when `product-documentation/architecture/*.md` is written. Appends pointer to `recent-decisions.md`.
**Related ADR**: `20260304T120000Z-agentic-memory-hook.md`

### 2026-03-04: D1 Batch Assembly < 100ms — Deferred to Gate 2
**Decision**: Achievable with proper schema design. Validate P95 at Gate 2. Needs schema ADR first.

### 2026-03-04: Mid-Quiz Connection Loss — Discard Batch
**Decision**: Discard in-progress batch. No localStorage in v1. Revisit at Gate 2.

### 2026-03-04: ANKI Parameters — FSRS Defaults + 90-Day Cap
**Decision**: FSRS desired retention 0.90 + 90-day max interval cap. Gate 1 validation: first-review accuracy ≥ 80%, ANKI fallback rate < 5%.

### 2026-03-04: Word Pool Deck — Sandbox with Soft Signal
**Decision**: No ANKI side effects. Soft signal: 3 wrong all-time → pull `next_review_at` forward, reset counter.

### 2026-03-03: iOS Audio Autoplay — Hybrid Strategy
**Decision**: Session-level `AudioContext` unlock + per-question autoplay attempt + visible play button fallback.

### 2026-03-03: Headless Hono Backend
**Decision**: Hono on Cloudflare Workers as orchestration layer. Nuxt = plug-and-play consumer.

### 2026-03-03: Curation Engine — Prompt-Builder Pattern
**Decision**: Engine builds prompts + parses responses. 100% synchronous and pure. Calling layer handles API.

---

## Rotation Policy

- Keep only decisions from the last 3 days in "Recent Details"
- Decision Index keeps 1-liner summaries indefinitely (trim when > 20 rows)
- When trimming: move full details to `decisions-archive.md`
