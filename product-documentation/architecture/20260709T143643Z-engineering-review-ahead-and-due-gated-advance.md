# ADR: Review-Ahead (Eager Practice) and the Due-Gated Schedule-Advance Rule

**Date**: 20260709T143643Z
**Status**: Accepted (20260710)

<!-- Status: Proposed | Accepted | Superseded | Deprecated -->

**Superseded by**: N/A
**Relates to**:
- [SRS Engine v2 — Review Phase](20260321T145300Z-engineering-srs-engine-v2-review-phase.md) — the FSRS mechanics of the scheduled due-review loop (`enable_short_term:false`, write-on-answer) this ADR builds the eager path alongside.
- [SRS Review Phase — Packaging & Rating](20260708T005635Z-engineering-srs-review-phase-packaging.md) — the layer boundaries and rating rules (D5 no self-rating prompt; server-authoritative rating) this ADR upholds.

**Epic**: Review Mode
**Deciders**: PO/BA (requested)
**Inputs**: [Idea Brief](../ideas/20260709T142309Z-review-mode-redesign.md) · [Gap Analysis](../research/20260709T143156Z-review-mode-redesign-gap-analysis.md) · [Requirements Spec](../research/20260709T143330Z-review-mode-redesign-requirements-spec.md)

---

## Context

Review mode serves two distinct learner needs over the same pool of graduated words:

1. **The scheduled due-review loop** — FSRS surfaces a word when it is due, the learner answers, and
   the schedule advances toward longer retention intervals. This is the primary retention mechanism.
2. **The eager learner** — someone who wants to revise material *daily*, reinforcing any word they
   have already learned rather than waiting for the schedule to surface it. Blocking this is the
   most-cited learner need (Gap G-002, top priority).

The tension between them is a scheduling-integrity problem. If an eager learner practises a word that
is **not yet due** and that answer advances the FSRS schedule, out-of-schedule cramming distorts the
very intervals FSRS exists to optimise — re-introducing the over-cramming harm that spaced repetition
is designed to prevent.

We therefore need a rule that (a) permits review-ahead over all learned words, and (b) protects the
schedule from eager practice. This ADR covers only that scheduling rule. The MCQ **feedback moment**
(Gap G-001) is a pure UI change that violates no recorded decision — D5's "never *ask* for a rating"
still holds, since showing correctness is not self-rating — and needs no ADR.

---

## Decision

### 1. Review-ahead is permitted over all learned words

A learner may start a review session over **all learned words** — every word that has a persisted
`ReviewCard` (i.e. has graduated) — regardless of due date, via the store's `getAllReviewCards(userId)`.
The scheduled due-review loop is the primary path; the eager (anytime) path sits alongside it.

### 2. Schedule advance is gated on due-ness, not on session type

The server advances a word's FSRS schedule **if and only if the card is due at the moment of
answering**, determined server-side from the persisted card's `due` date — never from a
client-supplied flag or from which session the answer came through.

- **Due at answer time** → `FsrsScheduler.schedule` runs and the card advances.
- **Not due at answer time** (eager/review-ahead) → the schedule is **left unchanged** (read-only).

This makes review-ahead safe by construction: cramming a not-yet-due word can neither pull its next
review earlier nor penalise it. A single answer endpoint serves both paths; the due-gate is the only
scheduling rule that distinguishes them.

### 3. Eager answers are still recorded, but never rated

A not-due answer is appended to the durable `review_answer_events` log as a raw fact, so a future
retention metric retains full data — but it produces **no** FSRS rating and **no** schedule mutation.
Recording is fail-open and MUST NOT alter the card.

**"Read-only" is scoped to FSRS scheduler state** (`due`, stability, difficulty) — the values that
decide the next *scheduled* review. It does **not** mean "no state anywhere changes." Practice
bookkeeping is explicitly allowed: the same `review_answer_events` log doubles as the source of
**practice-recency**, which the anytime session uses to re-rank the not-due tail
(least-recently-practised first) so an early-exit + re-entry does not re-serve the same not-due words
in the same order. This changes eager ordering only, never the scheduled due date — so the invariant
(NFR-005) is upheld. Note the two halves of an eager batch behave differently on re-entry: **due**
words answered advance their schedule (§2) and self-demote; **not-due** words are read-only and rely
on practice-recency to rotate.

### 4. Review modes surface through a mode-selection hub

The review tab is a **mode-selection hub**, not a direct entry into a single session. It lists the
available review modes, each launching its own session; `navTo('review')` lands on the hub, which is
always reachable regardless of due-count. The initial mode set is **Due Review** and **Practice
Anytime** (§1/§2). The hub is the extension point for the deferred modes below: adding one is a new
hub entry + its session, with **no change to the due-gate or the scheduler**.

### 5. No new authority or contract leakage

Rating and scheduling stay server-authoritative; the frontend imports no `ts-fsrs` and is never shown
a self-rating prompt (D5 upheld). The due-gate is a server rule; the client reports only answer facts.

---

## Deferred Review Modes (recorded, not built)

These modes were discussed and are deliberately **out of the committed scope**. They are recorded
here because §4's hub is designed to accommodate them and because each carries a design constraint or
open question worth preserving. None requires a scheduler change; all layer on the same FSRS engine
and the due-gate above.

| Mode | What it is | Why deferred / constraint | Open question |
|------|-----------|---------------------------|---------------|
| **Retry-until-correct-today** | Within a session, re-serve a missed word until answered correctly; repeat-count could influence the rating | Strong future candidate — a pure *session* mechanic with no engine cost. Left out of the first cut to keep the due-gate rule small and isolated. May itself drive the retention metric (Gap G-004), so validate its effect when that metric lands. | Does repeat-count feed the rating, or stay session-only? |
| **Difficult Words** | A mode that isolates frequently-missed items for focused practice | Nice-to-have, not committed. Naturally a hub entry (§4) over a "most-missed" query. Interacts with §3: eager misses are recorded but never rated. | OQ-D — should a repeatedly-missed **eager** (not-due) answer feed a future Difficult Words list, given it never advances the schedule? |
| **Speed Review** | Timed drill with a lives/hearts shell (e.g. 3 hearts, streak-to-earn) | Game-feel layer; no scheduling implication. A distinct hub mode when built. | Timing/scoring rules TBD. |
| **Typing / listening test types** | Recall via typed answer or audio prompt instead of MCQ/word-block | New question *types*, not a new scheduling rule — extends the quiz pipeline and `QuizCard`, orthogonal to this ADR. | Content/audio availability per word. |

The **retention metric** ("% of learned words retained", Gap G-004) is the intended success measure
but is deferred and **non-blocking** (PO decision, 20260709); §3 keeps `review_answer_events` fed so
no data is lost meanwhile (OQ-C).

---

## Consequences

- **Positive**: The eager-learner need is met without a scheduler rewrite (FSRS retained per the Idea
  Brief). The due-gate is a small, testable invariant with a strong safety property (NFR-005: a
  not-due card's schedule is provably unchanged after an eager answer).
- **Positive**: Because the rule keys on due-ness alone, due and eager sessions share one endpoint and
  one code path — no session-type flag to spoof or keep in sync.
- **Positive**: The mode hub (§4) makes the deferred modes purely additive — each is a new entry +
  session, never a scheduler change.
- **Trade-off**: Eager answers do not improve intervals even when correct — intentional (matches the
  anti-cramming intent). If future evidence shows correct eager answers *should* extend intervals,
  that is a new decision, not a bug.
- **Trade-off**: A word answered right at its due boundary advances; the same word a minute earlier
  does not. This boundary is acceptable and derives cleanly from the persisted `due`.
- **Neutral**: The retention metric (Gap G-004) remains deferred; §3 ensures its data is not lost in
  the meantime.

## Alternatives Considered

| Option | Pros | Cons | Why Not Chosen |
|--------|------|------|----------------|
| **Due-only review** (no eager path) | Simplest; one loop | Blocks the top-priority eager-learner need | Fails the core learner requirement (Gap G-002) |
| **Allow review-ahead, advance schedule on all answers** | One rule, no gate | Out-of-schedule cramming distorts FSRS intervals; re-introduces over-cramming harm | Corrupts the schedule FSRS exists to protect (NFR-005 violated) |
| **Separate "practice" mode that records nothing** | Fully isolated | Loses eager-answer data for the future retention metric | §3 keeps the data at no schedule cost — strictly better |
| **Client sends a `practice: true` flag to suppress advance** | Simple client toggle | Client-controlled authority; spoofable; splits behaviour by session not truth | §2 keys on server-known due-ness — authority stays server-side |

## Open Questions

| # | Question |
|---|----------|
| ~~OQ-A~~ | **Resolved 20260710** — bounded batch, **max 50 words**, ordered **most-overdue-first** (persisted `due` ASC). The due-gate (§2) then advances the front-loaded due words and leaves the not-yet-due tail read-only, with no extra branching. (Requirements FR-014.) |
| ~~OQ-B~~ | **Resolved 20260710** — the eager path is **not** home-surfaced; it is a mode in the review-tab hub (§4). `navTo('review')` lands on the hub, always reachable regardless of due-count, satisfying FR-002 without a home surface. |
| OQ-C | Retention metric definition ("% learned words retained"); does `review_answer_events` already carry enough to compute it (Requirements OI-005, deferred). |
| OQ-D | Should a repeatedly-missed eager answer ever feed a future Difficult Words list, given it does not advance the schedule? (See Deferred Review Modes.) |
