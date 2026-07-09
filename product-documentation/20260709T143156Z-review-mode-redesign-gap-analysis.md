# Gap Analysis — Review Mode Redesign (Memrise-style)

**Created**: 20260709T143156Z
**Source**: `/ba/gap-analysis`
**Input**: [Idea Brief — Review Mode Redesign](ideas/20260709T142309Z-review-mode-redesign.md)
**Relates to**: EP38 (Review Mode in `srs-demo`)

---

## Context

- **Business driver**: Make revision more effective and raise **% of learned words retained** by closing the three usability gaps in the shipped EP38 review mode. *(The metric itself is a later/parallel concern — see G-004; it does not block delivery.)*
- **Scope (in)**: Feedback moment on MCQ; **review-anytime (eager) session** that is read-only to the FSRS schedule; exposing learned-word listing.
- **Scope (out)**: Retry-until-correct-today, Difficult Words, Speed Review, typing/listening test types, any FSRS replacement, retention-metric instrumentation.

## Current State Summary

Review surfaces **only due cards** ([useReviewSession.ts:92-131](../apps/srs-demo/src/composables/useReviewSession.ts#L92)), asks each once, and advances FSRS server-side on every answer. MCQ answers auto-advance with no dwell or correct-answer reveal; only the sentence path pauses to reveal ([QuizCard.vue:277-299](../apps/srs-demo/src/components/QuizCard.vue#L277-L299)). There is **no concept of a non-scheduling answer**, and **no retention measurement** anywhere — only a raw `review_answer_events` append-only log (EP38-ST04). The store already exposes **`getAllReviewCards(userId)`** ([sqlite-review-store.ts:120](../packages/db/src/sqlite-review-store.ts#L120)), unused by the app.

## Desired State Summary

The learner gets a clear right/wrong moment (with correct-answer reveal) on every question type; can launch a review of **any learned word anytime** without disturbing real FSRS intervals; learned-word listing is reachable through the app.

## Gap Register

| ID | Dimension | Current | Desired | Gap | Type | Impact |
|----|-----------|---------|---------|-----|------|--------|
| G-001 | System (UI) | MCQ auto-advances, no reveal | Dwell + correct/wrong + correct-answer reveal on MCQ | Feedback moment absent on MCQ path (exists for sentences) | **Partial** | High |
| G-002 | Process (session) | Session pulls due cards only | Session can pull *all learned* words on demand | No eager/anytime session flow | **Missing** | High |
| G-003 | Policy (scheduling) | Every answer advances FSRS | Practice answers are read-only to schedule | No "non-advancing answer" rule/path server-side | **Missing** | High |
| G-004 | Data (metric) | No retention measurement | Observable "% learned words retained" | Metric undefined and uninstrumented | **Missing** | Low (deferred) |
| G-005 | System (data access) | `getAllReviewCards` exists, unused by app | App can list all learned words for review | Store capability present; not exposed via API/UI | **Partial** | Med |
| G-006 | Process (surfacing) | Review entry gated on due-count badge | Anytime path reachable even when nothing due | No home surface for "practice anyway" | **Missing** | Med |

## Prioritized Gaps

| Priority | Gap | Rationale |
|----------|-----|-----------|
| 1 | **G-002** | Most useful outcome; the eager learner's core ask. |
| 2 | **G-003** | Must land *with* G-002 or eager review silently corrupts real intervals. |
| 3 | **G-001** | High impact, low effort — the sentence reveal path is a working template. |
| 4 | **G-005 / G-006** | Enabling + surfacing for G-002; lower risk, do alongside. |
| 5 | **G-004** | Deferred. Instrument the metric later; **not a delivery blocker** (user decision, 20260709). |

## Recommendations (actions, not designs)

- **G-002 / G-005**: Expose learned-word listing to the review session via the existing `getAllReviewCards`; define ordering and whether eager items interleave with, or are separate from, due items.
- **G-003**: Establish the policy that a not-due/eager answer does **not** call `FsrsScheduler.schedule`; decide whether it is still *recorded* to `review_answer_events` (keeps future metric viable).
- **G-001**: Adopt the sentence path's reveal pattern as the MCQ standard; decide the dwell interaction (explicit Next vs. timed auto-advance).
- **G-006**: Decide the home surface for the anytime path (always visible vs. hidden-when-clear, Memrise-style).
- **G-004**: Later — define "retained" (candidate: correct on the next scheduled review of a graduated word) and confirm whether `review_answer_events` already carries enough to compute it.

## Out of Scope Gaps (signal preserved)

- Retry-until-correct-today + repeats→rating (original issue 2) — may itself be a driver of the G-004 metric; flagged as a validation risk when the metric work lands.
- Difficult Words isolation; Speed Review shell; typing/listening recall types.
</content>
