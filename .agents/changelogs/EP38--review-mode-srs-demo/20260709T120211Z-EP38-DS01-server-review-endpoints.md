# EP38-DS01: Server Review Endpoints (read / advance / record) Specification

**Date**: 20260709T120211Z
**Status**: Impl-Complete
**Epic**: [EP38 - Review Mode in `srs-demo`](../../plans/epics/EP38-review-mode-srs-demo.md)

**Architecture**:
[`srs-demo` Learning Authority, Review Authority & Debug-Trace Contract](../../../product-documentation/architecture/20260708T125551Z-engineering-srs-demo-learning-authority-and-debug-trace.md) — **Pillar 2 (Review authority is server-side)**. EP37 seeded the cards on graduation; this DS delivers the two routes that **surface** and **advance** them, plus a durable record channel. Governed behaviourally by the [SRS Review Phase ADR](../../../product-documentation/architecture/20260321T145300Z-engineering-srs-engine-v2-review-phase.md) (FSRS `enable_short_term:false`, write-on-answer) and the [Review Phase Packaging & Rating ADR](../../../product-documentation/architecture/20260708T005635Z-engineering-srs-review-phase-packaging.md) (**D5**: rating is inferred, never *asked*; the frontend never imports `ts-fsrs`). Response-time bands stay **T3** per the [Config Ownership & Layering ADR](../../../product-documentation/architecture/20260709T091559Z-engineering-config-ownership-and-layering.md) — this DS neither serves nor consumes them.

---

## 1. Feature Overview

This DS covers **Phase 1 (EP38-PH01)** only — the server half of Review mode. After EP37, `review_cards`
rows accumulate on graduation but nothing reads or advances them. PH01 adds:

- **`GET /api/reviews`** — returns the user's **pool-global** due cards (`{ wordId, due }[]`,
  most-overdue-first) straight from the existing [`SqliteReviewStore.getDueReviewCards`](../../../packages/db/src/sqlite-review-store.ts#L74). Read-only; orphan tolerance is inherited from the store (pillar 3).
- **`POST /api/reviews/answer`** — receives `{ wordId, correct, latencyMs, questionType }`, maps it to
  an FSRS rating **server-side**, advances the card via [`FsrsScheduler.schedule`](../../../packages/srs-review/src/FsrsScheduler.ts#L50), persists with `upsertReviewCard` (write-on-answer), and returns the new `due`.
- **A durable review-answer record** — every advance appends the raw answer facts (+ inferred rating +
  correlation id) to a new append-only `review_answer_events` table: seed data for the future
  response-time-scoring feature. Recording only; it never feeds the rating.

**The one rating decision this DS locks (correctness-only, deliberately).** The server maps
`correct === false → 'again'` and `correct === true → 'good'` — **both question types, response time
ignored**. `FsrsScheduler` supports `hard`/`easy` too, but the latency→band mechanism (ADR D5) is a
**deferred future feature** (Epic §Out of scope). We therefore *record* `latencyMs` + `questionType`
now (so that feature has per-type history to calibrate against) but never read them for scheduling.
When the feature ships it is a **server-only** change — swap the rating rule, add the T3 band table —
with **no contract change**, because the contract already carries the facts.

**What is reused, not built** (keeps this DS small):

- **Scheduling logic**: `FsrsScheduler.schedule` already advances a rehydrated card; the server passes
  a domain `ReviewRating` and stores the returned card opaquely. No FSRS logic is written here.
- **Persistence**: `getDueReviewCards`, `getReviewCard`, `upsertReviewCard` already exist on
  `SqliteReviewStore` (EP36/EP37). This DS uses `upsertReviewCard` — **not** `seedReviewCard`
  (advancing an existing card, not creating one).
- **Route/envelope conventions**: Hono router + `ApiResponse<T>` envelope + `x-correlation-id`
  header + per-request store construction, all copied from [`answer.ts`](../../../apps/server/src/routes/answer.ts).
- **The durable-record precedent**: the new store mirrors [`SqliteAnswerEventStore`](../../../packages/db/src/sqlite-answer-event-store.ts) (append-only, fail-open at the call site).

**Not in this DS**: any `srs-demo` UI (DS02 — landing + session); deck-scoped review
(`getDueReviewCardsForDeck` stays unused); orphaned-card cleanup; the response-time band table;
debug-trace pillar 4. `POST /api/answer` (EP37 seeding) is untouched.

---

## 2. Core Requirements

| Requirement | Decision | Rationale |
| --- | --- | --- |
| Contract additions | Add `DueReviewsResponse`, `ReviewAnswerRequest`, `ReviewAnswerResponse`, `ReviewQuestionType` to `@gll/api-contract` (`srs.ts`) — **wire DTOs only** | These are the client↔server wire shapes (like `AnswerRequest`); they carry facts, not policy. Contrast with learning *config*, which the epic bans from the contract — DTOs are allowed and expected |
| `due` on the wire | ISO-8601 **string** in both responses (not `Date`) | JSON has no Date; matches how `review_cards.due` is already stored and how the client will parse it. `ReviewCard.due` is a `Date` in-process; the route serialises at the boundary |
| Read route | `GET /api/reviews` → `getDueReviewCards(USER_ID, now)`, mapped to `{ wordId, due: due.toISOString() }[]`, order preserved (store already sorts `asc(due)` = most-overdue-first) | Pool-global read; the store owns ordering and orphan tolerance. Route stays a thin projection |
| Rating inference | **Correctness-only, server-side**: `correct ? 'good' : 'again'` — response time and `questionType` **do not** affect it | Epic scope decision; D5 no-self-rating-prompt upheld (client never sends a rating). Slow-but-correct is never penalised |
| Advance persistence | `upsertReviewCard(USER_ID, scheduler.schedule(card, rating, now))` — **not** `seedReviewCard` | Advancing an existing card must overwrite `due`/`schedulerData`; `seedReviewCard` is ignore-if-exists and would silently no-op the advance |
| Missing card | If `getReviewCard` returns null (no card for `wordId`), return typed `NOT_FOUND`; **do not** seed one | Review advances an existing graduated card; seeding is graduation's job (EP37). A due-but-absent card is a client/data error, surfaced not masked |
| Malformed body | Validate `wordId:string(non-empty)`, `correct:boolean`, `latencyMs:finite ≥0`, `questionType ∈ {'mcq','word-block'}`; on failure return `BAD_REQUEST` and **leave the card unchanged** | Mirrors `answer.ts` validation; the AC "malformed leaves the card unchanged" — no store write happens before validation passes |
| Write-on-answer | Each valid advance persists immediately, before responding | ADR: partial sessions always safe; the client can exit after any answer with the schedule already durable |
| Durable record | New append-only `review_answer_events` table + `SqliteReviewAnswerEventStore.appendReviewAnswerEvent({ correlationId, wordId, correct, latencyMs, questionType, rating, at })` | Seed data for the deferred response-time feature; append-only, **reuses the `SqliteAnswerEventStore` pattern** (insert-and-run, log-and-rethrow) but a **separate table** |
| Separate table (not reuse `answer_events`) | `review_answer_events` is its own table, not extra columns on `answer_events` | The two share a 6-column spine (`correlation_id`,`user_id`,`word_id`,`correct`,`latency_ms`,`created_at`) but diverge in payload and **owner**: `answer_events` is the debug-trace epic's *Learning transition* channel (`after_state`/`graduated` are `NOT NULL`), review rows have neither and add `question_type`/`rating`. Reuse would mean sparse nullable columns, a `NOT NULL`-drop rebuild, a discriminator every consumer must filter on, and coupling two parallel epics through one table. Separate keeps every column meaningful and each epic's schema independently evolvable; merging two clean tables later is a trivial `UNION` if ever wanted |
| Record is fail-open | Wrap the record write in try/catch **after** the FSRS advance is persisted; a record failure logs and still returns `200` with the new `due` | Epic: "a record-write failure must not lose the FSRS advance." The authoritative schedule write is the contract; the record is diagnostics |
| Rating **not** in record-then-schedule order | Compute `rating` once, use it for both the advance and the record | One inference per request; the recorded `rating` is exactly what scheduled the card |
| Correlation id | Read `x-correlation-id`, thread it into `logger.child` and the record row | Reuses EP37's breadcrumb convention so the debug-trace epic's API channel can stitch review calls; no new tracing infra |
| Scheduler construction | Reuse a single module-level `new FsrsScheduler()` (stateless, default params) | Exactly the `answer.ts` pattern (`answer.ts:20`); no per-request allocation, no injection framework |
| `ts-fsrs` boundary | Server imports `@gll/srs-review` (which owns `ts-fsrs`); the frontend bundle imports neither | ADR: frontend never imports `ts-fsrs`. This DS adds no frontend code, so the guard is trivially held |
| Router mounting | New `apps/server/src/routes/reviews.ts`, mounted under `/api` alongside `answer`/`decks`/`config` | Same registration convention; keeps the review routes in one module |

## 3. Data Structures

### `@gll/api-contract` — new wire DTOs (in `packages/api-contract/src/srs.ts`)

```typescript
/** What was shown for a review answer — a wire fact, not policy.
 *  Mirrors the engine's QuizQuestion.kind so the client reports it as-is. */
export type ReviewQuestionType = 'mcq' | 'word-block';

/** Response data for GET /api/reviews — pool-global due cards, most-overdue-first.
 *  `due` is ISO-8601 (JSON has no Date). */
export interface DueReviewItem {
  wordId: string;
  due: string; // ISO-8601
}
export interface DueReviewsResponse {
  reviews: DueReviewItem[];
}

/** Request body for POST /api/reviews/answer — raw answer facts; the server infers the rating.
 *  `latencyMs`/`questionType` are RECORDED, not used for rating in this build. */
export interface ReviewAnswerRequest {
  wordId: string;
  correct: boolean;
  latencyMs: number;
  questionType: ReviewQuestionType;
}

/** Response data for POST /api/reviews/answer — the advanced schedule. */
export interface ReviewAnswerResponse {
  wordId: string;
  due: string; // ISO-8601, post-advance
}
```

> No rating, no threshold, no band crosses the contract — `ReviewRating` stays in `@gll/srs-review`
> and is derived server-side. `ErrorCode` (BAD_REQUEST, NOT_FOUND) is reused from `errors.ts` as-is.

### Durable record — new append-only table + store

```typescript
// packages/db/src/schema.ts — append-only, mirrors answer_events (different columns)
export const review_answer_events = sqliteTable('review_answer_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  correlation_id: text('correlation_id'),
  user_id: text('user_id').notNull(),
  word_id: text('word_id').notNull(),
  correct: integer('correct', { mode: 'boolean' }).notNull(),
  latency_ms: integer('latency_ms').notNull(),
  question_type: text('question_type').notNull(), // 'mcq' | 'word-block'
  rating: text('rating').notNull(),               // inferred ReviewRating ('again'|'good' this build)
  created_at: text('created_at').notNull(),
});

// packages/db/src/types/review-answer-event-store.ts
export interface ReviewAnswerEventRecord {
  correlationId: string | null;
  userId: string;
  wordId: string;
  correct: boolean;
  latencyMs: number;
  questionType: string;
  rating: string;
  createdAt: string; // ISO-8601
}
export interface IReviewAnswerEventStore {
  appendReviewAnswerEvent(record: ReviewAnswerEventRecord): Promise<void>;
}
```

`SqliteReviewAnswerEventStore` mirrors `SqliteAnswerEventStore` (insert-and-run; log-and-rethrow on
failure so the *call site* decides fail-open).

### Route sketch (`apps/server/src/routes/reviews.ts`)

```typescript
const scheduler = new FsrsScheduler();      // stateless, module-level (answer.ts pattern)
const USER_ID = 'demo-user';                // TODO: real auth id later

router.get('/reviews', async (c) => {
  const now = new Date();
  const cards = await new SqliteReviewStore(getDb()).getDueReviewCards(USER_ID, now);
  const data: DueReviewsResponse = {
    reviews: cards.map((cd) => ({ wordId: cd.wordId, due: cd.due.toISOString() })),
  };
  return c.json({ success: true, data } satisfies ApiResponse<DueReviewsResponse>);
});

router.post('/reviews/answer', async (c) => {
  const correlationId = c.req.header('x-correlation-id') ?? null;
  const log = logger.child({ correlationId: correlationId ?? undefined });

  // 1. parse + validate → BAD_REQUEST leaves the card untouched
  const req = /* validated ReviewAnswerRequest */;

  const now = new Date();
  const store = new SqliteReviewStore(getDb());
  const card = await store.getReviewCard(USER_ID, req.wordId);
  if (!card) return c.json(notFound('no review card for wordId'), 404); // no seeding here

  // 2. correctness-only rating — latency/questionType NOT used
  const rating: ReviewRating = req.correct ? 'good' : 'again';

  // 3. advance + persist (write-on-answer)
  const advanced = scheduler.schedule(card, rating, now);
  await store.upsertReviewCard(USER_ID, advanced);

  // 4. durable record — fail-open (must not lose the advance above)
  try {
    await new SqliteReviewAnswerEventStore(getDb(), log).appendReviewAnswerEvent({
      correlationId, userId: USER_ID, wordId: req.wordId, correct: req.correct,
      latencyMs: req.latencyMs, questionType: req.questionType, rating, createdAt: now.toISOString(),
    });
  } catch { /* logged by the store; advance stands */ }

  const data: ReviewAnswerResponse = { wordId: advanced.wordId, due: advanced.due.toISOString() };
  return c.json({ success: true, data } satisfies ApiResponse<ReviewAnswerResponse>);
});
```

## 4. User Workflows

```
GET /api/reviews
  → now = new Date()
  → getDueReviewCards(demo-user, now)          // store: due ≤ now, ORDER BY due ASC
  → 200 { reviews: [{ wordId, due(ISO) }, ...] }   // most-overdue-first; orphans tolerated by store

POST /api/reviews/answer   { wordId, correct, latencyMs, questionType }
  → correlationId = header('x-correlation-id')
  → validate body ─ invalid? → 400 BAD_REQUEST (NO store write; card unchanged)
  → now = new Date()
  → card = getReviewCard(demo-user, wordId)
       └─ null? → 404 NOT_FOUND (no seeding; card unchanged)
  → rating = correct ? 'good' : 'again'         // correctness-only; latency/type ignored
  → advanced = FsrsScheduler.schedule(card, rating, now)
  → upsertReviewCard(demo-user, advanced)       // write-on-answer, immediate
  → appendReviewAnswerEvent({...raw facts, rating, correlationId})   // fail-open
       └─ throws? log.error, continue (advance already persisted)
  → 200 { wordId, due(ISO, advanced) }
```

## 5. Stories

### Phase 1: Server review endpoints (EP38-PH01)

### EP38-ST01: Review contract DTOs in `@gll/api-contract`

**Scope**: Wire DTOs only — `ReviewQuestionType`, `DueReviewItem`/`DueReviewsResponse`, `ReviewAnswerRequest`, `ReviewAnswerResponse`. No server/client logic, no thresholds, no rating type.
**Read List**: `packages/api-contract/src/srs.ts`, `packages/api-contract/src/index.ts`, `packages/api-contract/src/errors.ts` (reuse `ErrorCode`)
**Tasks**:

- [ ] Add the four DTOs to `srs.ts` (co-located with `AnswerRequest`/`AnswerResponse`); export from `index.ts`
- [ ] Document `latencyMs`/`questionType` as recorded-not-rated wire facts; confirm no `ReviewRating`/threshold/band type is added
      **Acceptance Criteria**:
- [ ] `@gll/api-contract` builds; the four DTOs are importable; `due` is typed `string` (ISO), not `Date`
- [ ] No rating, threshold, or band type is present in the contract (grep confirms `ReviewRating` stays only in `@gll/srs-review`)

### EP38-ST02: `GET /api/reviews` due-cards route (pool-global)

**Scope**: One read-only Hono route projecting `getDueReviewCards` to `DueReviewsResponse`. Order preserved; orphan tolerance inherited.
**Read List**: `apps/server/src/routes/answer.ts` (router/envelope/`getDb` pattern), `apps/server/src/app.ts` (**router registration/mount** — `app.route('/api', …)` lives here, not `index.ts`), `packages/db/src/sqlite-review-store.ts` (`getDueReviewCards`), `packages/api-contract/src/srs.ts` (ST01 output)
**Tasks**:

- [ ] Create `apps/server/src/routes/reviews.ts` with `GET /reviews` → `new SqliteReviewStore(getDb()).getDueReviewCards(USER_ID, new Date())`, mapped to `{ wordId, due: due.toISOString() }`
- [ ] Mount the router in `app.ts` via `app.route('/api', reviewsRouter)`, alongside the existing routers
      **Acceptance Criteria**:
- [ ] A word seeded at graduation (EP37) whose `due` has passed appears in `GET /api/reviews`; one not yet due does not
- [ ] Cards are returned most-overdue-first (store's `asc(due)` preserved through the projection)
- [ ] An orphaned card (word deleted) does not crash the route (store returns it; route projects it; no word lookup here)
- [ ] Response matches `ApiResponse<DueReviewsResponse>`; `due` values are ISO strings

### EP38-ST03: `POST /api/reviews/answer` server-authoritative advance

**Scope**: Validate → correctness-only rating → `FsrsScheduler.schedule` → `upsertReviewCard` → return new `due`. Missing card → `NOT_FOUND`; malformed → `BAD_REQUEST`, card unchanged. (ST04 adds the record onto this path.)
**Read List**: `apps/server/src/routes/answer.ts` (validation + scheduler + correlation-id pattern), `packages/srs-review/src/FsrsScheduler.ts` (`schedule`), `packages/srs-review/src/types.ts` (`ReviewRating`, `ReviewCard`), `packages/db/src/sqlite-review-store.ts` (`getReviewCard`, `upsertReviewCard`), `packages/api-contract/src/srs.ts`/`errors.ts`
**Tasks**:

- [ ] Add `POST /reviews/answer` to `reviews.ts`; parse JSON with the `answer.ts` guard; validate `wordId`/`correct`/`latencyMs`/`questionType`
- [ ] `const rating: ReviewRating = req.correct ? 'good' : 'again'` — do **not** read `latencyMs`/`questionType` for the rating
- [ ] `getReviewCard`; on null return typed `NOT_FOUND` (no seed); else `upsertReviewCard(scheduler.schedule(card, rating, now))`
- [ ] Return `ReviewAnswerResponse { wordId, due: advanced.due.toISOString() }`; thread `x-correlation-id` into `logger.child`
      **Acceptance Criteria**:
- [ ] Answering a due review posts `{ wordId, correct, latencyMs, questionType }`; the server maps wrong→`again`, correct→`good` and the persisted card's `due` advances via `FsrsScheduler.schedule`
- [ ] A slow-but-correct answer (large `latencyMs`) advances identically to a fast correct one (latency ignored) — asserted via the store
- [ ] Write-on-answer: after a `200`, the `review_cards` row's `due`/`schedulerData` reflect the advance immediately (no deferred write)
- [ ] Malformed body → `400 BAD_REQUEST` and the card row is **unchanged** (no `upsert` ran)
- [ ] Unknown `wordId` (no card) → `404 NOT_FOUND`; no row is created (advance never seeds)
- [ ] The client sends no rating; `ReviewRating` never appears in the contract or the request

### EP38-ST04: Durable review-answer record

**Scope**: New append-only `review_answer_events` table + `SqliteReviewAnswerEventStore`; append one row per advance on the ST03 path, fail-open. Recording only — never feeds the rating.
**Read List**: `packages/db/src/schema.ts` (`answer_events` precedent), `packages/db/src/sqlite-answer-event-store.ts`, `packages/db/src/types/answer-event-store.ts`, `packages/db/src/index.ts` (exports), `packages/db/src/init-db.ts` (**migration runner** — applies `drizzle/migrations/*.sql` in order; editing `schema.ts` alone does **not** create the table at runtime), `packages/db/drizzle/migrations/0006_answer_events.sql` (new-table migration precedent), `apps/server/src/routes/reviews.ts` (ST03 output)
**Tasks**:

- [ ] Add `review_answer_events` to `schema.ts` (columns per §3) — drizzle model, for typing/introspection
- [ ] **Author the migration `packages/db/drizzle/migrations/0008_review_answer_events.sql`** (`CREATE TABLE IF NOT EXISTS review_answer_events …`, columns per §3), mirroring `0006_answer_events.sql`. This is the deliverable that actually creates the table; `init-db.ts` applies it on boot. **Separate table by design** — not folded into `answer_events` (see below)
- [ ] Add `IReviewAnswerEventStore` + `ReviewAnswerEventRecord` types and `SqliteReviewAnswerEventStore` (mirror `SqliteAnswerEventStore`: insert-and-run, log-and-rethrow); export from `@gll/db`
- [ ] In `reviews.ts`, **after** `upsertReviewCard` succeeds, `try { appendReviewAnswerEvent({...facts, rating, correlationId, createdAt: now.toISOString()}) } catch { /* logged; advance stands */ }`
      **Acceptance Criteria**:
- [ ] Each `POST /api/reviews/answer` appends exactly one `review_answer_events` row carrying `wordId`, `correct`, `latencyMs`, `questionType`, the inferred `rating`, `correlation_id`, and `created_at`
- [ ] The recorded `rating` equals the rating that advanced the card (`again`/`good` this build)
- [ ] A simulated record-write failure logs an error but the response is still `200` and the `review_cards` advance is intact (fail-open) — the answer is not lost
- [ ] `latencyMs`/`questionType` are recorded but demonstrably do **not** change the advance (ST03 rating unaffected)
- [ ] The table is append-only (no update/delete path added); `@gll/db` typechecks

## 6. Success Criteria

1. `GET /api/reviews` surfaces the user's pool-global due cards (most-overdue-first, ISO `due`), backed by `getDueReviewCards`, tolerating orphans.
2. `POST /api/reviews/answer` advances an existing card server-side via `FsrsScheduler.schedule` using a **correctness-only** rating (wrong→`again`, correct→`good`); response time and question type never affect it.
3. Write-on-answer: every valid advance persists (`upsertReviewCard`) before responding; a malformed body or unknown word leaves the card unchanged and returns a typed error.
4. Each advance appends a durable `review_answer_events` record (raw facts + inferred rating + correlation id), fail-open, feeding no rating logic now.
5. `@gll/api-contract` gains only wire DTOs — no rating, threshold, or band type; `ReviewRating` stays behind `@gll/srs-review`; the frontend imports no `ts-fsrs` (no frontend code added here).
6. No type errors; `POST /api/answer` (EP37 seeding) and all other routes are unchanged.

## 7. Implementation Notes (20260709)

**Status: all four stories landed.** ST01 (`b832b6e`), ST02/ST03 (`8859ff2`),
ST04 (`5cc667c`). `GET /api/reviews` and `POST /api/reviews/answer` live in
[`apps/server/src/routes/reviews.ts`](../../../apps/server/src/routes/reviews.ts);
the append-only channel is `review_answer_events` + `SqliteReviewAnswerEventStore`.
Built as specified — correctness-only rating (`correct ? 'good' : 'again'`),
`upsertReviewCard` (not seed), `NOT_FOUND` on missing card, fail-open record.

**Verified live** during DS02 verification (Playwright drive against a real
server): `GET /api/reviews` returns due cards most-overdue-first as ISO `due`;
`POST /api/reviews/answer` advanced a card (`due` moved ~4 days out) and returned
the new schedule; a forced `500` on the answer left the client halted without
advancing.

**⚠️ Known gap — no first-class way to reach a "review is due" state for
testing.** Two facts combine into a real friction point discovered while
verifying DS02:
- A card is only created **on graduation** via `POST /api/answer` — and its
  first `due` is scheduled **in the future** (FSRS), so it does **not** appear in
  `GET /api/reviews` immediately.
- `POST /api/test/seed` seeds `WordState`/shelving/stagnation but **not** review
  cards.

So exercising Review (manually or via e2e) currently requires graduating a word
**and then backdating `review_cards.due` directly in SQLite**. This is the main
reason DS02's e2e is deferred. **Recommended follow-up**: a test-only seed
endpoint (e.g. `POST /api/test/seed-review` inserting an already-due card with
valid `scheduler_data`) so Review can be driven without touching the DB file. The
manual backdate workaround is documented in
[`apps/srs-demo/README.md`](../../../apps/srs-demo/README.md#seeding-a-due-review-card-to-exercise-review-mode).
