# EP39-DS01: Server — Due-Gated Advance & Anytime-Review Endpoint Specification

**Date**: 20260710T011037Z
**Status**: Impl-Complete
**Epic**: [EP39 - Review Mode: Eager Practice & Feedback](../../plans/epics/EP39-review-mode-redesign.md)

**Architecture**:
[Review-Ahead (Eager Practice) and the Due-Gated Schedule-Advance Rule](../../../product-documentation/architecture/20260709T143643Z-engineering-review-ahead-and-due-gated-advance.md) — **Accepted 20260710**. This DS delivers the server half (EP39-PH01): the **due-gate** on `POST /api/reviews/answer` (ADR §2) and a **read route over all learned words** for the eager session (ADR §1), ordered per **FR-014**. Read-only is scoped to **FSRS scheduler state** (`due`/stability/difficulty) per **NFR-005 / ADR §3** — practice bookkeeping (the `review_answer_events` append, the recency used for ordering) is explicitly allowed. D5 (rating never *asked*), server-authoritative rating, and the frontend-never-imports-`ts-fsrs` boundary all remain in force. Requirements traced: FR-001/003/005/006/007/012/014/016, NFR-002/005.

---

## 1. Feature Overview

EP38 delivered two review endpoints. This DS **extends them in place** rather than adding a parallel
path — the ADR's whole point is that **one answer endpoint serves both due and eager answers**, with
due-ness (not session type, not a client flag) deciding whether the schedule advances.

PH01 delivers three server changes:

- **Due-gate `POST /api/reviews/answer`** — before scheduling, the server derives due-ness from the
  **persisted card's `due`** at answer time. **Due** → advance via `FsrsScheduler.schedule` + persist.
  **Not due** → **skip** the schedule/persist entirely; the card's scheduler state is untouched. Both
  branches still append to `review_answer_events`. The response gains an `advanced` boolean so the
  client summary can report what happened, without ever learning *why* (no due flag crosses the wire).
- **`GET /api/reviews/anytime`** — a read route over **all learned words** via the existing (until now
  unused) `SqliteReviewStore.getAllReviewCards`, returning a **bounded batch of ≤50**, ordered
  **most-overdue-first** with a **least-recently-practised** re-rank on the not-due tail (recency =
  `MAX(created_at)` per word from `review_answer_events`). Read-only.
- **A nullable `rating`** on `review_answer_events` — an eager (not-due) answer produces **no FSRS
  rating** (ADR §3), so `rating IS NULL` becomes the durable marker of a read-only answer, cleanly
  distinguishing eager rows from scheduled ones for the future metric.

**The one invariant this DS locks (NFR-005, testable).** After a **not-due** answer, the
`review_cards` row's `due`/`schedulerData` are byte-for-byte unchanged — the word's next *scheduled*
review does not move. The eager answer changes only append-only bookkeeping. This is the safety
property that makes review-ahead non-corrupting; it earns a dedicated test.

**What is reused, not built**:

- **Scheduling / persistence / validation / envelope**: the entire `POST /api/reviews/answer` body,
  `FsrsScheduler.schedule`, `getReviewCard`/`upsertReviewCard`, the `ReviewAnswerRequest` validation
  guard, the `ApiResponse<T>` envelope and `x-correlation-id` plumbing — all already in
  [`reviews.ts`](../../../apps/server/src/routes/reviews.ts). The due-gate is a single branch around
  the existing advance.
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
| Due-gate keys on server truth | `const isDue = card.due.getTime() <= now.getTime()` — from the **persisted** card, never the request or session | ADR §2: authority stays server-side; no spoofable client flag. FR-007 |
| Advance only when due | `isDue` → `schedule` + `upsertReviewCard`. `!isDue` → **no** `schedule`, **no** `upsert` | FR-005/006; NFR-005 — a not-due card's scheduler state is provably unchanged |
| One endpoint, both paths | Keep the single `POST /api/reviews/answer`; do **not** add a `/practice` route or `practice:true` flag | ADR §2 + rejected Alternative — splitting by session hands scheduling authority to the client |
| Eager answers still recorded | Append `review_answer_events` on **both** branches; on the not-due branch `rating = null` | ADR §3 — keep the data for the deferred metric at no schedule cost; `rating IS NULL` marks a read-only answer. FR-012 |
| `rating` becomes nullable | Migration `0009` rebuilds `review_answer_events` with `rating TEXT` (nullable); type `rating: string \| null` | Eager answers produce no rating; a sentinel would lie. Table is new (0008) with negligible data, so a rebuild is cheap |
| Response signals advancement | Add `advanced: boolean` to `ReviewAnswerResponse`; `due` is the resulting (or unchanged) ISO date | Client summary reports advanced-vs-practised without learning due-ness. No due flag crosses the wire |
| Anytime read source | `GET /api/reviews/anytime` → `getAllReviewCards(USER_ID)` (all graduated cards, due or not) | ADR §1 / FR-001/003 — "learned" ⟺ has a persisted `ReviewCard` |
| Anytime ordering | most-overdue-first overall; the **not-due tail** re-ranked **least-recently-practised first** (never-practised = front of tail); bounded to **50** | FR-014/016 — due words self-demote via their advanced schedule; not-due words rotate via recency so re-entry never re-serves the same tail in the same order |
| Ordering lives in a **pure helper** | `orderAnytimeBatch(cards, lastSeenByWord, now, limit)` in the route module, unit-tested in isolation | The rule spans two tables and is genuine policy; a pure function is far more testable than SQL gymnastics. Store stays a plain reader |
| Recency source | New `getLastPracticedAtByWord(userId): Promise<Map<wordId, iso>>` — `MAX(created_at) GROUP BY word_id` over `review_answer_events` | Derivable from the log we already write; no new schedule field, no card mutation. Covers due **and** eager answers |
| Read-only scope | The anytime read + recency query touch only `review_answer_events` + card reads; neither mutates a card | NFR-005 / ADR §3 — read-only = scheduler-state untouched; bookkeeping reads are free |
| No contract policy leak | Contract gains only `advanced:boolean` + an anytime response reusing `DueReviewItem`; no rating/threshold/ordering knob crosses | Ordering + due-gate are server policy; the wire carries facts only |
| Router mounting | Both changes live in the existing `reviews.ts`; the new route registers under the already-mounted `/api` router | No new module; same registration as EP38 |

## 3. Data Structures

### `@gll/api-contract` — DTO changes (`packages/api-contract/src/srs.ts`)

```typescript
/** Response data for POST /api/reviews/answer.
 *  `advanced` = did this answer move the FSRS schedule? (false ⟺ the card was
 *  not due at answer time → read-only). `due` is the resulting (or unchanged) ISO date. */
export interface ReviewAnswerResponse {
  wordId: string;
  due: string;        // ISO-8601 (unchanged when advanced === false)
  advanced: boolean;  // true only when the card was due and the schedule moved
}

/** Response data for GET /api/reviews/anytime — a bounded, ordered batch over ALL
 *  learned words (due or not). Item shape reuses DueReviewItem (wordId + ISO due). */
export interface AnytimeReviewsResponse {
  reviews: DueReviewItem[]; // ≤50, most-overdue-first with not-due tail least-recently-practised
}
```

### `review_answer_events` — `rating` becomes nullable

```typescript
// packages/db/src/schema.ts
rating: text('rating'),   // was text('rating').notNull(); NULL ⟺ eager/not-due answer (no FSRS rating)

// packages/db/src/types/review-answer-event-store.ts
rating: string | null;    // was string; null on the not-due (eager) branch
```

```sql
-- packages/db/drizzle/migrations/0009_review_answer_events_nullable_rating.sql
-- SQLite can't DROP NOT NULL in place → rebuild (table is new in 0008, minimal data).
ALTER TABLE review_answer_events RENAME TO review_answer_events_old;
CREATE TABLE review_answer_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT, correlation_id TEXT, user_id TEXT NOT NULL,
  word_id TEXT NOT NULL, correct INTEGER NOT NULL, latency_ms INTEGER NOT NULL,
  question_type TEXT NOT NULL, rating TEXT /* nullable now */, created_at TEXT NOT NULL
);
INSERT INTO review_answer_events
  SELECT id, correlation_id, user_id, word_id, correct, latency_ms, question_type, rating, created_at
  FROM review_answer_events_old;
DROP TABLE review_answer_events_old;
```

### New store read — last-practised recency (`packages/db/src/sqlite-review-store.ts`)

```typescript
async getLastPracticedAtByWord(userId: string): Promise<Map<string, string>> {
  const rows = this.db
    .select({ word_id: schema.review_answer_events.word_id,
              last: sql<string>`MAX(${schema.review_answer_events.created_at})` })
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
  cards: ReviewCard[], lastSeenByWord: Map<string, string>, now: Date, limit = ANYTIME_LIMIT,
): ReviewCard[] {
  const t = now.getTime();
  const due = cards.filter((c) => c.due.getTime() <= t)
    .sort((a, b) => a.due.getTime() - b.due.getTime());            // most-overdue-first
  const notDue = cards.filter((c) => c.due.getTime() > t)
    .sort((a, b) => (lastSeenByWord.get(a.wordId) ?? '')
      .localeCompare(lastSeenByWord.get(b.wordId) ?? ''));         // least-recently-practised ('' = never → front)
  return [...due, ...notDue].slice(0, limit);
}
```

### Due-gate + anytime route (`apps/server/src/routes/reviews.ts`)

```typescript
// GET /api/reviews/anytime — bounded, ordered batch over ALL learned words. Read-only.
router.get('/reviews/anytime', async (c) => {
  const now = new Date();
  const store = new SqliteReviewStore(getDb());
  const cards = await store.getAllReviewCards(USER_ID);
  const lastSeen = await store.getLastPracticedAtByWord(USER_ID);
  const batch = orderAnytimeBatch(cards, lastSeen, now, ANYTIME_LIMIT);
  const data: AnytimeReviewsResponse = {
    reviews: batch.map((cd) => ({ wordId: cd.wordId, due: cd.due.toISOString() })),
  };
  return c.json({ success: true, data } satisfies ApiResponse<AnytimeReviewsResponse>);
});

// POST /api/reviews/answer — the due-gate wrapped around EP38's advance.
router.post('/reviews/answer', async (c) => {
  /* … parse + validate body (unchanged from EP38) … */
  const now = new Date();
  const store = new SqliteReviewStore(getDb());
  const card = await store.getReviewCard(USER_ID, req.wordId);
  if (!card) return c.json(notFound('no review card for wordId'), 404);

  // Due-gate (ADR §2): advance iff the card is due at answer time, from the PERSISTED
  // card — never the request or which session it came through. No spoofable flag.
  const isDue = card.due.getTime() <= now.getTime();

  // Due → correctness-only rating; not-due → no FSRS rating (recorded as null).
  const rating: ReviewRating | null = isDue ? (req.correct ? 'good' : 'again') : null;

  // Due path only: advance + persist (write-on-answer). Not-due leaves due/schedulerData
  // byte-for-byte untouched (NFR-005).
  let resultDue = card.due;
  if (isDue) {
    const advanced = scheduler.schedule(card, rating as ReviewRating, now);
    await store.upsertReviewCard(USER_ID, advanced);
    resultDue = advanced.due;
  }

  // Durable record on BOTH branches — fail-open. `rating` is null for eager answers.
  try {
    await new SqliteReviewAnswerEventStore(getDb(), log).appendReviewAnswerEvent({
      correlationId, userId: USER_ID, wordId: req.wordId, correct: req.correct,
      latencyMs: req.latencyMs, questionType: req.questionType, rating, createdAt: now.toISOString(),
    });
  } catch { /* logged; advance (if any) stands */ }

  const data: ReviewAnswerResponse = { wordId: req.wordId, due: resultDue.toISOString(), advanced: isDue };
  return c.json({ success: true, data } satisfies ApiResponse<ReviewAnswerResponse>);
});
```

## 4. User Workflows

```
POST /api/reviews/answer   { wordId, correct, latencyMs, questionType }   (UNCHANGED wire-in)
  → validate body ─ invalid? → 400 BAD_REQUEST (no store write)
  → card = getReviewCard(demo-user, wordId) ─ null? → 404 NOT_FOUND
  → isDue = card.due <= now                          // SERVER-DERIVED due-gate (ADR §2)
  ├─ isDue:  rating = correct ? 'good' : 'again'
  │          advanced = schedule(card, rating, now); upsertReviewCard(advanced)
  │          append review_answer_events { ...facts, rating }              // fail-open
  │          → 200 { wordId, due(ISO, advanced), advanced: true }
  └─ !isDue: (NO schedule, NO upsert — card untouched)
             append review_answer_events { ...facts, rating: null }        // fail-open
             → 200 { wordId, due(ISO, unchanged), advanced: false }

GET /api/reviews/anytime
  → cards    = getAllReviewCards(demo-user)           // all graduated, due or not
  → lastSeen = getLastPracticedAtByWord(demo-user)    // MAX(created_at) per word
  → batch    = orderAnytimeBatch(cards, lastSeen, now, 50)
  → 200 { reviews: batch.map(c => ({ wordId, due(ISO) })) }
```

## 5. Stories

### EP39-ST01: Contract DTO changes in `@gll/api-contract`

**Scope**: Add `advanced: boolean` to `ReviewAnswerResponse`; add `AnytimeReviewsResponse` (reuses `DueReviewItem`). Wire shapes only.
**Acceptance Criteria**:
- [x] `@gll/api-contract` builds; both types importable; `due` stays ISO `string`
- [x] No rating/threshold/ordering/due-flag type is added (`ReviewRating` stays only in `@gll/srs-review`)

### EP39-ST02: Due-gate `POST /api/reviews/answer`

**Scope**: Add the server-derived due-gate around the existing advance. Due → advance + persist + record (rating). Not due → record only (`rating: null`), card untouched, `advanced:false`. One endpoint; no client flag. Migration `0009` makes `rating` nullable.
**Acceptance Criteria**:
- [x] Answering a **due** card advances `review_cards.due` and returns `advanced:true` (identical to EP38 otherwise)
- [x] **NFR-005**: answering a **not-due** card leaves the row's `due` **and** `scheduler_data` byte-for-byte unchanged and returns `advanced:false` (asserted by reading the row before/after)
- [x] A not-due answer appends exactly one `review_answer_events` row with `rating IS NULL` + raw facts
- [x] A due answer appends one row with a non-null `rating` equal to what scheduled the card
- [x] Malformed body → `400`, no write, on **both** branches (validation precedes the due check); unknown word → `404`
- [x] Due-ness is derived only from the persisted card — no request field influences it (no `practice`/`due` field exists)

### EP39-ST03: `GET /api/reviews/anytime` — bounded, ordered learned-word batch

**Scope**: New read route: `getAllReviewCards` + `getLastPracticedAtByWord` → `orderAnytimeBatch` (≤50, most-overdue-first, not-due tail least-recently-practised) → project to `AnytimeReviewsResponse`. Read-only; orphan-tolerant.
**Acceptance Criteria**:
- [x] Returns **all** learned words (due and not-due) — a graduated word with a future `due` appears
- [x] Batch capped at **50**; with >50 learned words the 50 returned are the highest-priority per the ordering
- [x] Ordering: due first by `due` asc; not-due after, least-recently-practised first (never-practised precedes recently-practised) — asserted by the pure helper's unit test
- [x] **FR-016**: after recording a practice event for one of two not-due words, `orderAnytimeBatch` places the just-practised word **after** the untouched one
- [x] An orphaned card does not crash the route (projection only); response matches `ApiResponse<AnytimeReviewsResponse>` with ISO `due`

## 6. Success Criteria

1. `POST /api/reviews/answer` advances the schedule **iff the card is due at answer time** (server-derived); a not-due answer is read-only to `review_cards` yet is recorded with `rating IS NULL`. `advanced` reflects which happened.
2. One endpoint serves both due and eager answers; no `practice`/`due` field exists on the request, so due-ness cannot be spoofed (ADR §2).
3. `GET /api/reviews/anytime` returns a ≤50 batch over **all** learned words, most-overdue-first with the not-due tail re-ranked least-recently-practised (FR-014/016), backed by `getAllReviewCards` + recency from `review_answer_events`, tolerating orphans.
4. `review_answer_events.rating` is nullable; eager rows carry `NULL`, scheduled rows carry the inferred rating — the durable distinction the future metric needs.
5. The contract gains only `advanced:boolean` + `AnytimeReviewsResponse`; no rating/threshold/ordering/due-flag crosses. No frontend code is added, so the `ts-fsrs` boundary trivially holds.
6. No type errors; `GET /api/reviews` (due list) and `POST /api/answer` (EP37 seeding) are unchanged.

## 7. Implementation Notes

Landed in [`apps/server/src/routes/reviews.ts`](../../../apps/server/src/routes/reviews.ts) (due-gate
branch + `orderAnytimeBatch` + the anytime route), with `getLastPracticedAtByWord`/`getAllReviewCards`
on [`SqliteReviewStore`](../../../packages/db/src/sqlite-review-store.ts), migration `0009`, and the
nullable `rating`. Covered by `apps/server/src/__tests__/reviews.test.ts` (due-gate branches, NFR-005
before/after row assertion, `orderAnytimeBatch` ordering + FR-016 rotation) and the store tests.

**Test seeding** — the EP38 friction (no first-class "review is due" seed) applies here too, and
anytime testing needs both due and not-due learned cards. DS03's snapshot builder covers both (e.g.
`mature-interval` produces a not-due card; `mastered-due`/`relapsed-due` produce due cards).

**Deferred**: DS02 (client) consumes this — MCQ feedback moment, review-tab hub, Practice Anytime
session. OQ-C/OQ-D (retention metric; missed-eager → Difficult Words) remain deferred; `rating IS NULL`
rows are the seed data both would build on.
