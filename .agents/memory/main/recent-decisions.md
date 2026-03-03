# Recent Decisions

**Branch**: main
**Updated**: 2026-03-03

## Decision Log

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

## Guidelines for Recording Decisions

- Record decisions when they affect multiple stories or architecture
- Link to ADR if this is a formal architecture decision
- Include alternatives considered (shows reasoning)
- Note the impact (who/what is affected)
