# EP39-DS01: Server — Due-Gated Advance & Anytime-Review Endpoint Specification

**Date**: 20260710T011037Z
**Status**: Draft
**Epic**: [EP39 - Review Mode Redesign](../../plans/epics/EP39-review-mode-redesign.md)

**Architecture**:
[Review-Ahead (Eager Practice) and the Due-Gated Schedule-Advance Rule](../../../product-documentation/architecture/20260709T143643Z-engineering-review-ahead-and-due-gated-advance.md) — **Accepted 20260710**. This DS delivers the server half (EP39-PH01): the **due-gate** on `POST /api/reviews/answer` (ADR §2) and a **read route over all learned words** for the eager session (ADR §1), ordered per **FR-014**. Read-only is scoped to **FSRS scheduler state** (`due`/stability/difficulty) per **NFR-005 / ADR §3** — practice bookkeeping (the `review_answer_events` append, the recency used for ordering) is explicitly allowed. D5 (rating never *asked*), server-authoritative rating, and the frontend-never-imports-`ts-fsrs` boundary all remain in force. Requirements traced: FR-001/003/005/006/007/012/014/016, NFR-002/005.

---

## 1. Feature Overview

EP38 shipped two review endpoints. This DS **extends them in place** rather than adding a parallel
path — the ADR's whole point is that **one answer endpoint serves both due and eager answers**, with
due-ness (not session type, not a client flag) deciding whether the schedule advances.

PH01 delivers three server changes:

- **Due-gate `POST /api/reviews/answer`** — before scheduling, the server derives due-ness from the
  **persisted card's `due`** at answer time. **Due** → advance via `FsrsScheduler.schedule` + persist
  (exactly as today). **Not due** → **skip** the schedule/persist entirely; the card's scheduler
  state is untouched. Both branches still append to `review_answer_events`. The response gains an
  `advanced` boolean so the client summary can report what happened, without ever learning *why*
  (no due flag crosses the wire).
- **`GET /api/reviews/anytime`** — a read route over **all learned words** via the existing (unused)
  [`SqliteReviewStore.getAllReviewCards`](../../../packages/db/src/sqlite-review-store.ts#L120),
  returning a **bounded batch of ≤50**, ordered **most-overdue-first** with a
  **least-recently-practised** re-rank on the not-due tail (recency = `MAX(created_at)` per word from
  `review_answer_events`). Read-only.
- **A nullable `rating`** on `review_answer_events` — an eager (not-due) answer produces **no FSRS
  rating** (ADR §3), so `rating IS NULL` becomes the durable marker of a read-only answer, cleanly
  distinguishing eager rows from scheduled ones for the future metric.

**The one invariant this DS locks (NFR-005, testable).** After a **not-due** answer, the
`review_cards` row's `due`/`schedulerData` are byte-for-byte unchanged — the word's next *scheduled*
review does not move. The eager answer changes only append-only bookkeeping. This is the safety
property that makes review-ahead non-corrupting; it earns a dedicated test.

**What is reused, not built** (keeps this DS small):

- **Scheduling / persistence / validation / envelope**: the entire `POST /api/reviews/answer` body,
  `FsrsScheduler.schedule`, `getReviewCard`/`upsertReviewCard`, the `ReviewAnswerRequest` validation
  guard, the `ApiResponse<T>` envelope and `x-correlation-id` plumbing — all already in
  [`reviews.ts`](../../../apps/server/src/routes/reviews.ts). The due-gate is a single branch added
  around the existing advance.
- **`review_answer_events` + `SqliteReviewAnswerEventStore`** (EP38-ST04) — reused as-is except the
  `rating` column/type becoming nullable.
- **`getAllReviewCards`** — already on the store; this DS adds ordering/bounding on top, not a new read.

**Not in this DS**: any `srs-demo` UI (DS02 — MCQ feedback moment, review-tab hub, Practice Anytime
session); the retention metric; deck-scoped anytime review; Difficult Words. `GET /api/reviews`
(due-only list) and `POST /api/answer` (EP37 seeding) are untouched.

---

## 2. Core Requirements

| Requirement | Decision | Rationale |
| --- | --- | --- |
| Due-gate keys on server truth | `const isDue = card.due.getTime() <= now.getTime()` — derived from the **persisted** card, never from the request or session | ADR §2: authority stays server-side; there is no spoofable client flag. FR-007 |
| Advance only when due | `isDue` → `schedule` + `upsertReviewCard` (unchanged path). `!isDue` → **no** `schedule`, **no** `upsert` | FR-005/006; NFR-005 — a not-due card's scheduler state is provably unchanged |
| One endpoint, both paths | Keep the single `POST /api/reviews/answer`; do **not** add a `/practice` route or a `practice:true` flag | ADR §2 + rejected Alternative — splitting by session hands scheduling authority to the client |
| Eager answers still recorded | Append `review_answer_events` on **both** branches; on the not-due branch `rating = null` | ADR §3 — keep the data for the deferred metric at no schedule cost; `rating IS NULL` marks a read-only answer. FR-012 |
| `rating` becomes nullable | Migration `0009` rebuilds `review_answer_events` with `rating TEXT` (nullable); type `rating: string \| null` | Eager answers produce no rating; a sentinel would lie. Table is new (0008) with negligible data, so a rebuild is cheap |
| Response signals advancement | Add `advanced: boolean` to `ReviewAnswerResponse`; `due` is the resulting (or unchanged) ISO date | Client summary reports advanced-vs-practised without learning due-ness. No due flag crosses the wire |
| Anytime read source | `GET /api/reviews/anytime` → `getAllReviewCards(USER_ID)` (all graduated cards, due or not) | ADR §1 / FR-001/003 — "learned" ⟺ has a persisted `ReviewCard` |
| Anytime ordering | most-overdue-first overall; the **not-due tail** re-ranked **least-recently-practised first** (never-practised = front of tail); bounded to **50** | FR-014/016 — due words self-demote via their advanced schedule; not-due words rotate via recency so re-entry never re-serves the same tail in the same order |
| Ordering lives in a **pure helper** | `orderAnytimeBatch(cards, lastSeenByWord, now, limit)` in the route module, unit-tested in isolation | The rule spans two tables and is genuine policy (not one column sort); a pure function is far more testable than SQL gymnastics. Store stays a plain reader |
| Recency source | New `getLastPracticedAtByWord(userId): Promise<Map<wordId, iso>>` — `MAX(created_at) GROUP BY word_id` over `review_answer_events` | Recency is derivable from the log we already write; no new schedule field, no card mutation. Covers due **and** eager answers ("last practised") |
| Read-only scope | The anytime read and the recency query touch only `review_answer_events` + card reads; neither mutates a card | NFR-005 / ADR §3 — read-only = scheduler-state untouched; bookkeeping reads are free |
| No contract policy leak | Contract gains only `advanced:boolean` + an anytime response reusing `DueReviewItem`; no rating/threshold/ordering knob crosses | Ordering + due-gate are server policy; the wire carries facts only (EP38 rule upheld) |
| Router mounting | Both changes live in the existing `reviews.ts`; the new route registers under the already-mounted `/api` router | No new module; same registration as EP38 |

## 3. Data Structures

### `@gll/api-contract` — DTO changes (in `packages/api-contract/src/srs.ts`)

```typescript
/** Response data for POST /api/reviews/answer.
 *  `advanced` = did this answer move the FSRS schedule? (false ⟺ the card was
 *  not due at answer time → read-only). `due` is the resulting (or unchanged)
 *  schedule date, ISO-8601. */
export interface ReviewAnswerResponse {
  wordId: string;
  due: string;        // ISO-8601 (unchanged when advanced === false)
  advanced: boolean;  // NEW — true only when the card was due and the schedule moved
}

/** Response data for GET /api/reviews/anytime — a bounded, ordered batch over ALL
 *  learned words (due or not). Item shape reuses DueReviewItem (wordId + ISO due). */
export interface AnytimeReviewsResponse {
  reviews: DueReviewItem[]; // ≤50, most-overdue-first with not-due tail least-recently-practised
}
```

> No rating, threshold, ordering strategy, or due flag crosses the contract. `ReviewRating` stays in
> `@gll/srs-review`; the batch limit (50) and ordering rule stay server-side.

### `review_answer_events` — `rating` becomes nullable

```typescript
// packages/db/src/schema.ts
rating: text('rating'),   // was text('rating').notNull(); NULL ⟺ eager/not-advanced (no FSRS rating)

// packages/db/src/types/review-answer-event-store.ts
export interface ReviewAnswerEventRecord {
  // …unchanged…
  rating: string | null;  // was string; null on the not-due (eager) branch
}
```

```sql
-- packages/db/drizzle/migrations/0009_review_answer_events_nullable_rating.sql
-- SQLite can't DROP NOT NULL in place → rebuild (table is new in 0008, minimal data).
ALTER TABLE review_answer_events RENAME TO review_answer_events_old;
CREATE TABLE review_answer_events (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  correlation_id TEXT,
  user_id        TEXT    NOT NULL,
  word_id        TEXT    NOT NULL,
  correct        INTEGER NOT NULL,
  latency_ms     INTEGER NOT NULL,
  question_type  TEXT    NOT NULL,
  rating         TEXT,             -- nullable now
  created_at     TEXT    NOT NULL
);
INSERT INTO review_answer_events
  SELECT id, correlation_id, user_id, word_id, correct, latency_ms, question_type, rating, created_at
  FROM review_answer_events_old;
DROP TABLE review_answer_events_old;
```

### New store read — last-practised recency

```typescript
// packages/db/src/sqlite-review-store.ts
async getLastPracticedAtByWord(userId: string): Promise<Map<string, string>> {
  const rows = this.db
    .select({
      word_id: schema.review_answer_events.word_id,
      last: sql<string>`MAX(${schema.review_answer_events.created_at})`,
    })
    .from(schema.review_answer_events)
    .where(eq(schema.review_answer_events.user_id, userId))
    .groupBy(schema.review_answer_events.word_id)
    .all();
  return new Map(rows.map((r) => [r.word_id, r.last]));
}
```

### Pure ordering helper (`apps/server/src/routes/reviews.ts`)

```typescript
const ANYTIME_LIMIT = 50;

/** FR-014/016. Due cards first (most-overdue-first). Not-due tail re-ranked
 *  least-recently-practised first (never-practised sorts to the front of the tail).
 *  Bounded to `limit`. Pure — unit-tested without a DB. */
export function orderAnytimeBatch(
  cards: ReviewCard[],
  lastSeenByWord: Map<string, string>,
  now: Date,
  limit = ANYTIME_LIMIT,
): ReviewCard[] {
  const t = now.getTime();
  const due = cards.filter((c) => c.due.getTime() <= t)
    .sort((a, b) => a.due.getTime() - b.due.getTime());            // most-overdue-first
  const notDue = cards.filter((c) => c.due.getTime() > t)
    .sort((a, b) => (lastSeenByWord.get(a.wordId) ?? '') .localeCompare(lastSeenByWord.get(b.wordId) ?? '')); // least-recently-practised first ('' = never → front
  return [...due, ...notDue].slice(0, limit);
}
```

## 4. User Workflows

```
POST /api/reviews/answer   { wordId, correct, latencyMs, questionType }   (UNCHANGED wire-in)
  → validate body ─ invalid? → 400 BAD_REQUEST (no store write)
  → now = new Date()
  → card = getReviewCard(demo-user, wordId) ─ null? → 404 NOT_FOUND
  → isDue = card.due <= now                          // SERVER-DERIVED due-gate (ADR §2)
  ├─ isDue:                                           // due → advance (EP38 path)
  │    rating = correct ? 'good' : 'again'
  │    advanced = FsrsScheduler.schedule(card, rating, now)
  │    upsertReviewCard(demo-user, advanced)          // write-on-answer
  │    append review_answer_events { ...facts, rating }              // fail-open
  │    → 200 { wordId, due(ISO, advanced), advanced: true }
  └─ !isDue:                                          // not due → READ-ONLY (ADR §3)
       (NO schedule, NO upsert — card.due/schedulerData untouched)
       append review_answer_events { ...facts, rating: null }        // fail-open
       → 200 { wordId, due(ISO, unchanged card.due), advanced: false }

GET /api/reviews/anytime
  → cards   = getAllReviewCards(demo-user)            // all graduated, due or not
  → lastSeen= getLastPracticedAtByWord(demo-user)     // MAX(created_at) per word
  → batch   = orderAnytimeBatch(cards, lastSeen, now, 50)
  → 200 { reviews: batch.map(c => ({ wordId, due(ISO) })) }
```

## 5. Stories

### Phase 1: Server — due-gate + anytime read (EP39-PH01)

### EP39-ST01: Contract DTO changes in `@gll/api-contract`

**Scope**: Add `advanced: boolean` to `ReviewAnswerResponse`; add `AnytimeReviewsResponse` (reuses `DueReviewItem`). Wire shapes only — no rating/threshold/ordering type.
**Read List**: `packages/api-contract/src/srs.ts` (existing review DTOs), `packages/api-contract/src/index.ts`
**Tasks**:

- [ ] Add `advanced: boolean` to `ReviewAnswerResponse`
- [ ] Add `AnytimeReviewsResponse { reviews: DueReviewItem[] }`; export from `index.ts`
      **Acceptance Criteria**:
- [ ] `@gll/api-contract` builds; both types importable; `due` stays ISO `string`
- [ ] No rating/threshold/ordering/due-flag type is added (grep: `ReviewRating` stays only in `@gll/srs-review`)

### EP39-ST02: Due-gate `POST /api/reviews/answer`

**Scope**: Add the server-derived due-gate around the existing advance. Due → advance + persist + record (rating). Not due → record only (`rating: null`), card untouched, `advanced:false`. One endpoint; no client flag.
**Read List**: `apps/server/src/routes/reviews.ts` (the whole existing handler), `packages/srs-review/src/FsrsScheduler.ts`, `packages/db/src/sqlite-review-store.ts` (`getReviewCard`/`upsertReviewCard`), `packages/db/src/sqlite-review-answer-event-store.ts`, `packages/db/src/types/review-answer-event-store.ts`, `packages/db/src/schema.ts` (`review_answer_events`), `packages/db/src/init-db.ts` (migration runner)
**Tasks**:

- [ ] Migration `0009_review_answer_events_nullable_rating.sql` (rebuild per §3); make `schema.ts` `rating` nullable and `ReviewAnswerEventRecord.rating: string | null`
- [ ] In the handler, after `getReviewCard`, compute `isDue = card.due.getTime() <= now.getTime()`
- [ ] `isDue` branch = today's advance (`schedule` + `upsertReviewCard`), record with the inferred `rating`, respond `{ …, advanced: true }`
- [ ] `!isDue` branch: **skip** `schedule`/`upsert`; append `review_answer_events` with `rating: null`; respond `{ wordId, due: card.due.toISOString(), advanced: false }`
- [ ] Keep both appends fail-open (unchanged pattern)
      **Acceptance Criteria**:
- [ ] Answering a **due** card advances `review_cards.due` and returns `advanced:true` (identical to EP38 behaviour otherwise)
- [ ] **NFR-005**: answering a **not-due** card leaves the `review_cards` row's `due` **and** `scheduler_data` byte-for-byte unchanged and returns `advanced:false` — asserted by reading the row before/after
- [ ] A not-due answer still appends exactly one `review_answer_events` row with `rating IS NULL` and the raw facts (`correct`/`latencyMs`/`questionType`)
- [ ] A due answer appends one row with a non-null `rating` equal to what scheduled the card
- [ ] Malformed body → `400`, no write, on **both** branches (validation precedes the due check); unknown word → `404`
- [ ] Due-ness is derived only from the persisted card — no request field influences it (no `practice`/`due` field exists on `ReviewAnswerRequest`)

### EP39-ST03: `GET /api/reviews/anytime` — bounded, ordered learned-word batch

**Scope**: New read route: `getAllReviewCards` + `getLastPracticedAtByWord` → `orderAnytimeBatch` (≤50, most-overdue-first, not-due tail least-recently-practised) → project to `AnytimeReviewsResponse`. Read-only; orphan-tolerant.
**Read List**: `apps/server/src/routes/reviews.ts` (existing `GET /reviews` projection), `packages/db/src/sqlite-review-store.ts` (`getAllReviewCards`, add `getLastPracticedAtByWord`), `packages/db/src/schema.ts` (`review_answer_events`), `packages/api-contract/src/srs.ts` (ST01 output)
**Tasks**:

- [ ] Add `getLastPracticedAtByWord(userId)` to `SqliteReviewStore` (`MAX(created_at) GROUP BY word_id`)
- [ ] Add the pure `orderAnytimeBatch(cards, lastSeenByWord, now, limit)` helper (exported for unit test)
- [ ] Add `GET /reviews/anytime` projecting the ordered batch to `{ wordId, due(ISO) }[]`
      **Acceptance Criteria**:
- [ ] Returns **all** learned words (due and not-due), not just due — a graduated word with a future `due` appears
- [ ] Batch is capped at **50**; with >50 learned words the 50 returned are the highest-priority per the ordering
- [ ] Ordering: due cards first by `due` asc; not-due cards after, least-recently-practised first (a never-practised not-due word precedes a recently-practised one) — asserted by the pure helper's unit test
- [ ] **FR-016**: given two not-due words, after recording a practice event for one, `orderAnytimeBatch` places the just-practised word **after** the untouched one (re-entry rotation)
- [ ] An orphaned card (word deleted) does not crash the route (projection only; no word lookup)
- [ ] Response matches `ApiResponse<AnytimeReviewsResponse>`; `due` values are ISO strings

## 6. Success Criteria

1. `POST /api/reviews/answer` advances the schedule **iff the card is due at answer time** (server-derived); a not-due answer is read-only to `review_cards` (`due`+`scheduler_data` unchanged) yet is recorded with `rating IS NULL`. `advanced` reflects which happened.
2. One endpoint serves both due and eager answers; no `practice`/`due` field exists on the request, so due-ness cannot be spoofed (ADR §2).
3. `GET /api/reviews/anytime` returns a ≤50 batch over **all** learned words, most-overdue-first with the not-due tail re-ranked least-recently-practised (FR-014/016), backed by `getAllReviewCards` + recency from `review_answer_events`, tolerating orphans.
4. `review_answer_events.rating` is nullable; eager rows carry `NULL`, scheduled rows carry the inferred rating — the durable distinction the future metric needs.
5. The contract gains only `advanced:boolean` + `AnytimeReviewsResponse`; no rating/threshold/ordering/due-flag crosses. `ReviewRating` stays behind `@gll/srs-review`; no frontend code is added, so the `ts-fsrs` boundary trivially holds.
6. No type errors; `GET /api/reviews` (due list) and `POST /api/answer` (EP37 seeding) are unchanged.

## 7. Open / Deferred

- **DS02 (client)** consumes this: MCQ feedback moment, review-tab hub, Practice Anytime session
  (posts to the due-gated endpoint, reads `GET /api/reviews/anytime`, uses `advanced` in the summary).
- **Test seed** — the EP38 friction (no first-class "review is due" seed; `reviewCards` fixture added
  in `db3bd20`) applies here too; anytime testing needs both due and not-due learned cards. Confirm the
  seed fixture can produce a not-due learned card, else extend it.
- **OQ-C/OQ-D** (retention metric; missed-eager → Difficult Words) remain deferred; `rating IS NULL`
  rows are the seed data both would build on.
