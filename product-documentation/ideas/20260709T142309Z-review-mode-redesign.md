# Idea Brief — Review Mode Redesign (Memrise-style)

**Created**: 20260709T142309Z
**Source**: `/product/ideate` interview
**Relates to**: EP38 (Review Mode in `srs-demo`) — this brief supersedes several EP38 scope decisions (see Constraints)

---

### Core Idea

A more effective revision experience that solidifies the learner's retention and familiarity, modelled on Memrise's review loop.

### Who It's For

**Primary**: the language learner using `srs-demo` — particularly the *eager learner* who wants to reinforce material daily rather than wait for the SRS schedule to surface it.

**Secondary**: none identified.

### Problem It Solves

The current EP38 review mode has three concrete gaps that blunt its effectiveness (all confirmed against the code):

1. **No feedback moment.** Answering an MCQ emits the result and advances the queue immediately ([QuizCard.vue:39-47](../../apps/srs-demo/src/components/QuizCard.vue#L39-L47), [useReviewSession.ts:186](../../apps/srs-demo/src/composables/useReviewSession.ts#L186)) — the correct/wrong highlight never gets a dwell moment and there is no correct-answer reveal. The user is left uncertain whether they were right, which undercuts active recall.
2. **No same-day retry loop.** Each due word is assembled exactly once (`retries = 0`, [useReviewSession.ts:121](../../apps/srs-demo/src/composables/useReviewSession.ts#L121)); a miss is not re-served until correct, and repeat count does not influence the rating. *(Deferred in this redesign — see Non-Goals.)*
3. **No review-anytime.** Review honours due dates only; learned-but-not-due words cannot be practised. An eager learner who wants to revise everything daily is blocked ([EP38 plan, Out of scope](../../.agents/plans/epics/EP38-review-mode-srs-demo.md)).

**Frequency/cost**: hits on every review session — issue 1 on every question, issue 3 every time the due queue is empty but the learner still wants to practise.

### How It Works

Two must-have changes, both layered on the **existing FSRS engine** (no scheduler replacement):

- **Feedback moment (UI layer)**: after an MCQ answer, hold on a right/wrong state — show the chosen answer's correctness and reveal the correct answer on a miss — before the learner advances (bringing the MCQ path in line with the two-step reveal the sentence path already has, [QuizCard.vue:277-299](../../apps/srs-demo/src/components/QuizCard.vue#L277-L299)).
- **Review-anytime / eager mode (session layer)**: a session that pulls *learned* words regardless of due date. These practice answers are **read-only to the FSRS schedule** — cramming an already-known or not-yet-due word never disturbs its real intervals. Following Memrise's own design, the "review anytime" path is available even when the due queue is empty (Memrise makes it a deliberately secondary path to discourage over-cramming; exact surfacing TBD).

The scheduled/due-review loop continues to advance FSRS as today.

### What Success Looks Like

**Primary metric: % of learned words retained** goes up. A month post-ship, a larger share of words the learner has graduated are still recalled correctly when reviewed.

### Constraints and Non-Goals

**Constraints**
- **Keep FSRS.** No replacement with Memrise's fixed interval ladder (4h→12h→…→6mo) or hard reset-to-4h. The Memrise *feel* is delivered in the session/UI layers; the adaptive engine (EP36/EP37, server-authoritative, matches the governing ADRs) stays.
- **Practice answers are read-only to the schedule** (option "a" — never advance FSRS for a not-due/eager review).
- Continue to honour the existing review ADRs where unchanged: no self-rating prompt (D5), server-authoritative rating, frontend never imports `ts-fsrs`.

**Non-Goals (deferred)**
- **Retry-until-correct-today** with repeat-count affecting rating (original issue 2). Strong future candidate — layers on FSRS as a *session* mechanic with no engine cost — but out of this redesign.
- **Difficult Words** mode (isolate frequently-missed items). *Nice-to-have*, not committed.
- **Speed Review** (timed, 3-hearts, streak-to-earn-heart shell).
- **Typing / listening test types.**

### Known Unknowns

- **Measuring "% of learned words retained"** — no retention metric exists today. Needs a definition (retained = correct on next scheduled review? rolling accuracy over learned set?) and instrumentation. This is the biggest open item, since it *is* the success metric. [Open question]
- **Surfacing of review-anytime** — Memrise hides it when nothing is due and makes users "dig." How prominent should the eager path be in `srs-demo`, and does hiding-when-clear apply here? [Open question]
- **Feedback dwell interaction** — explicit "Next" tap vs. brief auto-advance delay; consistency with the sentence path. [Open question]
- **Read-only practice vs. Difficult Words tension** — if practice never advances FSRS, does a practised-and-missed word still feed a future Difficult Words list? [Open question]
- **Does "% retained" improve without the retry loop?** The deferred issue-2 mechanic may be a meaningful driver of the very metric chosen; worth validating that feedback + review-anytime alone move it. [Open question]
</content>
</invoke>
