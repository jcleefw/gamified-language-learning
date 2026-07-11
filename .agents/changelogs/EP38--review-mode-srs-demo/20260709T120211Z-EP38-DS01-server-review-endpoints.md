# EP38-DS01: Server Review Endpoints (read / advance / record) Specification

**Date**: 20260709T120211Z
**Status**: Impl-Complete
**Epic**: [EP38 - Review Mode in `srs-demo`](../../plans/epics/EP38-review-mode-srs-demo.md)

**Architecture**:
[`srs-demo` Learning Authority, Review Authority & Debug-Trace Contract](../../../product-documentation/architecture/20260708T125551Z-engineering-srs-demo-learning-authority-and-debug-trace.md) — **Pillar 2 (Review authority is server-side)**. EP37 seeded the cards on graduation; this DS delivers the two routes that **surface** and **advance** them, plus a durable record channel. Governed behaviourally by the [SRS Review Phase ADR](../../../product-documentation/architecture/20260321T145300Z-engineering-srs-engine-v2-review-phase.md) (FSRS `enable_short_term:false`, write-on-answer) and the [Review Phase Packaging & Rating ADR](../../../product-documentation/architecture/20260708T005635Z-engineering-srs-review-phase-packaging.md) (**D5**: rating is inferred, never *asked*; the frontend never imports `ts-fsrs`). Response-time bands stay **T3** per the [Config Ownership & Layering ADR](../../../product-documentation/architecture/20260709T091559Z-engineering-config-ownership-and-layering.md) — this DS neither serves nor consumes them.

---

## 1. Feature Overview

This DS covers **Phase 1 (EP38-PH01)** — the server half of Review mode. After EP37, `review_cards`
rows accumulate on graduation but nothing reads or advances them. PH01 adds:

- **`GET /api/reviews`** — returns the user's **pool-global** due cards (`{ wordId, due }[]`,
  most-overdue-first) straight from the existing `SqliteReviewStore.getDueReviewCards`. Read-only;
  orphan tolerance is inherited from the store (pillar 3).
- **`POST /api/reviews/answer`** — receives `{ wordId, correct, latencyMs, questionType }`, maps it to
  an FSRS rating **server-side**, advances the card via `FsrsScheduler.schedule`, persists with
  `upsertReviewCard` (write-on-answer), and returns the new `due`.
- **A durable review-answer record** — every advance appends the raw answer facts (+ inferred rating +
  correlation id) to a new append-only `review_answer_events` table: seed data for a future
  response-time-scoring feature. Recording only; it never feeds the rating.

**The one rating decision this DS locks (correctness-only, deliberately).** The server maps
`correct === false → 'again'` and `correct === true → 'good'` — **both question types, response time
ignored**. `FsrsScheduler` supports `hard`/`easy` too, but the latency→band mechanism (ADR D5) is a
**deferred future feature** (Epic §Out of scope). We therefore *record* `latencyMs` + `questionType`
now (so that feature has per-type history to calibrate against) but never read them for scheduling.
When the feature ships it is a **server-only** change — swap the rating rule, add the T3 band table —
with **no contract change**, because the contract already carries the facts.

**Every card this endpoint sees is due.** The due-review session (DS02) only ever fetches due cards,
so each answer this route receives is for a card that is due, and each answer advances the schedule.
(EP39 extends this endpoint with a server-derived **due-gate** once eager/not-due answers are
introduced — see the [Review-Ahead & Due-Gated Advance ADR](../../../product-documentation/architecture/20260709T143643Z-engineering-review-ahead-and-due-gated-advance.md)
and EP39-DS01. Within EP38 there are no not-due answers, so no gate is needed.)

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
(`getDueReviewCardsForDeck` stays unused); orphaned-card cleanup; the response-time band table.
`POST /api/answer` (EP37 seeding) is untouched.

---

## 2. Core Requirements

| Requirement | Decision | Rationale |
| --- | --- | --- |
| Contract additions | Add `DueReviewItem`/`DueReviewsResponse`, `ReviewAnswerRequest`, `ReviewAnswerResponse`, `ReviewQuestionType` to `@gll/api-contract` (`srs.ts`) — **wire DTOs only** | These are the client↔server wire shapes (like `AnswerRequest`); they carry facts, not policy. DTOs are allowed; learning *config* is not |
| `due` on the wire | ISO-8601 **string** in both responses (not `Date`) | JSON has no Date; matches how `review_cards.due` is stored. `ReviewCard.due` is a `Date` in-process; the route serialises at the boundary |
| Read route | `GET /api/reviews` → `getDueReviewCards(USER_ID, now)`, mapped to `{ wordId, due: due.toISOString() }[]`, order preserved (store already sorts `asc(due)` = most-overdue-first) | Pool-global read; the store owns ordering and orphan tolerance. Route stays a thin projection |
| Rating inference | **Correctness-only, server-side**: `correct ? 'good' : 'again'` — response time and `questionType` **do not** affect it | Epic scope decision; D5 no-self-rating-prompt upheld (client never sends a rating). Slow-but-correct is never penalised |
| Advance persistence | `upsertReviewCard(USER_ID, scheduler.schedule(card, rating, now))` — **not** `seedReviewCard` | Advancing must overwrite `due`/`schedulerData`; `seedReviewCard` is ignore-if-exists and would silently no-op the advance |
| Missing card | If `getReviewCard` returns null, return typed `NOT_FOUND`; **do not** seed one | Review advances an existing graduated card; seeding is graduation's job (EP37). A due-but-absent card is a client/data error, surfaced not masked |
| Malformed body | Validate `wordId:string(non-empty)`, `correct:boolean`, `latencyMs:finite ≥0`, `questionType ∈ {'mcq','word-block'}`; on failure return `BAD_REQUEST` and **leave the card unchanged** | Mirrors `answer.ts` validation; AC "malformed leaves the card unchanged" — validation precedes any store write |
| Write-on-answer | Each valid advance persists immediately, before responding | Partial sessions always safe; the client can exit after any answer with the schedule already durable |
| Durable record | New append-only `review_answer_events` table + `SqliteReviewAnswerEventStore.appendReviewAnswerEvent(...)` | Seed data for the deferred response-time feature; append-only, **reuses the `SqliteAnswerEventStore` pattern** (insert-and-run, log-and-rethrow) but a **separate table** |
| Separate table (not reuse `answer_events`) | `review_answer_events` is its own table, not extra columns on `answer_events` | The two share a 6-column spine but diverge in payload and **owner**: `answer_events` is the Learning-transition channel (`after_state`/`graduated` `NOT NULL`), review rows have neither and add `question_type`/`rating`. Reuse would mean sparse nullable columns + a discriminator + coupling two epics through one table. Separate keeps every column meaningful |
| Record is fail-open | Wrap the record write in try/catch **after** the FSRS advance is persisted; a record failure logs and still returns `200` with the new `due` | Epic: "a record-write failure must not lose the FSRS advance." The schedule write is the contract; the record is diagnostics |
| Correlation id | Read `x-correlation-id`, thread it into `logger.child` and the record row | Reuses EP37's breadcrumb convention; no new tracing infra |
| Scheduler construction | Reuse a single module-level `new FsrsScheduler()` (stateless, default params) | Exactly the `answer.ts` pattern; no per-request allocation |
| Router mounting | New `apps/server/src/routes/reviews.ts`, mounted under `/api` alongside `answer`/`decks`/`config` | Same registration convention |

## 3. Data Structures

### `@gll/api-contract` — new wire DTOs (`packages/api-contract/src/srs.ts`)

```typescript
/** What was shown for a review answer — a wire fact, not policy.
 *  Mirrors the engine's QuizQuestion.kind so the client reports it as-is. */
export type ReviewQuestionType = 'mcq' | 'word-block';

/** One due review card for GET /api/reviews. `due` is ISO-8601 (JSON has no Date). */
export interface DueReviewItem {
  wordId: string;
  due: string; // ISO-8601
}

/** Response data for GET /api/reviews — pool-global due cards, most-overdue-first. */
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

> No rating, threshold, or band crosses the contract — `ReviewRating` stays in `@gll/srs-review`
> and is derived server-side. `ErrorCode` (BAD_REQUEST, NOT_FOUND) is reused from `errors.ts` as-is.
> *(EP39-DS01 adds `advanced: boolean` to `ReviewAnswerResponse` when the due-gate lands.)*

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
```

```typescript
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

Migration `0008_review_answer_events.sql` creates the table (`rating TEXT NOT NULL` this build).
`SqliteReviewAnswerEventStore` mirrors `SqliteAnswerEventStore` (insert-and-run; log-and-rethrow on
failure so the *call site* decides fail-open):

```typescript
// packages/db/src/sqlite-review-answer-event-store.ts
export class SqliteReviewAnswerEventStore implements IReviewAnswerEventStore {
  constructor(private readonly db: DbClient, private readonly logger: Logger = new NoopLogger()) {}

  async appendReviewAnswerEvent(record: ReviewAnswerEventRecord): Promise<void> {
    try {
      this.db.insert(schema.review_answer_events).values({
        correlation_id: record.correlationId,
        user_id: record.userId,
        word_id: record.wordId,
        correct: record.correct,
        latency_ms: record.latencyMs,
        question_type: record.questionType,
        rating: record.rating,
        created_at: record.createdAt,
      }).run();
    } catch (err) {
      this.logger.error('appendReviewAnswerEvent failed', { /* … */ });
      throw err; // caller decides fail-open
    }
  }
}
```

### Route (`apps/server/src/routes/reviews.ts`) — EP38 form

```typescript
const USER_ID = 'demo-user';       // TODO: real auth id later
const scheduler = new FsrsScheduler(); // stateless, module-level (answer.ts pattern)
const QUESTION_TYPES: readonly ReviewQuestionType[] = ['mcq', 'word-block'];

// GET /api/reviews — pool-global due cards, most-overdue-first (store owns ordering
// and orphan tolerance). Thin projection to ISO `due`.
router.get('/reviews', async (c) => {
  const now = new Date();
  const cards = await new SqliteReviewStore(getDb()).getDueReviewCards(USER_ID, now);
  const data: DueReviewsResponse = {
    reviews: cards.map((cd) => ({ wordId: cd.wordId, due: cd.due.toISOString() })),
  };
  return c.json({ success: true, data } satisfies ApiResponse<DueReviewsResponse>);
});

// POST /api/reviews/answer — server-authoritative advance. Correctness-only rating;
// latency/questionType recorded, never used for scheduling.
router.post('/reviews/answer', async (c) => {
  const correlationId = c.req.header('x-correlation-id') ?? null;
  const log = logger.child({ correlationId: correlationId ?? undefined });

  let payload: unknown;
  try { payload = await c.req.json(); }
  catch { return c.json(badRequest('Invalid JSON body'), 400); }

  const req = payload as ReviewAnswerRequest;
  if (!req || typeof req.wordId !== 'string' || req.wordId === '' ||
      typeof req.correct !== 'boolean' ||
      typeof req.latencyMs !== 'number' || !Number.isFinite(req.latencyMs) || req.latencyMs < 0 ||
      !QUESTION_TYPES.includes(req.questionType)) {
    return c.json(badRequest('wordId, correct, latencyMs, questionType are required'), 400);
  }

  const now = new Date();
  const store = new SqliteReviewStore(getDb());
  const card = await store.getReviewCard(USER_ID, req.wordId);
  if (!card) return c.json(notFound('no review card for wordId'), 404); // no seeding here

  const rating: ReviewRating = req.correct ? 'good' : 'again'; // correctness-only
  const advanced = scheduler.schedule(card, rating, now);
  await store.upsertReviewCard(USER_ID, advanced);              // write-on-answer

  try { // durable record — fail-open (must not lose the advance above)
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
  → getDueReviewCards(demo-user, now)              // store: due ≤ now, ORDER BY due ASC
  → 200 { reviews: [{ wordId, due(ISO) }, ...] }   // most-overdue-first; orphans tolerated by store

POST /api/reviews/answer   { wordId, correct, latencyMs, questionType }
  → correlationId = header('x-correlation-id')
  → validate body ─ invalid? → 400 BAD_REQUEST (NO store write; card unchanged)
  → now = new Date()
  → card = getReviewCard(demo-user, wordId) ─ null? → 404 NOT_FOUND (no seeding)
  → rating = correct ? 'good' : 'again'            // correctness-only; latency/type ignored
  → advanced = FsrsScheduler.schedule(card, rating, now)
  → upsertReviewCard(demo-user, advanced)          // write-on-answer, immediate
  → appendReviewAnswerEvent({...facts, rating, correlationId})   // fail-open
  → 200 { wordId, due(ISO, advanced) }
```

## 5. Stories

### EP38-ST01: Review contract DTOs in `@gll/api-contract`

**Scope**: Wire DTOs only — `ReviewQuestionType`, `DueReviewItem`/`DueReviewsResponse`, `ReviewAnswerRequest`, `ReviewAnswerResponse`. No server/client logic, no thresholds, no rating type.
**Acceptance Criteria**:
- [x] `@gll/api-contract` builds; the DTOs are importable; `due` is typed `string` (ISO), not `Date`
- [x] No rating, threshold, or band type is present in the contract (`ReviewRating` stays only in `@gll/srs-review`)

### EP38-ST02: `GET /api/reviews` due-cards route (pool-global)

**Scope**: One read-only Hono route projecting `getDueReviewCards` to `DueReviewsResponse`. Order preserved; orphan tolerance inherited.
**Acceptance Criteria**:
- [x] A word seeded at graduation (EP37) whose `due` has passed appears; one not yet due does not
- [x] Cards are returned most-overdue-first (store's `asc(due)` preserved through the projection)
- [x] An orphaned card (word deleted) does not crash the route (no word lookup here)
- [x] Response matches `ApiResponse<DueReviewsResponse>`; `due` values are ISO strings

### EP38-ST03: `POST /api/reviews/answer` server-authoritative advance

**Scope**: Validate → correctness-only rating → `FsrsScheduler.schedule` → `upsertReviewCard` → return new `due`. Missing card → `NOT_FOUND`; malformed → `BAD_REQUEST`, card unchanged.
**Acceptance Criteria**:
- [x] Answering posts `{ wordId, correct, latencyMs, questionType }`; server maps wrong→`again`, correct→`good`; the persisted card's `due` advances via `FsrsScheduler.schedule`
- [x] A slow-but-correct answer (large `latencyMs`) advances identically to a fast correct one (latency ignored)
- [x] Write-on-answer: after `200`, the `review_cards` row's `due`/`schedulerData` reflect the advance immediately
- [x] Malformed body → `400 BAD_REQUEST`, card row **unchanged** (no `upsert` ran)
- [x] Unknown `wordId` → `404 NOT_FOUND`; no row created (advance never seeds)
- [x] The client sends no rating; `ReviewRating` never appears in the contract or the request

### EP38-ST04: Durable review-answer record

**Scope**: New append-only `review_answer_events` table (migration `0008`) + `SqliteReviewAnswerEventStore`; append one row per advance on the ST03 path, fail-open. Recording only — never feeds the rating.
**Acceptance Criteria**:
- [x] Each `POST /api/reviews/answer` appends exactly one row carrying the facts + inferred `rating` + `correlation_id` + `created_at`
- [x] The recorded `rating` equals the rating that advanced the card (`again`/`good` this build)
- [x] A simulated record-write failure logs an error but the response is still `200` and the advance is intact (fail-open)
- [x] `latencyMs`/`questionType` are recorded but demonstrably do **not** change the advance
- [x] The table is append-only; `@gll/db` typechecks

## 6. Success Criteria

1. `GET /api/reviews` surfaces the user's pool-global due cards (most-overdue-first, ISO `due`), backed by `getDueReviewCards`, tolerating orphans.
2. `POST /api/reviews/answer` advances an existing card server-side via `FsrsScheduler.schedule` using a **correctness-only** rating; response time and question type never affect it. Every card reached is due (the due session only serves due cards).
3. Write-on-answer: every valid advance persists before responding; a malformed body or unknown word leaves the card unchanged and returns a typed error.
4. Each advance appends a durable `review_answer_events` record (raw facts + inferred rating + correlation id), fail-open, feeding no rating logic.
5. `@gll/api-contract` gains only wire DTOs — no rating, threshold, or band type; `ReviewRating` stays behind `@gll/srs-review`; the frontend imports no `ts-fsrs` (no frontend code here).
6. No type errors; `POST /api/answer` (EP37 seeding) and all other routes are unchanged.

## 7. Implementation Notes

All four stories landed in [`apps/server/src/routes/reviews.ts`](../../../apps/server/src/routes/reviews.ts)
and the append-only channel `review_answer_events` + `SqliteReviewAnswerEventStore`. Built as
specified — correctness-only rating (`correct ? 'good' : 'again'`), `upsertReviewCard` (not seed),
`NOT_FOUND` on missing card, fail-open record. Covered by `apps/server/src/__tests__/reviews.test.ts`
and `packages/db/src/__tests__/sqlite-review-answer-event-store.test.ts`, and verified live via a
Playwright drive against a real server (due cards returned most-overdue-first as ISO `due`; an answer
advanced a card's `due` and returned the new schedule; a forced `500` halted the client without
advancing).

**Known friction — reaching a "review is due" state for testing.** A card is created only on
graduation (`POST /api/answer`) and its first `due` is scheduled in the future (FSRS), so it does not
appear in `GET /api/reviews` immediately, and the base `/api/test/seed` did not cover review cards.
Exercising Review therefore required backdating `review_cards.due` directly in SQLite. This is why
EP38's BDD/e2e was deferred; **EP39's seeding infrastructure (DS03) resolves it** with a snapshot
builder + `pnpm seed` CLI that can place an already-due (or multi-day-history) card deterministically.
