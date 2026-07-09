# EP38 - Review Mode in `srs-demo`

**Created**: 20260709T111254Z
**Status**: Draft

<!-- Status: Draft | Accepted | In Progress | Impl-Complete | BDD Pending | Completed | Shelved | Withdrawn -->

**Type**: Epic Plan
**Depends on**: EP37 (server-side graduation hook seeds `ReviewCard` via `/api/answer`; `@gll/db` `SqliteReviewStore`; `/api/config` single-source), EP36 (`@gll/srs-review`: `FsrsScheduler`, `ReviewScheduler`, review types), EP30/EP34 (`@gll/db` async store), EP20 (`srs-engine-v2` question building / `WordState`)
**Parallel with**: Debug-trace epic (shares the correlation id; not blocking — EP38 emits API-channel breadcrumbs it can consume)
**Predecessor**: N/A — this is the review-mode epic split out of the former "Review in `srs-demo`" branch when that scope was refactored into EP37 (the Learning-authority foundation).

**Architecture**: [`srs-demo` Learning Authority, Review Authority & Debug-Trace Contract](../../../product-documentation/architecture/20260708T125551Z-engineering-srs-demo-learning-authority-and-debug-trace.md) — EP38 realises the **Review-mode epic** in that ADR's *Epic decomposition*: the Review UI/flow in `srs-demo`, resting on **pillar 2** (server-side Review authority) which EP37 delivered. Governed behaviourally by the [SRS Review Phase ADR](../../../product-documentation/architecture/20260321T145300Z-engineering-srs-engine-v2-review-phase.md) (FSRS `enable_short_term:false`, write-on-answer, two review modes) and the [Review Phase Packaging & Rating ADR](../../../product-documentation/architecture/20260708T005635Z-engineering-srs-review-phase-packaging.md) (layer boundaries; **D5** rating never *asked*; frontend never imports `ts-fsrs`). **Deviation from D5**: D5's response-time→rating *inference* is deferred to a future feature — EP38 rates by correctness only (`again`/`good`) and merely *records* latency; the D5 no-self-rating-prompt principle still holds. Config tiering follows the [Config Ownership & Layering ADR](../../../product-documentation/architecture/20260709T091559Z-engineering-config-ownership-and-layering.md) — response-time bands are **T3** (never exposed), which is why they are absent from `/api/config` here.

---

## Problem Statement

EP36 built the Review scheduler (`@gll/srs-review`) and store (`SqliteReviewStore`); EP37 wired
graduation so that `POST /api/answer` seeds exactly one `ReviewCard` per word the first time it
masters. **Those cards now accumulate but are never surfaced or reviewed** — graduated words fall
into a durable, growing pile of due cards with no way for the user to answer them and no path for
FSRS to advance their intervals. The whole point of the Review phase (day-scale retention) is
inert.

**EP38 makes Review a usable mode in `srs-demo`.** A new **landing dashboard** routes the user to
either Learning or Review; Review unlocks once any word is mastered. In Review the user is shown
their due words as ordinary quiz questions (same friction-free UI as Learning — *no self-rating
prompt*), answers them, and each answer advances the card's FSRS schedule. Authority stays
server-side per pillar 2: the client posts `{ wordId, correct, latencyMs, questionType }`, the
**server** maps the answer to an FSRS rating, runs `FsrsScheduler.schedule`, and persists the
advanced card. The frontend never imports `ts-fsrs`.

**Rating is correctness-only for the initial build** (a deliberate scoping decision, see Scope):
wrong → `again`, correct → `good`. Response latency and question type are **recorded** on each
review answer for a future response-time-scoring feature, but they do **not** affect the rating yet —
so a slow answer is never penalised.

This closes the EP36 → EP37 → EP38 arc (built the scheduler → seeded cards on graduation → now
review them) and delivers the first user-facing payoff of the whole Review investment.

---

## Scope

**In scope** (Review-mode epic — pillar 2 UI/flow + its server read/advance endpoints):

- **Review contract DTOs in `@gll/api-contract`** (wire shapes only, no logic): a due-cards list
  response and a review-answer request/response. The request carries `questionType` and `latencyMs`
  as **wire facts** (what was shown, how long it took) — like `correct`; no rating policy or
  thresholds cross the contract (server-owned, EP37's rule).
- **`GET /api/reviews` (read) route**: returns the user's **pool-global** due cards, backed by the
  existing `SqliteReviewStore.getDueReviewCards`. Orphan-tolerant by inheritance (pillar 3, already
  in the store). (Deck-scoped review via `getDueReviewCardsForDeck` is deferred — see Out of scope.)
- **`POST /api/reviews/answer` (advance) route**: receives `{ wordId, correct, latencyMs,
  questionType }`, maps it to an FSRS rating **server-side** — **correctness-only for this build**:
  wrong → `again`, correct → `good` (both question types; response time does **not** affect the
  rating) — runs `FsrsScheduler.schedule`, persists via `SqliteReviewStore.upsertReviewCard`
  (**not** `seedReviewCard`), and returns the new due date. **Write-on-answer**: each review persists
  immediately (partial sessions are always safe).
- **Durable review-answer record**: each `/api/reviews/answer` call records the raw answer facts
  (`wordId`, `correct`, `latencyMs`, `questionType`, inferred rating, timestamp, correlation id) to a
  durable log — the seed data a future response-time-scoring feature will calibrate against. This is
  *recording only*; it does not feed the rating now. (Deliberately lighter than EP37's full
  before/after transition channel + replay tooling, which stays with the debug-trace epic.)
- **Landing dashboard in `srs-demo`**: a new `'home'` screen (the new default landing; today the app
  drops straight into deck selection) with two routes — **Learn** (→ existing deck-select flow) and
  **Review** (→ review session). Review is **locked until any word is mastered** (computed
  client-side from `globalRunState`, which already holds every `WordState`); when unlocked it shows a
  **due-count badge** from `GET /api/reviews` and opens even when nothing is due (a "caught up"
  state).
- **Review mode in `srs-demo`**: a new `'review'` screen/flow — a **pool-global** session that
  fetches due cards, resolves each `wordId` to its content + distractors from the already-preloaded
  `wordPool` (cross-deck, free — the app loads all decks at boot; orphans skipped), builds questions
  via the existing pipeline, presents them in the **same full MC/sentence UI as Learning**, captures
  `shownAt`→answer latency, posts each answer, adopts the returned schedule, and shows an
  end-of-session summary. Client-side orchestration only (ordering most-overdue-first, advancing the
  queue). Never imports `ts-fsrs`.
- **API-channel breadcrumb**: review requests carry the shared `x-correlation-id` so the debug-trace
  epic's API channel can stitch them — reuses EP37's header convention, no new tracing infra here.

**Out of scope**:

- **Review → Learning re-entry on lapse threshold** (20260321 OQ1) — a repeatedly-failed review word
  returning to the Learning loop. Deferred.
- **Explicit "mark as hard" override** (packaging ADR D6) — deferred; purely additive when it lands.
- **Orphaned-card cleanup** — cards for deleted words stay due forever; readers tolerate them
  (pillar 3). A cleanup story remains deferred (ADR pillar 3 / Consequences).
- **Response-time-based rating (`easy`/`hard` bands)** — the ADR D5 mechanism that maps answer
  latency to a finer FSRS rating. **Deferred as a distinct future feature.** EP38 rates by
  correctness only (`again`/`good`) and *records* latency + `questionType` now so that feature has
  historical, per-type data to calibrate against when it lands. Because the bands are engine
  calibration, they are **T3** (system/algorithm-internal) per the Config Ownership ADR — server
  constants, **never** exposed via `/api/config` and never user-tunable. When the feature ships it is
  a server-side change (add the band table + swap the rating rule); the contract already carries the
  facts it needs.
- **Deck-scoped review** — EP38's landing Review is pool-global (all due across decks). A per-deck
  review entry (via `getDueReviewCardsForDeck`, already in the store) is a follow-up; the ADR's
  two-mode design is honoured structurally but only pool-global is surfaced now.
- **Practice mode / due-date bypass** (20260321 OQ8) — Review honours due dates only; no "review
  ahead" surface.
- **Full EP15 answer verification** — the client still generates and grades questions (holds the
  answer key) and self-reports `correct`; the same accepted risk EP37 recorded. The server owns
  *rating inference and scheduling*, not answer verification.
- **Debug-trace pillar 4** (appearance/transition channels, replay tooling, start/stop UI) — separate
  epic. EP38 only emits the correlation id it will consume.
- **`cli-demo-db`** — already has its own local review runner (`main-review.ts`); not retargeted. It
  inherits pillar-3 integrity via `@gll/db`.

---

## Stories

### Phase 1: Server review endpoints (EP38-PH01) — pillar 2 read/advance

### EP38-ST01: Review contract DTOs in `@gll/api-contract`

**Scope**: `DueReviewsResponse` (list of `{ wordId, due }`), `ReviewAnswerRequest { wordId, correct, latencyMs, questionType }`, `ReviewAnswerResponse { wordId, due }`, and error codes. Wire DTOs only — no server/client logic, no thresholds; `latencyMs`/`questionType` are wire facts, not policy.

### EP38-ST02: `GET /api/reviews` due-cards route (pool-global)

**Scope**: Hono route returning the user's due cards via `SqliteReviewStore.getDueReviewCards`, most-overdue-first. Read-only; orphan tolerance inherited from the store. (Deck-scoped variant deferred.)

### EP38-ST03: `POST /api/reviews/answer` server-authoritative advance

**Scope**: Route maps the answer to an FSRS rating server-side — **correctness-only**: wrong→`again`, correct→`good` (response time ignored) — runs `FsrsScheduler.schedule`, persists via `SqliteReviewStore.upsertReviewCard` (write-on-answer, immediate), returns the new `due`. Malformed/failed request leaves the card unchanged and returns a typed error.

### EP38-ST04: Durable review-answer record

**Scope**: On the `/api/reviews/answer` path, record `{ correlationId, wordId, correct, latencyMs, questionType, rating, at }` to a durable log — seed data for the future response-time-scoring feature. Append-only; recording only, never feeds the rating. Fail-open (a record-write failure must not lose the FSRS advance).

### Phase 2: Landing + Review mode in `srs-demo` (EP38-PH02) — pillar 2 UI/flow

### EP38-ST05: `'home'` landing dashboard + Review unlock gating

**Scope**: New default `'home'` screen routing to Learn (existing deck-select) or Review. Review entry is locked until any word is mastered (computed from `globalRunState`); when unlocked, shows a due-count badge from `GET /api/reviews`. No `ts-fsrs` import.

### EP38-ST06: Review session — question presentation & write-on-answer

**Scope**: Pool-global session: fetch due cards, resolve each `wordId` to content + distractors from the preloaded `wordPool` (skip orphans), build questions via the existing pipeline, present in the same MC/sentence UI as Learning, capture `shownAt`→answer latency, POST each answer to `/api/reviews/answer` (with `questionType`), adopt the returned schedule, advance the queue. Client-side orchestration only; each answer persists server-side immediately (safe on early exit).

### EP38-ST07: Review session summary, caught-up state & exit

**Scope**: End-of-session summary (reviewed count / next-due horizon), a "caught up — nothing due" state when the due list is empty, and return to `'home'`; re-entry naturally reloads remaining due cards (partial-session resume, 20260321 §10).

---

## Overall Acceptance Criteria

- [ ] The `'home'` landing routes to Learn or Review; the Review entry is locked until at least one
      word is mastered, then shows a due-count badge and opens even when nothing is due.
- [ ] A word seeded at graduation (EP37) appears as a pool-global due card via `GET /api/reviews`
      once its due date passes.
- [ ] Answering a due review posts `{ wordId, correct, latencyMs, questionType }`; the **server** maps
      it to a rating (wrong→`again`; correct→`good`, response time **not** used) and the card's `due`
      advances via `FsrsScheduler.schedule`. A slow-but-correct answer is not penalised. The client
      never imports `ts-fsrs`.
- [ ] Each review answer's `latencyMs` + `questionType` are recorded durably (for the future
      response-time feature) without affecting the rating.
- [ ] The user is **never** shown a self-rating prompt (D5) — review questions look like Learning
      questions.
- [ ] Write-on-answer: exiting mid-session preserves every already-answered card's advanced schedule;
      re-entering reloads only the remaining due cards.
- [ ] No review threshold/band is exposed via `GET /api/config` (correctness-only rating needs none;
      future bands are T3, never exposed).
- [ ] **Edge/limit**: a malformed/failed `/api/reviews/answer` leaves the persisted `ReviewCard`
      unchanged and surfaces a typed error; the client does not silently drop the answer or advance
      the queue past it.
- [ ] **Edge/limit**: a due card whose word was deleted (orphan) does not crash the read route
      (pillar 3 tolerance holds through the UI).
- [ ] Frontend bundle does not import `ts-fsrs`.

---

## Dependencies

- **EP37** — server-side graduation seeding (`/api/answer`), `SqliteReviewStore` (`getDueReviewCards`,
  `getDueReviewCardsForDeck`, `upsertReviewCard`), and the `/api/config` single-source pattern.
- **EP36** — `@gll/srs-review` (`FsrsScheduler.schedule`, `ReviewScheduler`, review types).
- **EP30 / EP34** — `@gll/db` async store + `review_cards` schema.
- **The three governing ADRs** (authority/decomposition; behavioural review phase; packaging & rating)
  — must remain Accepted; EP38 realises the review-mode epic + pillar 2 UI.

## Next Steps

1. Review and approve plan
2. Create Design Spec (DS) — likely DS01 (PH01 server: read/advance routes + review-answer record) then DS02 (PH02 client: `'home'` landing + Review session)
3. Begin implementation
