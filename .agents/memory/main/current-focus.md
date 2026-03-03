# Current Focus

**Branch**: main
**Updated**: 2026-03-04

## Active Work

- **Epic**: N/A — Architecture planning phase
- **Story**: N/A
- **Status**: SRS parameter decisions complete, word pool deck rules defined

## Last Session Outcome

Product discussion session — resolved two open questions and defined word pool deck behavior.

### 1. ANKI Parameters for Mobile (Open Question Resolved)
- **Decision**: Approach C — FSRS defaults (desired retention 0.90) + 90-day max interval cap
- **Rationale**: Phase 1 mastery (10 correct answers) provides sufficient initial reinforcement for default FSRS early intervals. 90-day cap prevents words vanishing for months (Approach A problem) without over-reviewing (Approach B problem).
- **Gate 1 tuning knobs**: if first-review accuracy < 80% → raise retention to 0.92–0.95; if ANKI fallback rate > 5% → lower max interval cap
- **Files changed**: CONTEXT.md, SRS PRD §13, SRS Engine ADR (added `desiredRetention` and `maxInterval` to `SrsConfig`)

### 2. Word Pool Deck Rules (New PRD Content)
- **Sandbox mode**: word pool reviews do NOT affect ANKI scheduling (no interval/ease/lapse changes)
- **Analytics tracking**: every attempt recorded with source = `wordPool`
- **Soft signal**: 3 wrong answers all-time in word pool → pull `next_review_at` forward to now, reset counter to 0. No lapse/ease/mastery impact.
- **Question types**: same as curated (70/20/10). Challenge modes deferred.
- **Batch composition**: random from all mastered words, no minimum pool size
- **No separate ADR needed** — product rules, not architectural decisions
- **Files changed**: SRS PRD §5.11, §8.1

## ADRs Completed

1. ✅ **SRS engine as separate package** — `20260302T160536Z-engineering-srs-engine-package.md`
2. ✅ **Curation engine as separate package** — `20260303T210000Z-engineering-curation-engine-package.md`
3. **Shared types strategy** — ✅ Resolved inline (each engine owns its types; no shared-types package)
4. **API surface design** — pending (class-based confirmed, exact method signatures pending)
5. ~~**Backend server need**~~ — ✅ Resolved (`20260303T195134Z-engineering-headless-hono-backend.md`)

## Follow-Up Actions (Next Session)

1. **Delete irrelevant session files**: `sessions/` contains files superseded by ADRs
2. Start next ADR topic (#4 API surface design)

## Context for Next Session

- SRS engine ADR: `product-documentation/architecture/20260302T160536Z-engineering-srs-engine-package.md`
- SRS PRD: `product-documentation/prds/20260226T100000Z-srs-learning-path.md`
- Curation engine ADR: `product-documentation/architecture/20260303T210000Z-engineering-curation-engine-package.md`
- Hono backend ADR: `product-documentation/architecture/20260303T195134Z-engineering-headless-hono-backend.md`
