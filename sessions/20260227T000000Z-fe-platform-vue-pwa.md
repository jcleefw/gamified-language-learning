# Session State — 20260227T000000Z-fe-platform-vue-pwa

## Context

Project: Gamified language learning app with SRS-based quizzes (ANKI algorithm), audio playback, native script rendering (Chinese, Thai, etc.), and three user roles: admin, curator, learner.

The session focused on frontend platform strategy: how to build a mobile-primary learner experience while maintaining web developer ergonomics. A secondary topic (Vue vs React) was opened but not resolved — deferred to next session.

---

## Decisions Made (User-Directed)

- **No app store distribution (for now):** User explicitly does not want to deal with app store at this stage.
- **Always online (for now):** Offline support deferred. User confirmed always-online is acceptable for initial build.
- **PWA as platform strategy:** User agreed to start with PWA after reviewing pros/cons.
- **Vue.js as the framework:** User stated preference for Vue.js (reasons documented below, deeper discussion deferred).

---

## Decisions Made (Agent-Suggested, User-Approved)

- **`display: standalone` for full-screen immersive quiz mode:** Agent proposed PWA manifest standalone mode achieves immersive feel without native code. User accepted.
- **Capacitor as upgrade path, not starting point:** Agent recommended starting PWA, adding Capacitor only when a specific native limitation blocks something. User accepted with "ok start with PWA."

---

## Points Discussed But Not Decided

- **Vue vs React:** User opened this discussion but it was deferred to next session. User's stated reasons for Vue:
  1. Wants a more opinionated build setup, but not Next.js
  2. Personal learning project — wants to learn Vue lifecycle (unfamiliar with Vue)
  3. Wants to explore Vue's approach to UI frameworks (user flagged they want to discuss this further)
- **Full-screen immersive quiz mode complexity:** User flagged this as "probably needed but depends on complexity." Not fully resolved — accepted the PWA standalone approach as sufficient for now.

---

## Open Questions (To Be Discussed)

- **Vue vs React deep-dive:** User wants to discuss pros and cons of Vue specifically. Three reasons given (see above) — needs fuller exploration next session.
- **Vue UI framework selection:** User wants to discuss how Vue approaches UI frameworks (component libraries, design systems). Not started.
- **iOS audio autoplay:** Will audio recognition questions require workarounds for iOS Safari's autoplay policy? Flagged in ADR as open question.
- **PWA install prompt strategy:** When and how to prompt learners to install the PWA?
- **Capacitor trigger criteria:** What specific limitations would trigger migration to Capacitor?

---

## Detailed Discussion Record

### Web vs Mobile Platform Tension

**User's original statement:** Prefers developing in web (easier to debug) but mobile apps have nuances of native experience. Majority of usage will be mobile, especially non-admin path.

**Clarifications asked:** What native capabilities are actually needed? What does the non-admin (learner) path look like?

**User answered:**
- Native capabilities: "mostly mobile-shaped UI with good performance" — not deep native APIs
- Learner path: SRS-based quizzes (THOUGHTS.md L57–95) — multiple choice, word block selection, audio recognition, 15 questions per session, ANKI scheduling algorithm
- Full-screen immersive quiz mode: "probably" needed, depends on complexity

**Final understanding:** No hard native API requirements exist in current feature set. PWA standalone mode satisfies the immersive need.

### App Store and Offline

**User's exact words:** "i prefer not to deal with it at this stage" (app store), "always online for now" (offline).

**Agent suggested checking Duolingo/Memrise patterns.** User approved a web search but then rejected the tool call. Agent provided knowledge from training data instead:
- Both Duolingo and Memrise maintain separate native + web apps (two codebases)
- Neither has meaningful offline support on web
- Pattern is web + native; user does not want that overhead

### PWA vs Capacitor Decision

Agent presented pros/cons table:
- **PWA pros:** Single codebase, no build toolchain, instant deploys, standalone full-screen, debugging preserved
- **PWA cons:** Weak haptics (Vibration API, iOS limited), iOS PWA quirks, audio autoplay restrictions, no app store
- **Capacitor pros:** Real native haptics, better iOS audio, full-screen feels native, app store path later
- **Capacitor cons:** Requires Xcode + Android Studio, compile step, plugin ecosystem pain, overkill without native requirements

**User decision:** "ok start with PWA"

### Vue vs React (opened, not resolved)

User stated three reasons for choosing Vue:
1. Wants opinionated build app, but not Next.js
2. Personal learning project — wants to learn Vue lifecycle (unfamiliar with Vue)
3. Wants to see how Vue approaches UI framework (flagged for further discussion)

Session ended before this topic was explored. ADR written first as instructed, then session saved.

---

## Current State of the Spec/Design

### Platform Strategy
- **PWA** with `display: standalone` for mobile learner experience
- Single codebase for admin, curator, and learner paths
- Mobile-first CSS for learner path; desktop layout for admin/curator
- Always-online (no offline support in v1)
- No app store (home screen install via PWA)
- Capacitor identified as low-cost upgrade path if native APIs become necessary

### User Roles
- Admin, Curator, Learner
- Non-admin (learner) path is mobile-primary

### Authentication
- Google OAuth + credentials sign-in
- JWT-based with role embedding
- Auto-create on first Google login (`role: 'user'`)

### Learner Path (SRS Quiz)
- 15 questions per quiz session
- Question types: multiple choice (50%), word block selection (10%), audio recognition (10%), revision (20%), foundational (20% of total, 3 at a time)
- SRS follows ANKI algorithm; mastery = 10 correct; mistakes subtract from count
- Foundation deck tracked separately (mastery out of 5)
- Word block selection gated on 100% foundational deck learned (not just mastery)
- Audio: playback required; recording not mentioned

### ADR Written
- [product-documentation/architecture/20260227T000000Z-fe-pwa-platform-strategy.md](../product-documentation/architecture/20260227T000000Z-fe-pwa-platform-strategy.md)

---

## Next Steps

~~1. **Continue Vue vs React discussion** — user has three reasons for Vue, wants to explore UI framework approach. Start here next session.~~
~~2. **Vue UI component library / design system selection** — follows from Vue decision.~~
3. **Validate iOS audio autoplay restriction** — early prototype of audio recognition question to surface this risk.
~~4. **ADR: Framework selection** — write ADR for Vue (or whichever framework is decided) once Vue vs React discussion concludes.~~
