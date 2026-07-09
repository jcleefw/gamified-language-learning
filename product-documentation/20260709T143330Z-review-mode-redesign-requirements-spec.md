# Requirements Specification — Review Mode Redesign (Memrise-style)

**Created**: 20260709T143330Z
**Source**: `/ba/requirements-spec`
**Inputs**: [Idea Brief](ideas/20260709T142309Z-review-mode-redesign.md) · [Gap Analysis](20260709T143156Z-review-mode-redesign-gap-analysis.md)
**Relates to**: EP38 (Review Mode in `srs-demo`)

---

## 1. Overview

- **Purpose**: Make revision more effective by (a) giving the learner a clear right/wrong feedback moment on every question type, and (b) letting the eager learner review *any* learned word at any time without disturbing its real spaced-repetition schedule. Targets the three usability gaps in the shipped EP38 review mode.
- **Scope (in)**: MCQ feedback moment; an "anytime" (eager) review session over all learned words; the policy that not-due answers are read-only to the FSRS schedule; exposing learned-word listing and a home surface for the anytime path.
- **Scope (excluded)**: Retry-until-correct-today; Difficult Words; Speed Review; typing/listening test types; any FSRS replacement; retention-metric definition and instrumentation (deferred, non-blocking).
- **Stakeholders**: Learner (primary user); PO/BA (requested, signs off). No secondary stakeholders identified.

## 2. Functional Requirements

| ID | Requirement | Priority | Source |
|----|-------------|----------|--------|
| FR-001 | The system shall let the learner start a review session over all learned words regardless of due date. | Must | Gap G-002 |
| FR-002 | The system shall present the review tab as a **mode-selection hub** listing the available review modes (Due Review, Practice Anytime), reachable regardless of due-count, rather than entering a due session directly. The anytime entry point is thus always present even when nothing is due. | Must | Gap G-006 · OI-003 (resolved 20260710) |
| FR-003 | The system shall treat a word as "learned" for review-anytime purposes if and only if it has a persisted review card (i.e. it has graduated). | Must | Gap G-002/G-005 |
| FR-004 | The system shall present each learned word in an anytime session as a question built through the existing quiz pipeline (same UI as Learning/due review). | Must | Idea Brief |
| FR-005 | The system shall **not** advance a word's FSRS schedule when the word answered is **not due** at the moment of answering. | Must | Gap G-003 |
| FR-006 | The system shall advance a word's FSRS schedule as it does today when the word answered **is due** at the moment of answering, whether reached via the due queue or an anytime session. | Must | Gap G-003 |
| FR-007 | The system shall determine due-vs-not-due server-side from the persisted card's due date at answer time, not from a client-supplied flag or session type. | Must | Gap G-003 |
| FR-008 | After the learner answers a multiple-choice question, the system shall display whether the selected answer was correct before the next question is shown. | Must | Gap G-001 |
| FR-009 | When a multiple-choice answer is incorrect, the system shall reveal the correct answer. | Must | Gap G-001 |
| FR-010 | The system shall require an explicit learner action to advance from the feedback state to the next question. `[Assumed — matches existing sentence-path reveal; alt: timed auto-advance, see OI-004]` | Must | Gap G-001 |
| FR-011 | The system shall skip any learned word that cannot be resolved to content/distractors (orphan) without failing the session. | Should | Pillar-3 tolerance (existing) |
| FR-012 | The system shall record an eager (not-due) answer to the durable `review_answer_events` log for future metric use, without that record affecting the schedule. | Should | Gap G-003/G-004 · `[OI-002]` |
| FR-013 | The system shall show an end-of-session summary for an anytime session (e.g. count reviewed). | Should | Parity with due-review summary |
| FR-014 | The system shall assemble an anytime session as a **bounded batch of at most 50 words**, ordered **most-overdue-first** (by persisted `due` ascending), with **least-recently-practised first as the re-rank/tie-break** for the not-due (read-only) portion — practice recency derived from `review_answer_events`. This ensures a session re-entered after early exit does not re-serve the same not-due words in the same order. | Should | Gap G-002 · OI-001 (resolved 20260710) |
| FR-015 | The system shall let the learner exit any review session (due or anytime) at any time. Exit is non-destructive: words already answered are persisted per write-on-answer; unanswered words are simply not served and remain in their prior state. | Must | Exit-anytime (20260710) |
| FR-016 | On re-entry to an anytime session, the system shall not re-serve the same not-due words in the same order as the prior session, using practice-recency (FR-014). Due words answered in the prior session self-demote via their advanced schedule (FR-006). | Should | Same-order avoidance (20260710) |

## 3. Non-Functional Requirements

| ID | Category | Requirement | Measure |
|----|----------|-------------|---------|
| NFR-001 | Consistency | MCQ feedback presentation matches the existing sentence-path reveal pattern | Same correct/wrong + correct-answer reveal states |
| NFR-002 | Architecture | Rating and scheduling remain server-authoritative | Frontend performs no rating/interval math |
| NFR-003 | Architecture | Frontend bundle does not import `ts-fsrs` | Grep guard passes (existing EP38 AC) |
| NFR-004 | UX (D5) | The learner is never shown a self-rating prompt | No "how well did you know this?" UI in any review path |
| NFR-005 | Data safety | An anytime answer never mutates a not-due card's **FSRS scheduler state** (`due`, stability, difficulty). Read-only is scoped to scheduler state only — practice bookkeeping (recency for FR-014 ordering, the `review_answer_events` append) is not scheduler state and is permitted. | Not-due card's `due`/stability/difficulty unchanged after answer; the word's next *scheduled* due date does not move |

## 4. Constraints

- **Keep FSRS** — no replacement with a fixed interval ladder or hard reset-to-4h (Idea Brief decision).
- Governing EP38 ADRs remain in force where unchanged: server-authoritative rating, no self-rating prompt (D5), frontend never imports `ts-fsrs`.
- `srs-demo` has no `vue-router`; navigation is state-`ref` SPA (existing EP38-ST08 nav).

## 5. Assumptions

- **A-1**: A word is "learned" exactly when it has a review card; `getAllReviewCards(userId)` returns the full learned set. `[Assumed — verify no non-graduated learned state exists]`
- **A-2**: Due-ness is reliably derivable server-side at answer time from the persisted card. `[Assumed]`
- **A-3**: The preloaded cross-deck `wordPool` covers content for all learned words (orphans excepted). `[Assumed — matches current due-review resolution]`
- **A-4**: The explicit-Next feedback interaction (FR-010) is acceptable; not yet confirmed vs. timed auto-advance.

## 6. Dependencies

- `SqliteReviewStore.getAllReviewCards(userId)` — [sqlite-review-store.ts:120](../packages/db/src/sqlite-review-store.ts#L120) (exists, currently unused by app).
- Existing review-answer endpoint + `FsrsScheduler.schedule` (server) — needs the FR-005/FR-007 due-gate added.
- Existing quiz-assembly pipeline (`assembleBatch`, `nextQuestion`) and `QuizCard.vue` (needs FR-008/009/010 on the MCQ path).
- `review_answer_events` append-only log (EP38-ST04) — for FR-012.

## 7. Open Items

| ID | Question | Owner | Notes |
|----|----------|-------|-------|
| ~~OI-001~~ | **Resolved 20260710** — bounded batch, **max 50 words**, **most-overdue-first**. See FR-014. | PO | ✔ |
| OI-002 | Are eager (not-due) answers recorded to `review_answer_events` (FR-012), or dropped entirely? | PO | Recording keeps the deferred metric viable |
| ~~OI-003~~ | **Resolved 20260710** — not home-surfaced; the **review tab becomes a mode-selection hub** listing review modes. See FR-002. | PO | ✔ |
| OI-004 | Feedback advance mechanism — explicit "Next" (FR-010) vs. timed auto-advance | PO | Consistency vs. speed |
| OI-005 | Retention metric definition ("% learned words retained") | PO | Deferred; non-blocking per 20260709 decision |
</content>
