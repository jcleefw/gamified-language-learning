# Idea Brief — Review Mode (Memrise-inspired)

**Created**: 20260709T142309Z
**Source**: `/product/ideate` interview

---

### Core Idea

A revision experience that solidifies the learner's retention and familiarity for words they have
already learned, modelled on Memrise's review loop.

### Who It's For

**Primary**: the language learner using `srs-demo` — particularly the *eager learner* who wants to
reinforce material daily rather than wait for the SRS schedule to surface it.

**Secondary**: none identified.

### Problem It Solves

Once a word graduates, the system seeds a review card and FSRS schedules it for day-scale retention.
A complete review experience has to serve both the scheduled loop and the eager learner. Three
concrete problems shape it:

1. **No feedback moment.** An MCQ answer should dwell on a right/wrong state and reveal the correct
   answer on a miss — matching the two-step reveal the sentence path already gives. Without it the
   learner is left uncertain whether they were right, which undercuts active recall.
2. **No same-day retry loop.** A missed word is not re-served until correct, and repeat count does
   not influence the rating. *(Deferred — see Non-Goals.)*
3. **No review-anytime.** A schedule-driven review naturally surfaces only *due* words; a
   learned-but-not-due word cannot be practised. An eager learner who wants to revise everything
   daily is blocked.

**Frequency/cost**: hits every review session — issue 1 on every question, issue 3 every time the due
queue is empty but the learner still wants to practise.

### How It Works

Two must-have mechanisms, both layered on the **existing FSRS engine** (no scheduler replacement):

- **Feedback moment (UI layer)**: after an MCQ answer, hold on a right/wrong state — show the chosen
  answer's correctness and reveal the correct answer on a miss — before the learner advances, bringing
  the MCQ path in line with the two-step reveal the sentence path already has in the shared `QuizCard`.
- **Review-anytime / eager mode (session layer)**: a session that pulls *learned* words regardless of
  due date. These practice answers are **read-only to the FSRS schedule** — cramming an already-known
  or not-yet-due word never disturbs its real intervals (see the
  [Review-Ahead & Due-Gated Advance ADR](../architecture/20260709T143643Z-engineering-review-ahead-and-due-gated-advance.md)).
  Following Memrise's own design, the anytime path is a deliberately *secondary* route — surfaced in a
  review-mode hub rather than pushed — to discourage over-cramming.

The scheduled/due-review loop remains the primary retention mechanism and advances FSRS on each due
answer.

### What Success Looks Like

**Primary metric: % of learned words retained** goes up. A month post-ship, a larger share of words
the learner has graduated are still recalled correctly when reviewed.

### Constraints and Non-Goals

**Constraints**
- **Keep FSRS.** No replacement with Memrise's fixed interval ladder (4h→12h→…→6mo) or hard
  reset-to-4h. The Memrise *feel* is delivered in the session/UI layers; the adaptive, server-authoritative
  engine that matches the governing ADRs stays.
- **Practice answers are read-only to the schedule** — never advance FSRS for a not-due/eager review.
- Honour the governing review rules: no self-rating prompt (D5), server-authoritative rating, the
  frontend never imports `ts-fsrs`.

**Non-Goals (deferred)** — recorded in the ADR's *Deferred Review Modes*:
- **Retry-until-correct-today** with repeat-count affecting rating (issue 2). Strong future candidate —
  a *session* mechanic with no engine cost — but out of the first cut.
- **Difficult Words** mode (isolate frequently-missed items). *Nice-to-have*, not committed.
- **Speed Review** (timed, 3-hearts, streak-to-earn-heart shell).
- **Typing / listening test types.**

### Known Unknowns

- **Measuring "% of learned words retained"** — no retention metric exists yet. Needs a definition
  (retained = correct on next scheduled review? rolling accuracy over the learned set?) and
  instrumentation. Biggest open item, since it *is* the success metric. [Open question]
- **Surfacing of review-anytime** — how prominent should the eager path be, and does hiding-when-clear
  (Memrise-style) apply here? [Open question — resolved to a review-mode hub, see Requirements FR-002]
- **Feedback dwell interaction** — explicit "Next" tap vs. brief auto-advance delay; consistency with
  the sentence path. [Open question]
- **Read-only practice vs. Difficult Words tension** — if practice never advances FSRS, does a
  practised-and-missed word still feed a future Difficult Words list? [Open question — ADR OQ-D]
- **Does "% retained" improve without the retry loop?** The deferred retry mechanic may be a
  meaningful driver of the chosen metric; worth validating that feedback + review-anytime alone move
  it. [Open question]
