# EP36-DS02: Review Store Persistence (`ReviewStore` in `@gll/db`) Specification

**Date**: 20260708T012724Z
**Status**: Draft
**Epic**: [EP36 - SRS Review Phase](../../plans/epics/EP36-srs-review-phase.md)

**Depends on**: [DS01](20260708T011607Z-EP36-DS01-review-scheduler-package.md) (`ReviewCard` type)
**Architecture**: [Review Phase Packaging ADR](../../../product-documentation/architecture/20260708T005635Z-engineering-srs-review-phase-packaging.md) (D2)

---

## 1. Feature Overview

This DS covers **Phase 2 (EP36-PH02)**: persistence for review cards, added to the existing
`@gll/db` package alongside `LearningStore` / `SqliteLearningStore`. It provides a `ReviewStore`
interface and a `SqliteReviewStore` implementation, following the established store pattern
(async, `userId`-scoped, `better-sqlite3` via drizzle).

**Two facts from the current codebase reshape this DS:**

1. **The table already exists.** [`schema.ts`](../../../packages/db/src/schema.ts) defines
   `review_cards` and migration `0001_initial_schema.sql` already creates it. No new table or
   migration is needed — only a store to read/write it (today nothing references it).
2. **The schema resolves OQ6.** The PK is `(user_id, word_id)` — cards are **per-user and global
   across decks** (one card per word per user, *not* per `(word, deck)`). Deck-scoped review is a
   read-time filter (JOIN `deck_words`), not a separate card.

```typescript
// existing — packages/db/src/schema.ts
export const review_cards = sqliteTable('review_cards', {
  user_id: text('user_id').notNull(),
  word_id: text('word_id').notNull(),
  due: text('due').notNull(),              // ISO 8601
  scheduler_data: text('scheduler_data').notNull(), // JSON blob, opaque
}, (t) => [primaryKey({ columns: [t.user_id, t.word_id] })]);
```

---

## 2. Core Requirements

| Requirement | Decision | Rationale |
| --- | --- | --- |
| Table / migration | **Reuse existing** `review_cards` + `0001_initial_schema.sql` | Already present; do not re-create |
| Scoping | `userId`-scoped methods | Consistent with `LearningStore`; multi-user schema (PK `user_id, word_id`) |
| Card identity | One `ReviewCard` per `(userId, wordId)` — global across decks | Matches PK; **resolves OQ6** (global, not per-deck) |
| `ReviewCard` type source | Import from `@gll/srs-review` | `db` is the mapping layer; already imports engine + shelving types (RULES.md §"no cross-package imports" binds pure domain pkgs, not `db`) |
| Date handling | Persist `due` as ISO string; **rehydrate to `Date` on read** | Closes the seam flagged in DS01 §A.2 — `ReviewCard.due` is always a `Date` in memory |
| `scheduler_data` | `JSON.stringify` on write, `JSON.parse` on read; never inspected | Opaque blob (ADR D2); scheduler owns it |
| Due filtering | `due <= now` via lexical string compare on ISO 8601 | ISO 8601 UTC sorts chronologically as text — no date parsing in SQL |
| Deck-scoped due | JOIN `deck_words` on `word_id` filtered by `deck_id` | Deck view is a filter over the user's global cards |
| Dependency | Add `@gll/srs-review: workspace:*` to `@gll/db` | For the `ReviewCard` type |
| Testing | Pragmatic + round-trip; follow `SqliteLearningStore` test style | RULES.md §Testing |

---

## 3. Data Structures

`ReviewStore` (new file `packages/db/src/review-store.ts`):

```typescript
import type { ReviewCard } from '@gll/srs-review';

export interface ReviewStore {
  /** Insert or replace a user's review card for a word. */
  upsertReviewCard(userId: string, card: ReviewCard): Promise<void>;

  /** The user's card for one word, or null if the word hasn't graduated. */
  getReviewCard(userId: string, wordId: string): Promise<ReviewCard | null>;

  /** All the user's cards with due <= now, ordered by due ascending (most overdue first). */
  getDueReviewCards(userId: string, now: Date): Promise<ReviewCard[]>;

  /** As getDueReviewCards, restricted to words belonging to deckId (JOIN deck_words). */
  getDueReviewCardsForDeck(userId: string, deckId: string, now: Date): Promise<ReviewCard[]>;

  /** All the user's review cards (any due date). */
  getAllReviewCards(userId: string): Promise<ReviewCard[]>;
}
```

**Row ↔ domain mapping** (in `SqliteReviewStore`):

```typescript
// read  (row → ReviewCard)
{ wordId: row.word_id, due: new Date(row.due), schedulerData: JSON.parse(row.scheduler_data) }

// write (ReviewCard → row)
{ user_id: userId, word_id: card.wordId,
  due: card.due.toISOString(), scheduler_data: JSON.stringify(card.schedulerData) }
```

`getReviewCard` returns `null` (not `undefined`) when absent, matching the interface. Absence
means "not yet graduated" — the runner treats it as no review scheduled.

---

## 4. User Workflows

```
Seed / reschedule (runner, DS03)
  ReviewCard (due: Date) ──▶ upsertReviewCard(userId, card)
                              due.toISOString(), JSON.stringify(schedulerData) → review_cards

Review session load (runner, DS03)
  getDueReviewCards(userId, now)         → WHERE user_id=? AND due<=isoNow  ORDER BY due ASC
  getDueReviewCardsForDeck(userId, d, n) → …JOIN deck_words ON word_id WHERE deck_id=?
       each row → { wordId, due: new Date(due), schedulerData: JSON.parse(...) }
```

---

## 5. Stories

### Phase 2: Review Persistence (EP36-PH02)

### EP36-ST04: Verify schema + wire `@gll/srs-review` dependency

**Scope**: Confirmation + dependency wiring — **no new table/migration** (already exists).
**Read List**:
- `packages/db/src/schema.ts` (`review_cards` — confirm shape)
- `packages/db/drizzle/migrations/0001_initial_schema.sql` (confirm `review_cards` created)
- `packages/db/package.json`

**Tasks**:
- [ ] Confirm `review_cards` in `schema.ts` matches §1 and is created by `0001_initial_schema.sql`
- [ ] Add `@gll/srs-review: "workspace:*"` to `@gll/db` dependencies; `pnpm install`
- [ ] No migration change unless a drift is found (if so, generate a follow-up migration, never edit `0001`)

**Acceptance Criteria**:
- [ ] `review_cards` exists with PK `(user_id, word_id)` and columns `due`, `scheduler_data`
- [ ] `@gll/srs-review` resolves as a `@gll/db` dependency
- [ ] `pnpm --filter @gll/db typecheck` passes

> **Note for EP36**: this collapses epic story EP36-ST04 ("add the `review_cards` table + migration")
> to a verify-and-wire task, since the table and migration already ship.

### EP36-ST05: `ReviewStore` interface + `SqliteReviewStore`

**Scope**: New store interface + SQLite implementation. Mirrors `SqliteLearningStore`.
**Read List**:
- `packages/db/src/learning-store.ts` (interface style)
- `packages/db/src/sqlite-learning-store.ts` (drizzle patterns: `eq`, `and`, `lte`, `inArray`, `onConflictDoUpdate`, `DbClient`)
- `packages/db/src/index.ts` (barrel exports)
- `packages/srs-review/src/types.ts` (`ReviewCard` — from DS01)
- DS01 §A.2 (date rehydration seam)

**Tasks**:
- [ ] Create `src/review-store.ts` with the `ReviewStore` interface (§3)
- [ ] Create `src/sqlite-review-store.ts` — `SqliteReviewStore implements ReviewStore`, constructor takes the shared `DbClient`
- [ ] `upsertReviewCard` via `insert().onConflictDoUpdate` on `(user_id, word_id)`, writing `due.toISOString()` + `JSON.stringify(schedulerData)`
- [ ] `getReviewCard` / `getAllReviewCards` — map rows, rehydrate `due` to `Date`, `JSON.parse` scheduler_data
- [ ] `getDueReviewCards` — `where(and(eq(user_id), lte(due, now.toISOString())))`, `orderBy(asc(due))`
- [ ] `getDueReviewCardsForDeck` — inner join `deck_words` on `word_id`, filter `deck_id`, same due/order
- [ ] Export `ReviewStore` (type) and `SqliteReviewStore` from `src/index.ts`
- [ ] Unit tests (mirror `sqlite-learning-store.test.ts`): upsert-then-get round-trip; `due` returns as a `Date`; overwrite on second upsert; due filter excludes future cards and includes `due == now`; deck filter returns only in-deck words; empty results are `[]` / `null`

**Acceptance Criteria**:
- [ ] Round-trip: `upsertReviewCard` then `getReviewCard` returns an equal card with `due` as a `Date` and `schedulerData` structurally intact
- [ ] `getDueReviewCards` excludes `due > now`, includes `due <= now`, ordered by `due` ascending
- [ ] `getDueReviewCardsForDeck` returns only words present in `deck_words` for that deck
- [ ] `scheduler_data` is round-tripped byte-for-byte via JSON; never structurally inspected in store code
- [ ] `getReviewCard` returns `null` for an unknown `(userId, wordId)`
- [ ] `pnpm --filter @gll/db test` and `typecheck` pass

---

## 6. Success Criteria

1. A `ReviewCard` produced by `FsrsScheduler` (DS01) can be persisted and read back with `due` as a
   `Date` and `schedulerData` usable directly by `FsrsScheduler.schedule` (no manual parsing).
2. Due queries (global and deck-scoped) return correct, correctly-ordered sets.
3. `SqliteReviewStore` reuses the existing table/migration — no schema drift introduced.
4. Store code never inspects `scheduler_data` beyond JSON (de)serialisation.
5. No type errors; `@gll/db` suite green.

---

## 7. Out of Scope (this DS)

- The scheduler itself (`ReviewScheduler` / `FsrsScheduler`) → DS01
- Runner, rating inference, `GraduationHook` wiring, mock seeder → DS03
- Remote D1 store implementation (schema is already D1-compatible)
- A `clearUserReviewCards` method — add only if a reset flow needs it (defer to DS03 if required)
