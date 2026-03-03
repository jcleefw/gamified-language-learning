# Recent Decisions

**Branch**: main
**Updated**: 2026-03-03

## Decision Log

### 2026-03-04: ANKI Parameters — FSRS Defaults + 90-Day Cap
**Context**: Open question in SRS PRD and CONTEXT.md — should we use Anki defaults or tune for shorter mobile sessions? Three approaches considered: (A) pure FSRS defaults, (B) conservative mobile-tuned params, (C) FSRS defaults + max interval cap.
**Decision**: Approach C — FSRS desired retention 0.90 (default) + 90-day max interval cap.
**Rationale**: Phase 1 mastery (10 correct answers) is already stronger than Anki's learning steps, so default FSRS early intervals are fine. 90-day cap prevents words vanishing for months (A's problem at 140+ day gaps) without the excessive review pressure of B (8–12 reviews per batch at 6 months). Gate 1 metrics ("first-review accuracy ≥ 80%", "ANKI fallback rate < 5%") validate within a week.
**Alternatives Considered**:
- A (pure defaults): intervals grow to 365+ days — too long for MC-based recognition, likely triggers excessive 3-lapse fallbacks
- B (conservative 0.85 retention): more early reviews per word, eats batch slots, users feel "stuck reviewing" at scale
**Impact**: CONTEXT.md open question resolved, SRS PRD §13 resolved, SRS Engine ADR updated with `desiredRetention` and `maxInterval` in `SrsConfig`.

---

### 2026-03-04: Word Pool Deck — Sandbox with Soft Signal
**Context**: Eager learners finish 2–3 decks and want free-form review from the word pool. Key question: should word pool reviews affect ANKI scheduling?
**Decision**: Sandbox mode — no ANKI side effects. All attempts tracked with `source = wordPool` for analytics. Soft signal: 3 wrong answers all-time per word → pull `next_review_at` forward to now, reset counter. No lapse/ease/mastery changes.
**Rationale**: Eager daily review would inflate ANKI intervals if counted (user reviews daily for 2 weeks → intervals balloon → words vanish when user stops). Sandbox preserves ANKI integrity. Soft signal is a gentle nudge — consequence is mild (word appears one batch sooner), not punitive (no Phase 1 reset).
**Alternatives Considered**:
- Full ANKI integration: eagerness backfires when user stops practicing
- Pure sandbox (no signal at all): forgotten words only caught at next scheduled ANKI review
- Rolling window for wrong counter: unnecessary complexity for minimal benefit
**Impact**: SRS PRD §5.11 #43 expanded, §8.1 #3 (source field added), §8.1 #7 (word pool wrong counter added). No separate ADR — product rules, not architecture.

---

### 2026-03-03: iOS Audio Autoplay — Hybrid Strategy
**Context**: iOS Safari blocks audible audio autoplay without user gesture. Audio recognition questions (10% of quiz batch) require audio playback. Open question carried across PWA ADR, FE toolchain session, and SRS PRD.
**Decision**: Hybrid approach — session-level `AudioContext` unlock on quiz start tap, per-question autoplay attempt via `audio.play()`, visible play/replay button always rendered as fallback.
**Rationale**: Degrades gracefully on all platforms. No broken state — if autoplay works, great; if not, tap-to-play is always available. Matches patterns used by Duolingo/Memrise.
**Alternatives Considered**:
- Option A (tap-to-play only): Simplest but adds extra tap per audio question (~1s overhead each)
- Option B (session unlock only): Seamless but fails silently if iOS suspends AudioContext
**Impact**: SRS PRD §7.5 updated, PWA ADR open question closed, CONTEXT.md open question resolved. No early prototype spike needed.
**Related ADR**: PWA Platform Strategy ADR

---

### 2026-03-03: Headless Hono Backend for Orchestration
**Context**: The architecture is moving toward a highly decoupled model with extracted logic engines. We need a secure, portable orchestration layer for API keys, D1/R2 data, and Gemini quotas.
**Decision**: Implement a Headless Hono API on Cloudflare Workers as the primary orchestration layer.
**Rationale**: Decouples Nuxt (frontend) as a plug-and-play consumer, protects secrets, and simplifies Postman-first development. 
**Impact**: Nuxt SSR routes will be minimal; all business orchestration moves to the Hono Worker. Auth shifts to a backend-first strategy. 
**Related ADR**: `20260303T195134Z-engineering-headless-hono-backend.md`

---

### 2026-03-03: Curation Engine — Prompt-Builder + Response-Parser Pattern
**Context**: Curation engine's core workflow involves Gemini API calls (I/O), but engine must remain pure. Two options: (A) engine builds prompts and parses responses, calling layer handles API call; (B) engine accepts injected adapter and owns full workflow.
**Decision**: Option A — prompt-builder + response-parser. Engine is 100% synchronous and pure.
**Rationale**: No async, no mocks needed in tests, clean I/O boundary. Calling layer orchestration is trivial (3 steps).
**Alternatives Considered**: Injected adapter (Option B) — gives engine workflow ownership but requires async code and interface mocking.
**Impact**: Curation engine ADR written. Pattern applies to any future engine that wraps external APIs.
**Related ADR**: `20260303T210000Z-engineering-curation-engine-package.md`

### 2026-03-03: TTS Stays as Calling-Layer Service
**Context**: TTS is consumed by both curation and SRS paths. Considered: (1) in curation engine, (2) separate `packages/tts-engine`, (3) calling-layer service.
**Decision**: Option 3 — calling-layer service (`ttsService.ts`). Not a package.
**Rationale**: TTS is inherently I/O-bound (API calls, R2 storage, queue management). No meaningful pure logic to extract. Provider abstraction can live as an interface in the server layer.
**Impact**: No `packages/tts-engine`. TTS logic stays in server services.

### 2026-03-03: Foundational Decks Out of Curation Engine
**Context**: Foundational decks are fixed word sets uploaded as JSON. Considered whether validation/parsing belongs in curation engine.
**Decision**: Out of engine. Calling layer handles with Zod schema validation.
**Rationale**: Foundational decks aren't curated — they're predefined reference data. Doesn't fit engine purpose (AI-assisted curation workflow).

### 2026-03-03: Package Structure Conventions
**Context**: File structure patterns (co-located tests, domain-scoped types, naming) apply to all engine packages. Needed a canonical location.
**Decision**: Add to RULES.md as a new section. Move existing code examples to `docs/code-standards-examples.md` to make room.
**Rationale**: RULES.md is the enforcement file — highest visibility, read first by all agents.
**Impact**: RULES.md update pending (next session follow-up).

---

## Guidelines for Recording Decisions

- Record decisions when they affect multiple stories or architecture
- Link to ADR if this is a formal architecture decision
- Include alternatives considered (shows reasoning)
- Note the impact (who/what is affected)
