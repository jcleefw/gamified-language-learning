# Gap Analysis — Review Mode (Memrise-inspired)

**Created**: 20260709T143156Z
**Source**: `/ba/gap-analysis`
**Input**: [Idea Brief — Review Mode](../ideas/20260709T142309Z-review-mode-redesign.md)

---

## Context

- **Business driver**: Make revision effective and raise **% of learned words retained** by delivering
  a review experience that gives clear feedback and serves the eager learner. *(The metric itself is a
  later/parallel concern — see G-004; it does not block delivery.)*
- **Scope (in)**: Feedback moment on MCQ; a **review-anytime (eager) session** that is read-only to the
  FSRS schedule; exposing learned-word listing.
- **Scope (out)**: Retry-until-correct-today, Difficult Words, Speed Review, typing/listening test
  types, any FSRS replacement, retention-metric instrumentation.

## Current State Summary

Graduation seeds a `ReviewCard` per learned word and FSRS schedules it, but the platform baseline has
no review *experience* wired over those cards. The natural schedule-driven design surfaces **only due
cards**, asks each once, and would advance FSRS on every answer. In the shared quiz UI, MCQ answers
auto-advance with no dwell or correct-answer reveal — only the sentence path pauses to reveal (the
`QuizCard` two-step reveal). There is **no concept of a non-scheduling answer**, and **no retention
measurement** anywhere. The store already exposes **`getAllReviewCards(userId)`** in
`SqliteReviewStore`, available but unused by the app.

## Desired State Summary

The learner gets a clear right/wrong moment (with correct-answer reveal) on every question type; can
launch a review of **any learned word anytime** without disturbing real FSRS intervals; and reaches
learned-word listing through the app.

## Gap Register

| ID | Dimension | Current (baseline) | Desired | Gap | Type | Impact |
|----|-----------|--------------------|---------|-----|------|--------|
| G-001 | System (UI) | Shared `QuizCard` MCQ path auto-advances, no reveal; sentence path already dwells + reveals | Dwell + correct/wrong + correct-answer reveal on MCQ too | Feedback moment absent on the MCQ path | **Partial** | High |
| G-002 | Process (session) | A schedule-driven review surfaces due cards only | Session can pull *all learned* words on demand | No eager/anytime session flow | **Missing** | High |
| G-003 | Policy (scheduling) | A naive review advances FSRS on every answer | Practice answers are read-only to the schedule | No "non-advancing answer" rule/path server-side | **Missing** | High |
| G-004 | Data (metric) | No retention measurement | Observable "% learned words retained" | Metric undefined and uninstrumented | **Missing** | Low (deferred) |
| G-005 | System (data access) | `getAllReviewCards` exists in the store, unused by app | App can list all learned words for review | Store capability present; not exposed via API/UI | **Partial** | Med |
| G-006 | Process (surfacing) | A review entry gated on due-count | Anytime path reachable even when nothing due | No always-reachable surface for "practice anyway" | **Missing** | Med |

## Prioritized Gaps

| Priority | Gap | Rationale |
|----------|-----|-----------|
| 1 | **G-002** | Most useful outcome; the eager learner's core ask. |
| 2 | **G-003** | Must land *with* G-002 or eager review silently corrupts real intervals. |
| 3 | **G-001** | High impact, low effort — the sentence reveal path is a working template. |
| 4 | **G-005 / G-006** | Enabling + surfacing for G-002; lower risk, do alongside. |
| 5 | **G-004** | Deferred. Instrument the metric later; **not a delivery blocker** (PO decision, 20260709). |

## Recommendations (actions, not designs)

- **G-002 / G-005**: Expose learned-word listing to the review session via `getAllReviewCards`; define
  ordering and whether eager items interleave with, or are separate from, due items.
- **G-003**: Establish the policy that a not-due/eager answer does **not** call
  `FsrsScheduler.schedule`; decide whether it is still *recorded* (keeps the future metric viable).
- **G-001**: Adopt the sentence path's reveal pattern as the MCQ standard; decide the dwell interaction
  (explicit Next vs. timed auto-advance).
- **G-006**: Decide the surface for the anytime path (always visible vs. hidden-when-clear,
  Memrise-style).
- **G-004**: Later — define "retained" (candidate: correct on the next scheduled review of a graduated
  word) and confirm whether the durable answer log already carries enough to compute it.

## Out of Scope Gaps (signal preserved)

- Retry-until-correct-today + repeats→rating — may itself be a driver of the G-004 metric; flagged as a
  validation risk when the metric work lands.
- Difficult Words isolation; Speed Review shell; typing/listening recall types.

*(These deferred modes are recorded in the [Review-Ahead ADR — Deferred Review Modes](../architecture/20260709T143643Z-engineering-review-ahead-and-due-gated-advance.md).)*
