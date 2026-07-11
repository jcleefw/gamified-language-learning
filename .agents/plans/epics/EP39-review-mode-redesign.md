# EP39 - Review Mode: Eager Practice & Feedback (Memrise-inspired)

**Created**: 20260710T010141Z
**Status**: Impl-Complete

<!-- Status: Draft | Accepted | In Progress | Impl-Complete | BDD Pending | Completed | Shelved | Withdrawn -->

**Type**: Epic Plan
**Depends on**: EP38 (Review mode: `GET /api/reviews`, `POST /api/reviews/answer`, `review_answer_events` log, `SqliteReviewStore`, `useReviewSession`, `QuizCard`, `ReviewSummary`, top nav), EP36 (`@gll/srs-review`: `FsrsScheduler.schedule`), EP30/EP34 (`@gll/db` async store)
**Builds on**: [EP38 – Review Mode in `srs-demo`](EP38-review-mode-srs-demo.md) — the scheduled due-review loop and its endpoints/UI plumbing.

**Architecture**: [Review-Ahead (Eager Practice) and the Due-Gated Schedule-Advance Rule](../../../product-documentation/architecture/20260709T143643Z-engineering-review-ahead-and-due-gated-advance.md) — **Status: Accepted** (20260710). D5 (no self-rating prompt) and server-authoritative rating remain in force. Product inputs: [Idea Brief](../../../product-documentation/ideas/20260709T142309Z-review-mode-redesign.md) · [Gap Analysis](../../../product-documentation/research/20260709T143156Z-review-mode-redesign-gap-analysis.md) · [Requirements Spec](../../../product-documentation/research/20260709T143330Z-review-mode-redesign-requirements-spec.md).

---

## Problem Statement

EP38's due-review loop serves the schedule: a word is reviewable only once FSRS surfaces it as due.
That leaves the **eager learner** — the user who wants to reinforce material daily rather than wait for
the schedule — with three unmet needs:

1. **No review-anytime (G-002).** A learned-but-not-due word cannot be practised. When the due queue is
   empty the learner reaches a "caught up" terminus even though they want to keep going.
2. **No non-scheduling answer (G-003).** In the due loop every answer advances FSRS — which is correct
   *because every reviewed card is due*. But naively extending review to not-due words while still
   advancing on every answer would let out-of-schedule cramming distort the very intervals FSRS exists
   to optimise.
3. **No feedback moment (G-001).** An MCQ answer advances the queue immediately — the correct/wrong
   highlight never dwells and the correct answer is never revealed on a miss. Only the sentence path
   pauses to reveal. This undercuts active recall on every MCQ.

**EP39 delivers the two must-have mechanisms** — an MCQ **feedback moment** and a **review-anytime
(eager) session** — plus the **review-tab hub** that surfaces them, all **layered on the existing FSRS
engine** (no scheduler replacement). The architectural core is one server rule: **advance the schedule
iff the card is due at answer time** ([ADR §2](../../../product-documentation/architecture/20260709T143643Z-engineering-review-ahead-and-due-gated-advance.md)),
so eager/not-due answers are read-only to the schedule while still being recorded. This meets the
top-priority eager-learner need without a scheduler rewrite and without corrupting real intervals.

---

## Scope

**In scope**:

- **MCQ feedback moment (UI, `QuizCard`)** — after an MCQ answer, hold on a right/wrong state showing
  the chosen answer's correctness and revealing the correct answer on a miss, then advance on an
  explicit learner action ("Next"), mirroring the sentence path's existing two-step reveal. Applies to
  the review MCQ path. (FR-008/009/010, NFR-001.)
- **Due-gated schedule advance (server, `POST /api/reviews/answer`)** — the review answer endpoint
  advances FSRS **iff the card is due at answer time**, derived **server-side** from the persisted `due`
  — never a client flag or session type. Not-due answers skip `FsrsScheduler.schedule` (schedule
  read-only) but are still appended to `review_answer_events`. One endpoint serves both due and eager
  answers. (FR-005/006/007/012, NFR-005, ADR §2/§3.)
- **Anytime (eager) session endpoint (server)** — a read route over **all learned words** via
  `SqliteReviewStore.getAllReviewCards`, returning a **bounded batch of ≤50**, ordered
  **most-overdue-first** with a **least-recently-practised** re-rank on the not-due tail (recency derived
  from `review_answer_events`). Read-only. (FR-001/003/014/016.)
- **Review-tab mode hub (`srs-demo`)** — `navTo('review')` lands on a **mode-selection hub** listing
  **Due Review** and **Practice Anytime**, always reachable regardless of due-count. Replaces the direct
  due-session entry and the caught-up terminus. (FR-002.)
- **Practice Anytime session (`srs-demo`)** — a session that pulls the anytime batch, resolves each
  `wordId` to content + distractors from the preloaded cross-deck `wordPool` (skip orphans), builds
  questions via the existing pipeline, presents them in the same UI as Learning/due-review with the new
  feedback moment, posts each answer to the due-gated endpoint, and shows an end-of-session summary.
  Exitable at any time, non-destructively. (FR-004/011/013/015.)
- **Seeding infrastructure (snapshot builder + `pnpm seed` CLI)** — test/verification infrastructure to
  reach any review state (including multi-day FSRS histories) as a **snapshot**, via a shared scenario
  builder and a zero-config `pnpm seed` CLI, replacing manual `curl`-chain seeding. Additive: no
  production route/scheduler/schema change. Unblocks the review BDD/e2e that EP38 deferred. *(Has its own
  design spec + ADR — FSRS Seeding Snapshot Builder.)*

**Out of scope** — recorded in the [ADR's Deferred Review Modes](../../../product-documentation/architecture/20260709T143643Z-engineering-review-ahead-and-due-gated-advance.md#deferred-review-modes-recorded-not-built):

- **Retry-until-correct-today** with repeat-count affecting rating — a session mechanic with no engine
  cost; strong future candidate. Deferred.
- **Difficult Words** mode (isolate frequently-missed items) — not committed. ADR OQ-D (should a missed
  eager answer feed a future Difficult Words list, given it never advances the schedule?) travels with it.
- **Speed Review** (timed, hearts) and **typing / listening** test types.
- **Retention metric ("% of learned words retained")** — definition + instrumentation deferred and
  **non-blocking** (PO decision, 20260709). §3 keeps `review_answer_events` fed so no data is lost.
  (Gap G-004, ADR OQ-C.)
- **Any FSRS replacement** — no fixed interval ladder / reset-to-4h. Memrise *feel* lives in the
  session/UI layers only.
- **Learning-path MCQ feedback** — `QuizCard` is shared; EP39 targets the review MCQ path. Whether
  Learning adopts the same dwell is a separate UI decision, not committed here.
- **Feedback auto-advance** — EP39 uses explicit "Next" (FR-010); timed auto-advance (OI-004) is not built.

---

## Stories

### Phase 1: Server — review-anytime read + due-gated advance (EP39-PH01)

### EP39-ST01: Anytime-reviews contract DTOs in `@gll/api-contract`

**Scope**: Add the anytime-session response DTO (learned cards as `{ wordId, due }`, server-ordered) and extend `ReviewAnswerResponse` to convey whether the answer advanced the schedule (`advanced: boolean` + the resulting `due`). Wire shapes only — no ordering/rating logic, no thresholds cross the contract.

### EP39-ST02: Due-gate the advance in `POST /api/reviews/answer`

**Scope**: Before scheduling, derive due-ness server-side from the persisted card's `due` at answer time. **Due** → run `FsrsScheduler.schedule` and persist. **Not due** → skip scheduling, leave the card's scheduler state unchanged, and return `advanced:false` with the unchanged `due`. Both branches append to `review_answer_events`. One endpoint, one code path, no client flag. (FR-005/006/007, NFR-005.)

### EP39-ST03: `GET /api/reviews/anytime` — all-learned-words batch

**Scope**: New read route backed by `SqliteReviewStore.getAllReviewCards(userId)`, returning a bounded **≤50** batch ordered **most-overdue-first**, with a **least-recently-practised** re-rank on the not-due tail (practice-recency read from `review_answer_events`). Read-only; orphan tolerance inherited from the store. (FR-001/003/014/016.)

### Phase 2: Client — MCQ feedback moment (EP39-PH02)

### EP39-ST04: MCQ feedback moment in `QuizCard`

**Scope**: On the review MCQ path, after an answer, enter a feedback state showing chosen-answer correctness and revealing the correct answer on a miss; advance on an explicit "Next". Mirror the sentence path's two-step reveal. No self-rating prompt (D5). Independent of Phase 1 — no server change. (FR-008/009/010, NFR-001/004.)

### Phase 3: Client — review-tab hub + Practice Anytime session (EP39-PH03)

### EP39-ST05: Review-tab mode-selection hub

**Scope**: `navTo('review')` lands on a hub listing **Due Review** (EP38 session) and **Practice Anytime**, reachable regardless of due-count (retains the unlock gate + due-count badge for the Due Review entry). Replaces the direct due-session entry and the caught-up terminus. State-`ref` SPA; no `vue-router`. (FR-002.)

### EP39-ST06: Practice Anytime session — presentation, answer, exit

**Scope**: New eager session in `useReviewSession` (or a sibling composable): fetch the anytime batch (ST03), resolve `wordId`→content/distractors from the preloaded `wordPool` (skip orphans), build questions via the existing pipeline, present in the shared `QuizCard` (with ST04 feedback), capture latency, POST each answer to the due-gated endpoint (ST02), and adopt `advanced`/`due` for the summary. Exitable at any time; already-answered words are persisted (write-on-answer), unanswered ones simply not served. Never imports `ts-fsrs`. (FR-004/011/015.)

### EP39-ST07: Anytime session summary

**Scope**: End-of-session summary for the anytime path (count reviewed; how many advanced vs. read-only), parity with the due-review summary, returning to the review hub. (FR-013.)

### Phase 4: Seeding infrastructure — snapshot builder + seed CLI (EP39-PH04)

Test/verification infrastructure to reach any review state (including multi-day FSRS histories) as a
**snapshot**, via a shared scenario builder and a zero-config `pnpm seed` CLI — replacing the manual
`curl`-chain seeding. Additive: no production route/scheduler/schema change; the boundary `new Date()`
sites stay untouched. Governed by its own FSRS Seeding Snapshot Builder design spec + ADR.

### EP39-ST08: Shared scenario builder (extract from route-private `applyFixture`)

**Scope**: Lift scenario construction + fixture application out of the route-private closure into a shared module so HTTP and CLI both import it; existing presets produce byte-identical results. No production time-path change.

### EP39-ST09: Multi-day snapshot presets via backdated FSRS composition

**Scope**: Compose `FsrsScheduler.seed` + N× `schedule` at strictly-increasing backdated offsets to build engine-computed multi-day cards (`relapsed-due`, `mature-interval`); guard against out-of-order (negative-elapsed) steps.

### EP39-ST10: `pnpm seed` CLI over the shared builder

**Scope**: In-process CLI; DB path resolved **identically to the server** (`GLL_DB_PATH` → else `.data/srs-demo.db`); `--list`, `--dry-run`, `--count`, `--deck`. Enables the 2-terminal manual-test loop with no server restart.

### EP39-ST11: Docs — replace curl chains with `pnpm seed`

**Scope**: Update the srs-demo README to lead with `pnpm seed` (incl. span-days + `--dry-run`), keep HTTP for config-override/e2e, document the 2-terminal loop + caveats.

---

## Overall Acceptance Criteria

- [x] The review tab lands on a **mode hub** (Due Review · Practice Anytime), reachable even when nothing
      is due; there is no caught-up terminus.
- [x] A learner can start a **Practice Anytime** session over learned words regardless of due date; the
      batch is **≤50**, most-overdue-first, with the not-due tail re-ranked least-recently-practised.
- [x] Answering a **not-due** word in any path **does not** mutate its FSRS scheduler state
      (`due`/stability/difficulty) — the next scheduled review does not move — yet the answer **is**
      recorded to `review_answer_events`. (NFR-005 / ADR §3.)
- [x] Answering a **due** word advances its schedule, whether reached via the due queue or an anytime
      session; due-ness is derived **server-side**, not from a client flag.
- [x] After an **MCQ** answer the learner sees whether they were correct and, on a miss, the correct
      answer, and advances only on an explicit action. No self-rating prompt appears (D5).
- [x] A learner can **exit** a review session at any time non-destructively; re-entering a Practice
      Anytime session does **not** re-serve the same **not-due** words in the same order (due words
      self-demote via their advanced schedule).
- [x] **Edge/limit**: a learned word that cannot be resolved to content/distractors (orphan) is skipped
      without failing the anytime session (pillar-3 tolerance holds through the UI).
- [x] **Edge/limit**: a failed `review_answer_events` append on the not-due path is fail-open — it must
      not fabricate a schedule advance; a failed *schedule* write on the due path leaves the card
      unchanged and surfaces a typed error (write-on-answer contract, unchanged from EP38).
- [x] Frontend bundle does not import `ts-fsrs` (grep guard passes).

---

## Dependencies

- **EP38** — `GET /api/reviews`, `POST /api/reviews/answer` (extended here with the due-gate),
  `review_answer_events` append-only log, `SqliteReviewStore` (`getDueReviewCards`, **`getAllReviewCards`**),
  `useReviewSession`, `QuizCard`, `ReviewSummary`, top nav.
- **EP36** — `@gll/srs-review` (`FsrsScheduler.schedule`).
- **EP30 / EP34** — `@gll/db` async store + `review_cards` schema.
- **The Review-Ahead ADR** — Accepted 20260710.

## Next Steps

1. ~~Review and approve plan~~ ✅ (20260710)
2. ~~Accept the ADR~~ ✅ (20260710)
3. ~~Create Design Spec (DS)~~ ✅ — [DS01](../../changelogs/EP39--review-mode-redesign/20260710T011037Z-EP39-DS01-server-due-gate-and-anytime.md) (PH01 server: due-gate + anytime endpoint), [DS02](../../changelogs/EP39--review-mode-redesign/20260710T011740Z-EP39-DS02-client-feedback-hub-anytime.md) (PH02/PH03 client: feedback moment + review hub + Practice Anytime session), [DS03](../../changelogs/EP39--review-mode-redesign/20260710T090952Z-EP39-DS03-fsrs-seeding-snapshot-builder.md) (PH04 seeding infra: snapshot builder + `pnpm seed` CLI) — all **Impl-Complete**.
4. Build order: ST02 due-gate → ST03 anytime endpoint → ST04 feedback (parallel, no server dep) →
   ST05/06/07 hub + session. Seeding infra (ST08→ST11) is parallel/independent — no production dep.
5. **Deferred by scope**: retry-until-correct-today, Difficult Words (+ ADR OQ-D), Speed Review,
   typing/listening types, retention metric (ADR OQ-C), feedback auto-advance (OI-004), Learning-path
   MCQ feedback.
