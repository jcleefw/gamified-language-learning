# EP38 - Review Mode in `srs-demo`

**Created**: 20260709T111254Z
**Status**: Impl-Complete (BDD/e2e deferred)

<!-- Status: Draft | Accepted | In Progress | Impl-Complete | BDD Pending | Completed | Shelved | Withdrawn -->

**Type**: Epic Plan
**Depends on**: EP37 (server-side graduation hook seeds `ReviewCard` via `/api/answer`; `@gll/db` `SqliteReviewStore`; `/api/config` single-source), EP36 (`@gll/srs-review`: `FsrsScheduler`, `ReviewScheduler`, review types), EP30/EP34 (`@gll/db` async store), EP20 (`srs-engine-v2` question building / `WordState`)
**Extended by**: [EP39 – Review Mode: Eager Practice & Feedback](EP39-review-mode-redesign.md) — the review-anytime path, the due-gated advance, the mode hub, and the MCQ feedback moment build on this foundation.
**Parallel with**: Debug-trace epic (shares the correlation id; not blocking — EP38 emits API-channel breadcrumbs it can consume)

**Architecture**: [`srs-demo` Learning Authority, Review Authority & Debug-Trace Contract](../../../product-documentation/architecture/20260708T125551Z-engineering-srs-demo-learning-authority-and-debug-trace.md) — EP38 realises the **Review-mode epic** in that ADR's *Epic decomposition*: the Review UI/flow in `srs-demo`, resting on **pillar 2** (server-side Review authority) which EP37 delivered. Governed behaviourally by the [SRS Review Phase ADR](../../../product-documentation/architecture/20260321T145300Z-engineering-srs-engine-v2-review-phase.md) (FSRS `enable_short_term:false`, write-on-answer) and the [Review Phase Packaging & Rating ADR](../../../product-documentation/architecture/20260708T005635Z-engineering-srs-review-phase-packaging.md) (layer boundaries; **D5** rating never *asked*; frontend never imports `ts-fsrs`). **Deviation from D5**: D5's response-time→rating *inference* is a deferred future feature — EP38 rates by correctness only (`again`/`good`) and merely *records* latency; the D5 no-self-rating-prompt principle holds. Config tiering follows the [Config Ownership & Layering ADR](../../../product-documentation/architecture/20260709T091559Z-engineering-config-ownership-and-layering.md) — response-time bands are **T3** (never exposed), which is why they are absent from `/api/config` here.

---

## Problem Statement

EP36 built the Review scheduler (`@gll/srs-review`) and store (`SqliteReviewStore`); EP37 wired
graduation so that `POST /api/answer` seeds exactly one `ReviewCard` per word the first time it
masters. **Those cards accumulate but are never surfaced or reviewed** — graduated words fall into a
durable, growing pile of due cards with no way for the user to answer them and no path for FSRS to
advance their intervals. The whole point of the Review phase (day-scale retention) is inert.

**EP38 makes Review a usable mode in `srs-demo`.** A new **landing dashboard** routes the user to
either Learning or Review; Review unlocks once any word is mastered. In Review the user is shown their
**due** words as ordinary quiz questions (same friction-free UI as Learning — *no self-rating
prompt*), answers them, and each answer advances the card's FSRS schedule. Authority stays server-side
per pillar 2: the client posts `{ wordId, correct, latencyMs, questionType }`, the **server** maps the
answer to an FSRS rating, runs `FsrsScheduler.schedule`, and persists the advanced card. The frontend
never imports `ts-fsrs`.

**Rating is correctness-only for the initial build** (a deliberate scoping decision, see Scope): wrong
→ `again`, correct → `good`. Response latency and question type are **recorded** on each review answer
for a future response-time-scoring feature, but they do **not** affect the rating yet — so a slow
answer is never penalised.

This closes the EP36 → EP37 → EP38 arc (built the scheduler → seeded cards on graduation → now review
them) and delivers the first user-facing payoff of the Review investment. EP38's scope is the
**scheduled due-review loop**; the eager-learner practice path, the mode hub, and the MCQ feedback
moment follow in [EP39](EP39-review-mode-redesign.md).

---

## Scope

**In scope** (Review-mode epic — pillar 2 UI/flow + its server read/advance endpoints):

- **Review contract DTOs in `@gll/api-contract`** (wire shapes only, no logic): a due-cards list
  response and a review-answer request/response. The request carries `questionType` and `latencyMs` as
  **wire facts** (what was shown, how long it took) — like `correct`; no rating policy or thresholds
  cross the contract (server-owned, EP37's rule).
- **`GET /api/reviews` (read) route**: returns the user's **pool-global** due cards, backed by the
  existing `SqliteReviewStore.getDueReviewCards`. Orphan-tolerant by inheritance (pillar 3, already in
  the store). (Deck-scoped review via `getDueReviewCardsForDeck` is deferred — see Out of scope.)
- **`POST /api/reviews/answer` (advance) route**: receives `{ wordId, correct, latencyMs, questionType }`,
  maps it to an FSRS rating **server-side** — **correctness-only for this build**: wrong → `again`,
  correct → `good` (both question types; response time does **not** affect the rating) — runs
  `FsrsScheduler.schedule`, persists via `SqliteReviewStore.upsertReviewCard` (**not** `seedReviewCard`),
  and returns the new due date. **Write-on-answer**: each review persists immediately (partial sessions
  are always safe). Every card this endpoint sees is **due** (the due-review session only fetches due
  cards), so each answer advances the schedule.
- **Durable review-answer record**: each `/api/reviews/answer` call records the raw answer facts
  (`wordId`, `correct`, `latencyMs`, `questionType`, inferred rating, timestamp, correlation id) to a
  durable append-only `review_answer_events` log — seed data a future response-time-scoring feature (and
  a future retention metric) will calibrate against. Recording only; it does not feed the rating.
- **Landing dashboard in `srs-demo`**: a new `'home'` screen (the new default landing; today the app
  drops straight into deck selection) with two routes — **Learn** (→ existing deck-select flow) and
  **Review**. Review is **locked until any word is mastered** (computed client-side from
  `globalRunState`, which already holds every `WordState`); when unlocked it shows a **due-count badge**
  from `GET /api/reviews`.
- **Review session in `srs-demo`**: a new `'review'` screen/flow — a **pool-global** due session that
  fetches due cards, resolves each `wordId` to content + distractors from the already-preloaded
  `wordPool` (cross-deck, free — the app loads all decks at boot; orphans skipped), builds questions via
  the existing pipeline, presents them in the **same full MC/sentence UI as Learning**, captures
  `shownAt`→answer latency, posts each answer, adopts the returned schedule, and shows an end-of-session
  summary. Client-side orchestration only (ordering most-overdue-first, advancing the queue). Never
  imports `ts-fsrs`.
- **API-channel breadcrumb**: review requests carry the shared `x-correlation-id` so the debug-trace
  epic's API channel can stitch them — reuses EP37's header convention, no new tracing infra here.

**Out of scope** (delivered in [EP39](EP39-review-mode-redesign.md)):

- **Review-anytime (eager) practice** over learned-but-not-due words, and the **due-gated advance** that
  keeps eager practice read-only to the schedule (see the
  [Review-Ahead & Due-Gated Advance ADR](../../../product-documentation/architecture/20260709T143643Z-engineering-review-ahead-and-due-gated-advance.md)).
- **Review-tab mode hub** (Due Review · Practice Anytime) and the always-reachable anytime entry.
- **MCQ feedback moment** (dwell + correct-answer reveal on the MCQ path).

**Out of scope** (deferred beyond EP38+EP39):

- **Review → Learning re-entry on lapse threshold** (20260321 OQ1) — a repeatedly-failed review word
  returning to the Learning loop. Deferred.
- **Explicit "mark as hard" override** (packaging ADR D6) — deferred; purely additive when it lands.
- **Orphaned-card cleanup** — cards for deleted words stay due forever; readers tolerate them (pillar 3).
- **Response-time-based rating (`easy`/`hard` bands)** — the ADR D5 mechanism that maps answer latency
  to a finer FSRS rating. Deferred as a distinct future feature. EP38 rates by correctness only and
  *records* latency + `questionType` now so that feature has per-type history to calibrate against. The
  bands are engine calibration — **T3** (system-internal) per the Config Ownership ADR — server
  constants, never exposed via `/api/config`. When the feature ships it is a server-side change; the
  contract already carries the facts.
- **Deck-scoped review** — EP38's Review is pool-global (all due across decks). A per-deck entry (via
  `getDueReviewCardsForDeck`, already in the store) is a follow-up.
- **Full EP15 answer verification** — the client still generates and grades questions and self-reports
  `correct`; the accepted risk EP37 recorded. The server owns *rating inference and scheduling*.
- **Debug-trace pillar 4** (appearance/transition channels, replay tooling, start/stop UI) — separate
  epic. EP38 only emits the correlation id it will consume.
- **`cli-demo-db`** — has its own local review runner (`main-review.ts`); not retargeted.

---

## Stories

### Phase 1: Server review endpoints (EP38-PH01) — pillar 2 read/advance

### EP38-ST01: Review contract DTOs in `@gll/api-contract`

**Scope**: `DueReviewsResponse` (list of `{ wordId, due }`), `ReviewAnswerRequest { wordId, correct, latencyMs, questionType }`, `ReviewAnswerResponse { wordId, due }`, and error codes. Wire DTOs only — no server/client logic, no thresholds; `latencyMs`/`questionType` are wire facts, not policy.

### EP38-ST02: `GET /api/reviews` due-cards route (pool-global)

**Scope**: Hono route returning the user's due cards via `SqliteReviewStore.getDueReviewCards`, most-overdue-first. Read-only; orphan tolerance inherited from the store. (Deck-scoped variant deferred.)

### EP38-ST03: `POST /api/reviews/answer` server-authoritative advance

**Scope**: Route maps the answer to an FSRS rating server-side — **correctness-only**: wrong→`again`, correct→`good` (response time ignored) — runs `FsrsScheduler.schedule`, persists via `SqliteReviewStore.upsertReviewCard` (write-on-answer, immediate), returns the new `due`. Every card reached here is due (the due session only serves due cards). Malformed/failed request leaves the card unchanged and returns a typed error.

### EP38-ST04: Durable review-answer record

**Scope**: On the `/api/reviews/answer` path, record `{ correlationId, wordId, correct, latencyMs, questionType, rating, at }` to a durable append-only `review_answer_events` log. Recording only, never feeds the rating. Fail-open (a record-write failure must not lose the FSRS advance).

### Phase 2: Landing + Review session in `srs-demo` (EP38-PH02) — pillar 2 UI/flow

### EP38-ST05: `'home'` landing dashboard + Review unlock gating

**Scope**: New default `'home'` screen routing to Learn (existing deck-select) or Review. Review entry is locked until any word is mastered (computed from `globalRunState`); when unlocked, shows a due-count badge from `GET /api/reviews`. No `ts-fsrs` import.

### EP38-ST06: Review session — question presentation & write-on-answer

**Scope**: Pool-global due session: fetch due cards, resolve each `wordId` to content + distractors from the preloaded `wordPool` (skip orphans), build questions via the existing pipeline, present in the same MC/sentence UI as Learning, capture `shownAt`→answer latency, POST each answer to `/api/reviews/answer` (with `questionType`), adopt the returned schedule, advance the queue. Client-side orchestration only; each answer persists server-side immediately (safe on early exit).

### EP38-ST07: Review session summary & exit

**Scope**: End-of-session summary (reviewed count / next-due horizon) and return to the landing screen; re-entry naturally reloads remaining due cards (partial-session resume, 20260321 §10). When the due list is empty, a "caught up" state. *(EP39 replaces the caught-up terminus with the review-mode hub + Practice Anytime; the summary carries forward.)*

### EP38-ST08: Persistent top nav menu (Home / Learn / Review)

**Scope**: An always-visible top nav making Home / Learn / Review reachable from every screen (the app is a state-`ref` SPA, no `vue-router`), reusing the Review unlock gate + due badge. Navigating away from an active Learning quiz flushes the partial batch so no answer is lost. Added after verification surfaced a navigation dead-end once the user entered the deck-select flow. Detailed in [DS02 §5](../../changelogs/EP38--review-mode-srs-demo/20260709T120212Z-EP38-DS02-landing-and-review-session.md).

---

## Overall Acceptance Criteria

- [x] The `'home'` landing routes to Learn or Review; the Review entry is locked until at least one word
      is mastered, then shows a due-count badge and opens even when nothing is due.
- [x] A word seeded at graduation (EP37) appears as a pool-global due card via `GET /api/reviews` once
      its due date passes.
- [x] Answering a due review posts `{ wordId, correct, latencyMs, questionType }`; the **server** maps
      it to a rating (wrong→`again`; correct→`good`, response time **not** used) and the card's `due`
      advances via `FsrsScheduler.schedule`. A slow-but-correct answer is not penalised. The client
      never imports `ts-fsrs`.
- [x] Each review answer's `latencyMs` + `questionType` are recorded durably without affecting the rating.
- [x] The user is **never** shown a self-rating prompt (D5) — review questions look like Learning questions.
- [x] Write-on-answer: exiting mid-session preserves every already-answered card's advanced schedule;
      re-entering reloads only the remaining due cards.
- [x] No review threshold/band is exposed via `GET /api/config` (correctness-only rating needs none;
      future bands are T3, never exposed).
- [x] **Edge/limit**: a malformed/failed `/api/reviews/answer` leaves the persisted `ReviewCard`
      unchanged and surfaces a typed error; the client does not silently drop the answer or advance the
      queue past it.
- [x] **Edge/limit**: a due card whose word was deleted (orphan) does not crash the read route (pillar 3
      tolerance holds through the UI — client `resolveDueItems` skips orphans).
- [x] Frontend bundle does not import `ts-fsrs`.

> **Verification** (20260709): AC confirmed via a Playwright drive against a real server (home
> gate/badge, review session + `POST /api/reviews/answer` advance, caught-up, answer-failure halt, nav)
> plus `vue-tsc` + a `ts-fsrs` grep guard. DS01 route/store behaviour verified live and by its unit
> tests. **BDD/e2e is deferred** — the blocker is the lack of a due-review-card seed (a graduated card's
> first `due` is in the future and `/api/test/seed` doesn't cover review cards, so a UI-only test can't
> reach a due state without backdating the DB). *(EP39's seeding infrastructure resolves this blocker.)*

---

## Dependencies

- **EP37** — server-side graduation seeding (`/api/answer`), `SqliteReviewStore` (`getDueReviewCards`,
  `getDueReviewCardsForDeck`, `upsertReviewCard`), and the `/api/config` single-source pattern.
- **EP36** — `@gll/srs-review` (`FsrsScheduler.schedule`, `ReviewScheduler`, review types).
- **EP30 / EP34** — `@gll/db` async store + `review_cards` schema.
- **The three governing ADRs** (authority/decomposition; behavioural review phase; packaging & rating).

## Next Steps

1. ~~Review and approve plan~~ ✅
2. ~~Create Design Spec (DS) — DS01 (PH01 server: read/advance routes + review-answer record), DS02 (PH02 client: `'home'` landing + Review session)~~ ✅ — both **Impl-Complete**
3. ~~Begin implementation~~ ✅ — ST01–ST08 built and verified (see DS01 §7, DS02 §7 Implementation Notes)
4. **Continues in [EP39](EP39-review-mode-redesign.md)** — review-anytime + due-gated advance, mode hub, MCQ feedback moment, and the seeding infrastructure that unblocks review BDD/e2e.
5. **Deferred by scope**: response-time rating bands, deck-scoped review, lapse→Learning re-entry, orphan cleanup, "mark as hard".
