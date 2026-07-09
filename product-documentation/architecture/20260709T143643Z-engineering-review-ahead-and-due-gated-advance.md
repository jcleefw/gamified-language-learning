# ADR: Review-Ahead (Eager Practice) and the Due-Gated Schedule-Advance Rule

**Date**: 20260709T143643Z
**Status**: Accepted (20260710)

<!-- Status: Proposed | Accepted | Superseded | Deprecated -->

**Superseded by**: N/A
**Amends**:
- [SRS Engine v2 — Review Phase](20260321T145300Z-engineering-srs-engine-v2-review-phase.md) — its due-dates-only review model (reverses the "no review-ahead" stance implied by that ADR and OQ8).
- [SRS Review Phase — Packaging & Rating](20260708T005635Z-engineering-srs-review-phase-packaging.md) — **resolves OQ8** ("Practice-mode vs scheduled-review / due-date bypass"), previously listed out of scope.

**Epic**: EP39 — Review-mode redesign
**Deciders**: PO/BA (requested)
**Inputs**: [Idea Brief](../ideas/20260709T142309Z-review-mode-redesign.md) · [Gap Analysis](../20260709T143156Z-review-mode-redesign-gap-analysis.md) · [Requirements Spec](../20260709T143330Z-review-mode-redesign-requirements-spec.md)

---

## Context

EP38 shipped Review mode as **due-only**: the learner may review a word only once the FSRS
schedule surfaces it as due, and *every* answer advances that word's schedule. Two governing
ADRs recorded this as deliberate:

- The **Review Phase ADR** (20260321) models Review entirely around due cards ("Pool Review — all
  due words globally, ordered by due ASC"; partial sessions "load remaining **due** cards").
- The **Packaging & Rating ADR** (20260708) lists **OQ8 — "Practice-mode vs scheduled-review /
  due-date bypass"** as an open question, and "Practice-mode / due-date bypass" as **out of scope**.

Product feedback (Idea Brief, 20260709) reverses the underlying assumption. The **eager learner**
wants to revise *any* already-learned word at any time — not wait for the schedule. Blocking this
is the most-cited gap (Gap G-002, top priority). But naively honouring it by letting every eager
answer advance the schedule would let out-of-schedule cramming distort the very intervals FSRS
exists to optimise — re-introducing the "over-cramming" harm Memrise's own design guards against.

We therefore need a decision that (a) permits review-ahead, and (b) protects the schedule from it.
This ADR does **not** cover the MCQ feedback-moment change (Gap G-001) — that is a pure UI change
that violates no recorded decision (D5 "never *ask* for a rating" still holds; showing correctness
is not self-rating) and needs no ADR.

---

## Decision

### 1. Review-ahead is permitted (supersedes due-only)

A learner may start a review session over **all learned words** — every word that has a persisted
`ReviewCard` (i.e. has graduated) — regardless of due date, via the store's existing
`getAllReviewCards(userId)`. This resolves **OQ8** in favour of allowing a practice/eager path.
The scheduled due-review path (EP38) is unchanged and remains the primary loop.

### 2. Schedule advance is gated on due-ness, not on session type

The server advances a word's FSRS schedule **if and only if the card is due at the moment of
answering**, determined server-side from the persisted card's `due` date — never from a
client-supplied flag or from which session the answer came through.

- **Due at answer time** → `FsrsScheduler.schedule` runs and the card advances (identical to today).
- **Not due at answer time** (eager/review-ahead) → the schedule is **left unchanged** (read-only).

This makes review-ahead safe by construction: cramming a not-yet-due word can neither pull its
next review earlier nor penalise it. A single answer endpoint serves both paths; the due-gate is
the only new rule.

### 3. Eager answers are still recorded, but never rated

A not-due answer is appended to the durable `review_answer_events` log (EP38-ST04) as a raw fact,
so a future retention metric retains full data — but it produces **no** FSRS rating and **no**
schedule mutation. Recording is fail-open and MUST NOT alter the card.

**"Read-only" is scoped to FSRS scheduler state** (`due`, stability, difficulty) — the values that
decide the next *scheduled* review. It does **not** mean "no state anywhere changes." Practice
bookkeeping is explicitly allowed: the same `review_answer_events` log doubles as the source of
**practice-recency**, which the anytime session uses to re-rank the not-due tail
(least-recently-practised first) so an early-exit + re-entry does not re-serve the same not-due
words in the same order. This changes eager ordering only, never the scheduled due date — so the
invariant (NFR-005) is upheld. Note the two halves of an eager batch behave differently on
re-entry: **due** words answered advance their schedule (§2) and self-demote; **not-due** words are
read-only and rely on practice-recency to rotate.

### 4. No new authority or contract leakage

Rating and scheduling stay server-authoritative; the frontend still imports no `ts-fsrs` and is
never shown a self-rating prompt (D5 upheld). The due-gate is a server rule; the client only
reports the same answer facts it does today.

---

## Consequences

- **Positive**: The eager-learner need is met without a scheduler rewrite (FSRS retained per Idea
  Brief). The due-gate is a small, testable invariant with a strong safety property (NFR-005: a
  not-due card's schedule is provably unchanged after an eager answer).
- **Positive**: Because the rule keys on due-ness alone, due and eager sessions share one endpoint
  and one code path — no session-type flag to spoof or keep in sync.
- **Trade-off**: Eager answers do not improve intervals even when correct — intentional (matches
  Memrise's anti-cramming intent). If future evidence shows correct eager answers *should* extend
  intervals, that is a new decision, not a bug.
- **Trade-off**: A word answered right at its due boundary advances; the same word a minute earlier
  does not. This boundary is acceptable and derives cleanly from the persisted `due`.
- **Neutral**: The retention metric (Gap G-004) remains deferred; §3 ensures its data is not lost
  in the meantime.

## Alternatives Considered

| Option | Pros | Cons | Why Not Chosen |
|--------|------|------|----------------|
| **Keep due-only** (status quo) | No change; simplest | Blocks the top-priority eager-learner need | Reverses the product decision that triggered this work |
| **Allow review-ahead, advance schedule on all answers** | One rule, no gate | Out-of-schedule cramming distorts FSRS intervals; re-introduces over-cramming harm | Corrupts the schedule FSRS exists to protect (NFR-005 violated) |
| **Separate "practice" mode that records nothing** | Fully isolated | Loses eager-answer data for the future retention metric | §3 keeps the data at no schedule cost — strictly better |
| **Client sends a `practice: true` flag to suppress advance** | Simple client toggle | Client-controlled authority; spoofable; splits behaviour by session not truth | §2 keys on server-known due-ness — authority stays server-side |

## Open Questions

| # | Question |
|---|----------|
| ~~OQ-A~~ | **Resolved 20260710** — bounded batch, **max 50 words**, ordered **most-overdue-first** (persisted `due` ASC). The due-gate (§2) then advances the front-loaded due words and leaves the not-yet-due tail read-only, with no extra branching. (Requirements FR-014.) |
| ~~OQ-B~~ | **Resolved 20260710** — the eager path is **not** home-surfaced. The existing **review tab becomes a mode-selection hub** presenting the available review modes (Due Review, Practice Anytime; future: Difficult Words / Speed Review), each launching its own session. `navTo('review')` lands on the hub instead of entering a due session directly. The hub is always reachable regardless of due-count, satisfying FR-002 without a home surface. (Requirements FR-002, OI-003.) |
| OQ-C | Retention metric definition ("% learned words retained"); does `review_answer_events` already carry enough to compute it (Requirements OI-005, deferred). |
| OQ-D | Should a repeatedly-missed eager answer ever feed a future Difficult Words list, given it does not advance the schedule? |
</content>
