# Current Focus — EP39 Review Mode Redesign (Memrise-style)

**Branch**: `EP39--review-mode-redesign` (to be created; artifacts authored on `EP38--review-mode-srs-demo`)
**Last updated**: 20260710T000000Z

---

## Reference point — the artifact chain

All product/architecture decisions for this redesign are settled across four artifacts. Treat these
as the source of truth; do not re-derive scope from EP38's wording.

1. **Idea Brief** — [`product-documentation/ideas/20260709T142309Z-review-mode-redesign.md`](../../../product-documentation/ideas/20260709T142309Z-review-mode-redesign.md)
2. **Gap Analysis** — [`product-documentation/20260709T143156Z-review-mode-redesign-gap-analysis.md`](../../../product-documentation/20260709T143156Z-review-mode-redesign-gap-analysis.md)
3. **Requirements Spec** — [`product-documentation/20260709T143330Z-review-mode-redesign-requirements-spec.md`](../../../product-documentation/20260709T143330Z-review-mode-redesign-requirements-spec.md)
4. **ADR (Accepted 20260710)** — [`product-documentation/architecture/20260709T143643Z-engineering-review-ahead-and-due-gated-advance.md`](../../../product-documentation/architecture/20260709T143643Z-engineering-review-ahead-and-due-gated-advance.md)

**ADR status: Accepted** (20260710). Bidirectional `Amended by` references are in place in the two
ADRs it amends (20260321 review-phase, 20260708 packaging & rating). Ready for DS/build.

## What this epic is

**EP39 makes Review more effective**, closing the three usability gaps in the shipped EP38 review
mode. Two must-have mechanisms + supporting surface:

1. **MCQ feedback moment** (Gap G-001) — after an MCQ answer, dwell on right/wrong and reveal the
   correct answer before advancing. Pure UI; mirrors the sentence path's existing two-step reveal
   ([QuizCard.vue](../../../apps/srs-demo/src/components/QuizCard.vue) ~277–299). **No ADR needed** — D5 still holds (showing correctness ≠ self-rating).
2. **Review-anytime (eager) session** (Gap G-002) — review *any* learned word on demand, not only
   when due. Rests on the ADR.
3. **Review-tab hub** (Gap G-006) — the review tab becomes a mode picker (Due Review · Practice
   Anytime), not a straight shot into a due session.

## The one architectural rule (ADR §2)

**Schedule advance is gated on due-ness, not session type.** The server advances a word's FSRS
schedule **iff the card is due at answer time** (server-derived from the persisted `due`), never
from a client flag or which session it came through. A single answer endpoint
(`POST /api/reviews/answer`) serves both due and eager answers — the due-gate is the only new rule.
Not-due answers are **read-only to the schedule** but still recorded to `review_answer_events`.

## Resolved decisions (do not re-open)

- **Keep FSRS** — no interval-ladder / reset-to-4h replacement. Memrise *feel* lives in the
  session/UI layers only.
- **Ordering (OQ-A / FR-014)** — bounded batch **≤50**, **most-overdue-first**, with
  **least-recently-practised** re-rank on the not-due tail (recency from `review_answer_events`).
- **Surfacing (OQ-B / FR-002)** — **review-tab mode hub**, not home-surfaced. Always reachable
  regardless of due-count; also kills the current caught-up dead-end.
- **"Read-only" is scoped to FSRS scheduler state** (`due`/stability/difficulty). Practice
  bookkeeping (recency, the events append) is *not* scheduler state and is allowed (NFR-005).
- **Exit anytime (FR-015)** — non-destructive; answered words already persisted (write-on-answer);
  unanswered words simply not served.
- **Re-entry (FR-016)** — due words self-demote via their advanced schedule; not-due words rotate
  via practice-recency, so the same 50 are not re-served in the same order.

## Deferred (signal preserved, not in EP39)

Retry-until-correct-today (original issue 2), Difficult Words, Speed Review, typing/listening test
types, retention-metric definition & instrumentation (G-004 — **non-blocking** per 20260709 PO
decision; §3 keeps its data flowing meanwhile). Open: OQ-C (metric), OQ-D (missed-eager → Difficult
Words feed), OI-004 (feedback advance = explicit "Next", assumed).

**Naming (deferred, 20260710)** — `srs-engine-v2` (Learning: mastery/question-building, client) and
`srs-review` (FSRS day-scale scheduling, server) are confusingly named; a rename would clarify the
two-engine split. Agreed sensible but **out of scope** for EP39.

## Guardrails

- Frontend never imports `ts-fsrs`; rating/scheduling stay server-authoritative; no self-rating
  prompt (D5). `srs-demo` has no `vue-router` — nav is state-`ref` SPA.
- Reuse EP38's endpoints/store: `getAllReviewCards` ([sqlite-review-store.ts:120](../../../packages/db/src/sqlite-review-store.ts#L120), currently
  unused by the app), `review_answer_events` (EP38-ST04), `FsrsScheduler.schedule`.

## Next Steps

1. ~~Accept the ADR + add bidirectional `Amended by` references.~~ ✅ (20260710)
2. ~~Plan review of `EP39-review-mode-redesign.md`~~ ✅ **Accepted 20260710**.
3. ~~DS01 (server: due-gate + anytime endpoint)~~ ✅ **Drafted 20260710** →
   [`EP39-DS01`](../../changelogs/EP39--review-mode-redesign/20260710T011037Z-EP39-DS01-server-due-gate-and-anytime.md).
4. ~~DS02 (client: feedback moment + review hub + Practice Anytime)~~ ✅ **Drafted 20260710** →
   [`EP39-DS02`](../../changelogs/EP39--review-mode-redesign/20260710T011740Z-EP39-DS02-client-feedback-hub-anytime.md). Next: **build**.
5. Build order: DS01 ST02 due-gate → ST03 anytime endpoint → DS02 ST04 MCQ feedback (parallel, no
   server dep) → ST05/06/07 hub + Practice Anytime session + summary.
6. ~~**DS01 built** (server): ST01 contract (`advanced` + `AnytimeReviewsResponse`), ST02 due-gate
   (`POST /api/reviews/answer` + migration 0009 nullable `rating`), ST03 `GET /api/reviews/anytime`
   (`getLastPracticedAtByWord` + pure `orderAnytimeBatch`).~~ ✅ **20260710** — all tests green
   (server 25/25 in reviews.test, db store 57, full monorepo typecheck clean).
7. ~~**DS02 built** (client): ST04 MCQ feedback moment (`feedbackDwell` prop in QuizCard, dwell+Next),
   ST05 review hub (`'review-hub'` screen + `ReviewHub.vue`, `navTo('review')`→hub), ST06 Practice
   Anytime (`loadAnytimeReviews` + `onAnytimeReview` + `reviewMode` marker + `advanced`-aware tally),
   ST07 summary (`mode`/`advanced` props, Back→hub).~~ ✅ **20260710** — full monorepo green (15/15
   typecheck, all tests incl. useReviewSession anytime/advanced coverage). **EP39 build complete.**
8. ~~Confirm the `reviewCards` seed fixture (`db3bd20`) can produce a NOT-DUE learned card for the
   anytime path (DS §7).~~ ✅ **20260710** — no extension needed: a **positive `dueOffsetMs`** already
   seeds a future-due card. Added an end-to-end test (test-seed.test.ts) proving such a card is absent
   from `/api/reviews` yet present in `/api/reviews/anytime`. Server 107/107.
9. **Remaining before merge**: manual smoke of the hub → Practice Anytime → feedback-dwell → summary
   flow (all automated layers green).
