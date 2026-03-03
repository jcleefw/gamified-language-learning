# ADR: Frontend Platform Strategy — Progressive Web App

**Status:** Accepted

**Date:** 2026-02-27

**Deciders:** Solo founder

---

## Context

The gamified language learning app requires a frontend that serves two distinct user paths:

- **Admin/Curator path** — Content management, user management. Primarily desktop/web usage.
- **Learner path** — SRS-based quiz sessions (15 questions, daily habit loops), audio playback, native script rendering (Chinese, Thai, etc.). Primarily mobile usage.

The learner experience demands a mobile-first, immersive UI. The developer preference is to build in web technologies for debugging ergonomics and development speed. App store distribution is not required at this stage. The app is always-online — no offline support needed initially.

The core tension: mobile-primary usage vs. preference for web development tooling.

---

## Decision

Build a **Progressive Web App (PWA)** with a mobile-first design strategy.

- Single web codebase serves both admin and learner paths
- PWA manifest set to `display: standalone` to remove browser chrome on mobile — achieves full-screen immersive quiz mode
- Responsive, mobile-first CSS for the learner path; desktop layout for admin/curator path
- Installable to iOS and Android home screens without app store involvement
- No offline support in initial build (always-online assumption)

---

## Rationale

- **No app store required now.** PWA home screen installation satisfies the distribution need without Xcode, Android Studio, or review cycles.
- **Single codebase.** Admin and learner paths share components, state management, and API integration. No parallel native codebase to maintain.
- **Debugging preference preserved.** Full browser DevTools, hot reload, and standard web debugging apply to everything including the mobile-shaped learner UI.
- **Quiz interactions are web-native.** Multiple choice taps, word block selection, and audio playback are all well-supported by browser APIs. No native API dependency exists in the current feature set.
- **Full-screen immersion via manifest.** `display: standalone` removes browser UI on installed PWA, giving the learner experience an app-like feel without native code.
- **Capacitor migration path is low-cost.** If native APIs (haptics, iOS audio edge cases) become necessary, Capacitor wraps the existing Vue PWA without requiring a rewrite.

---

## Alternatives Considered

| Option | Pros | Cons | Why Not Chosen |
|---|---|---|---|
| Vue + Capacitor (hybrid) | Native haptics, better iOS audio, app store path | Requires Xcode/Android Studio, compile step, plugin ecosystem complexity | No native API requirement exists yet; adds setup cost for speculative benefit |
| Separate native apps (iOS/Android) | Best native feel, full API access | Two codebases, app store overhead, not feasible for solo/small team | Maintenance overhead disproportionate to current stage |
| Native PWA without framework | Minimal dependencies | No component model, hard to scale quiz UI complexity | Framework needed for SRS state management and quiz component reuse |

---

## Consequences

**Positive:**
- Fastest path to a working, debuggable mobile-shaped learner experience
- Single deployment pipeline; no per-platform build or signing configuration
- Installable without requiring users to visit an app store
- Capacitor upgrade is available without rewriting application code

**Negative / Risks:**
- iOS Safari PWA limitations: audio autoplay restrictions may require explicit user gesture handling; some gesture conflicts with Safari's swipe-back navigation
- Haptic feedback limited to `Vibration API` — not as precise or reliable as native haptics, with iOS restrictions
- No app store presence reduces discoverability if that becomes a growth channel
- `display: standalone` full-screen mode depends on the user installing the PWA; first-time browser users see browser chrome

**Neutral:**
- Always-online assumption deferred offline support — this is a known future decision point if habit-loop usage patterns demand it

---

## Open Questions

- ~~**iOS audio autoplay**~~ — **Resolved**: Hybrid approach. Session-level `AudioContext` unlock on quiz start tap, autoplay attempt per question, visible tap-to-play/replay button always rendered as fallback. No early prototype needed — degrades gracefully. See SRS PRD §7.5.
- **PWA install prompt strategy:** How and when do we prompt learners to install the PWA? (On first login? After N sessions?) Not an architecture question but affects the immersive experience goal.
- **Capacitor trigger criteria:** What specific limitation would trigger migration to Capacitor? Should be defined before it becomes urgent. Suggested criteria: iOS audio failures or haptic feedback complaints from users.
