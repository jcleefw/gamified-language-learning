# EP37-DS02: Cross-table Integrity in `@gll/db` (Phase 2) Specification

**Date**: 20260708T171133Z
**Status**: Accepted
**Epic**: [EP37 - Refactor: Learning Authority](../../plans/epics/EP37-refactor-learning-authority.md)

**Architecture**:
[`srs-demo` Learning Authority, Review Authority & Debug-Trace Contract](../../../product-documentation/architecture/20260708T125551Z-engineering-srs-demo-learning-authority-and-debug-trace.md) — **Pillar 3 (Cross-table integrity lives in the store layer)**.

---

## 1. Feature Overview

This DS covers **Phase 2 (EP37-PH02)** only: the three cross-table invariants of ADR pillar 3,
enforced in the **store layer (`@gll/db`)** so every consumer inherits them — including `cli-demo-db`,
which is intentionally full-local-authority and gets these rules **for free** (no server involved). No
Hono route, no server, no client work is in this DS.

There are **no foreign keys** and no `PRAGMA foreign_keys` (per the schema ADR); `words`,
`user_word_states`, and `review_cards` are independent tables keyed by string ids. Integrity is
therefore a **store-layer contract**, not a DB constraint. This DS lands three guarantees:

1. **Re-graduation is idempotent (ST04).** Seeding a review card for a word that *already* has one must
   **not** reset its FSRS progress. Today the only writer is `SqliteReviewStore.upsertReviewCard`, which
   `onConflictDoUpdate` (overwrites). We do **not** change that method — the Review *runner* legitimately
   uses it to advance a card after a review ([review-runner-db.ts:62](../../../apps/cli-demo-db/src/review-runner-db.ts#L62)).
   Instead we add a distinct **`seedReviewCard`** with **ignore-if-exists** semantics and point the
   graduation-seeding paths at it. Seeding and reviewing become two clearly different operations.
2. **Readers tolerate orphans (ST05a).** A `review_cards` row whose `word` was deleted must never crash a
   reader; `getDueReviewCards` stays **join-free** (a card for a deleted word can remain "due" forever —
   cleanup is a deferred, out-of-scope story), and `getDueReviewCardsForDeck` naturally **skips** a word
   dropped from `deck_words`. Locked by regression tests.
3. **Graduation is one-way / terminal for Learning (ST05b).** A word must not be simultaneously
   *active in Learning* and *in Review*. The store makes graduation a **single, terminal, idempotent
   transition** (the `seedReviewCard` of ST04 is that single door); once a card exists, re-graduation
   cannot reset it. Split-brain from an **out-of-band** Learning-table reset is a **corruption case, not
   a supported state** — so we assert the property with a test and a documented store contract, and do
   **not** add a speculative runtime split-brain guard (RULES §4).

**Why a new method rather than flipping the existing one.** `upsert` = "insert or replace" is the correct
semantic for *advancing* a card after a review. `seed` = "insert only if absent" is the correct semantic
for *graduation*. Overloading one method with a flag would blur the two callers; two named methods make
the store contract self-documenting and keep the idempotency guarantee un-bypassable from the seed path.

**Not in this DS**: the `graduated`-event seeding wiring inside `/api/answer` (that is **PH03/ST06**,
which will *call* `seedReviewCard`); server rating inference; orphaned-card cleanup; Review→Learning
re-entry. This DS only makes the store *offer and enforce* the integrity contract PH03 consumes.

---

## 2. Core Requirements

| Requirement | Decision | Rationale |
| --- | --- | --- |
| Idempotent seed | Add `ReviewStore.seedReviewCard(userId, card): Promise<boolean>`; `SqliteReviewStore` implements it with `onConflictDoNothing`, returning `true` if a row was inserted, `false` if one already existed | The ADR's "ignore-if-exists"; boolean lets callers know whether *this* graduation actually created the card |
| Keep `upsertReviewCard` | `upsertReviewCard` is **unchanged** (still `onConflictDoUpdate`) | The Review runner legitimately overwrites `scheduler_data`/`due` to advance a card; that is not graduation |
| Seed-path cutover | Repoint graduation seeding to `seedReviewCard`: [seed-graduated-review-cards.ts:23](../../../apps/cli-demo-db/src/seed-graduated-review-cards.ts#L23). Leave the review-*advance* `upsertReviewCard` call and the dev-only `seed-mock-reviews.ts` helper on `upsert` | `seed-graduated-review-cards` is the real graduation path (must be idempotent); the mock helper deliberately forces `due: now` on every run and is a test fixture, not graduation |
| Return-value use | Callers may ignore the boolean today; PH03/ST06 will use it to decide whether to log a "seeded" vs "already-graduated" event | No speculative wiring now; the signal exists when PH03 needs it |
| Orphan tolerance — global | `getDueReviewCards` stays **join-free**: it returns cards whose `word` no longer exists, without error | ADR: "a card for a deleted word can stay 'due' forever"; cleanup is deferred |
| Orphan tolerance — deck | `getDueReviewCardsForDeck` keeps its `deck_words` filter: a word removed from the deck is silently **excluded** (skipped), never a crash | The existing `inArray(deck_words)` gate already yields skip-not-crash; lock it with a test |
| No `words` join added | Neither reader gains a join against `words` to "validate" the card | Adding a join would *filter out* orphans (changing due-set semantics) and couple review reads to content; tolerance ≠ deletion |
| One-way invariant — enforcement | Enforced structurally: `seedReviewCard` is the single, idempotent door into Review. **No** runtime split-brain guard is added | Split-brain requires an unsupported out-of-band Learning reset; a guard would be speculative plumbing for a corruption state (RULES §4) |
| One-way invariant — verification | A store test proves: graduate → review-advance (`upsert`) → re-graduate (`seedReviewCard`) leaves the **advanced** `schedulerData`/`due` intact (FSRS progress not reset) | This is the *observable* one-way guarantee: graduation never rewinds Review |
| Interface docs | Update `ReviewStore` JSDoc so `upsertReviewCard` reads "advance/replace" and `seedReviewCard` reads "graduation seed; ignore-if-exists" | The contract is the enforcement surface `cli-demo-db` inherits |
| Test-only, no server | All acceptance is via **direct-to-store** tests (in-memory sqlite), no Hono, no app | ADR: integrity is verified "by a direct-to-store test, no server" |

## 3. Data Structures

No schema change. `review_cards` keeps its `(user_id, word_id)` primary key — that PK is exactly what
makes `onConflictDoNothing` an ignore-if-exists. Interface delta only:

```typescript
// packages/db/src/review-store.ts
export interface ReviewStore {
  /**
   * Graduation seed — insert a review card ONLY if the word has no card yet.
   * Ignore-if-exists: re-graduating an already-reviewed word must NOT reset its
   * FSRS progress. Returns true if this call inserted the card, false if one existed.
   */
  seedReviewCard(userId: string, card: ReviewCard): Promise<boolean>;

  /** Advance/replace a user's review card after a review (overwrites due + schedulerData). */
  upsertReviewCard(userId: string, card: ReviewCard): Promise<void>;

  getReviewCard(userId: string, wordId: string): Promise<ReviewCard | null>;
  getDueReviewCards(userId: string, now: Date): Promise<ReviewCard[]>;            // join-free; tolerates orphans
  getDueReviewCardsForDeck(userId: string, deckId: string, now: Date): Promise<ReviewCard[]>; // deck_words filter skips removed words
  getAllReviewCards(userId: string): Promise<ReviewCard[]>;
}
```

```typescript
// packages/db/src/sqlite-review-store.ts — new method
async seedReviewCard(userId: string, card: ReviewCard): Promise<boolean> {
  const res = this.db
    .insert(schema.review_cards)
    .values({
      user_id: userId,
      word_id: card.wordId,
      due: card.due.toISOString(),
      scheduler_data: JSON.stringify(card.schedulerData),
    })
    .onConflictDoNothing({
      target: [schema.review_cards.user_id, schema.review_cards.word_id],
    })
    .run();
  return res.changes > 0; // better-sqlite3 RunResult.changes: 1 = inserted, 0 = ignored
}
```

**Invariant vocabulary (for docs + tests):**

- *Orphan card* — a `review_cards` row whose `word_id` has no `words` row.
- *One-way / terminal* — for a `(userId, wordId)`, at most one transition Learning→Review ever occurs;
  `seedReviewCard` is idempotent, so replaying graduation is a no-op that preserves review progress.

## 4. User Workflows

```
Graduation seeding (called by PH03/ST06 and cli seed script)
  seedReviewCard(user, card)
    → INSERT ... ON CONFLICT (user_id, word_id) DO NOTHING
    → changes == 1 ? return true  (first graduation — card created)
                   : return false (already graduated — FSRS progress untouched)

Review advance (called by the review runner — unchanged)
  upsertReviewCard(user, advancedCard)  → overwrite due + scheduler_data

Reading due cards with a deleted word
  getDueReviewCards(user, now)
    → SELECT from review_cards WHERE due <= now         (NO join to words)
    → orphaned card is returned, mapped, no crash
  getDueReviewCardsForDeck(user, deck, now)
    → filtered by inArray(deck_words.word_id)
    → word dropped from deck_words → excluded (skipped), no crash
```

## 5. Stories

### Phase 2: Cross-table integrity in `@gll/db` (EP37-PH02)

### EP37-ST04: Idempotent re-graduation (`seedReviewCard`, ignore-if-exists)

**Scope**: `@gll/db` store + interface + graduation-seed callers. No route, no server.
**Read List**: `packages/db/src/review-store.ts`, `packages/db/src/sqlite-review-store.ts`, `packages/db/src/__tests__/sqlite-review-store.test.ts`, `apps/cli-demo-db/src/seed-graduated-review-cards.ts`, `apps/cli-demo-db/src/seed-mock-reviews.ts`
**Tasks**:

- [ ] Add `seedReviewCard(userId, card): Promise<boolean>` to `ReviewStore`; document `upsertReviewCard` as "advance/replace" and `seedReviewCard` as "graduation seed; ignore-if-exists"
- [ ] Implement `seedReviewCard` in `SqliteReviewStore` with `onConflictDoNothing`, returning `res.changes > 0`
- [ ] Repoint `seed-graduated-review-cards.ts` from `upsertReviewCard` to `seedReviewCard`; leave the review-advance `upsertReviewCard` call and `seed-mock-reviews.ts` on `upsert`

**Acceptance Criteria**:

- [ ] First `seedReviewCard(u, w)` returns `true` and creates exactly one row
- [ ] Second `seedReviewCard(u, w)` with a **different** `due`/`schedulerData` returns `false` and leaves the **original** row byte-identical (FSRS progress not reset)
- [ ] `upsertReviewCard` still overwrites (existing "second upsert overwrites" test stays green)
- [ ] `cli-demo-db` graduation seeding is idempotent across reruns (no card reset); package builds and existing cli tests pass

### EP37-ST05: Orphan tolerance + one-way graduation invariant

**Scope**: Regression tests + contract docs proving the two read/terminal invariants. Minimal-to-no production code (readers already join-free); **no** `words` join, **no** runtime split-brain guard.
**Read List**: `packages/db/src/sqlite-review-store.ts`, `packages/db/src/schema.ts`, `packages/db/src/__tests__/sqlite-review-store.test.ts`
**Tasks**:

- [ ] Add a test: seed a card for a `word_id` with **no** `words` row → `getDueReviewCards` returns it without throwing (orphan tolerated, still "due")
- [ ] Add a test: word present in `review_cards` but absent from `deck_words` → `getDueReviewCardsForDeck` **excludes** it without throwing (orphan skipped)
- [ ] Add a test (one-way): `seedReviewCard` → `upsertReviewCard` (advance) → `seedReviewCard` again ⇒ the advanced `due`/`schedulerData` survive (re-graduation cannot rewind Review)
- [ ] Confirm no `words` join is introduced in either due-reader; document in `ReviewStore` JSDoc that readers are orphan-tolerant and graduation is one-way/terminal

**Acceptance Criteria**:

- [ ] `getDueReviewCards` returns an orphaned card (deleted word) without error
- [ ] `getDueReviewCardsForDeck` silently skips a word removed from `deck_words`, no error
- [ ] Re-graduation after a review advance does not reset FSRS progress (one-way proven observationally)
- [ ] No reader gains a `words` join; `@gll/db` typechecks and the full store test suite passes

## 6. Success Criteria

1. `SqliteReviewStore` exposes both `seedReviewCard` (ignore-if-exists) and `upsertReviewCard` (replace); the graduation-seed path uses `seedReviewCard`.
2. Re-graduating an already-reviewed word never resets its FSRS `schedulerData`/`due` (idempotent), verified by a direct-to-store test — so `cli-demo-db` inherits the guarantee with no server.
3. `getDueReviewCards` tolerates orphaned cards (deleted word) without error; `getDueReviewCardsForDeck` skips words removed from `deck_words` without error; neither adds a `words` join.
4. Graduation is one-way/terminal: proven by a test where a post-review advance survives a subsequent re-graduation; no speculative split-brain guard is added.
5. No schema change, no route/server/client change; `@gll/db` typechecks and the full store suite passes.
