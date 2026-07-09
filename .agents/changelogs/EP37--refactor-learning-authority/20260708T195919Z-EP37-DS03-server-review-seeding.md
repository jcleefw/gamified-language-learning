# EP37-DS03: Server-side Review Seeding on Graduation (Phase 3) Specification

**Date**: 20260708T195919Z
**Status**: Accepted
**Epic**: [EP37 - Refactor: Learning Authority](../../plans/epics/EP37-refactor-learning-authority.md)

**Architecture**:
[`srs-demo` Learning Authority, Review Authority & Debug-Trace Contract](../../../product-documentation/architecture/20260708T125551Z-engineering-srs-demo-learning-authority-and-debug-trace.md) — **Pillar 2 (Review authority is server-side, seeded on the transition path)**. Consumes the idempotent `seedReviewCard` from [DS02](20260708T171133Z-EP37-DS02-cross-table-integrity.md) and the `/api/answer` handler from [DS01](20260708T141610Z-EP37-DS01-server-learning-transition.md).

---

## 1. Feature Overview

This DS covers **Phase 3 (EP37-PH03)** only: **EP37-ST06 — seed a `ReviewCard` when a word graduates**,
inside the existing `POST /api/answer` handler. After DS01/DS02 the server already (a) runs the pure
Learning transition and knows whether a word `graduated`, and (b) offers an idempotent
`seedReviewCard`. PH03 is the wire between them: on graduation the handler derives a
`GraduationPerformance` from the new `WordState`, calls `FsrsScheduler.seed`, and persists the card via
`seedReviewCard`. **The frontend never imports `ts-fsrs`** — all FSRS work lives behind the API.

**What is already done for us** (so this DS stays small):

- **Rating inference is not new server code.** `FsrsScheduler.seed` already runs the seed-rating heuristic
  internally (`seedRating(performance)` in [FsrsScheduler.ts:64](../../../packages/srs-review/src/FsrsScheduler.ts#L64)).
  The server supplies a `GraduationPerformance`; it does **not** re-implement rating logic. The epic's phrase
  "infer the rating server-side" is satisfied by *running `FsrsScheduler` on the server*, nothing more.
- **Idempotency is already enforced (DS02).** `seedReviewCard` is ignore-if-exists, so seeding is safe to
  call more than once for the same word — re-graduation never resets FSRS progress.
- **The only genuinely new pure logic** is the `WordState → GraduationPerformance` mapping, which already
  exists as [`toGraduationPerformance`](../../../apps/cli-demo-db/src/graduation-performance.ts) in `cli-demo-db`.

**Two decisions this DS locks (see §2 — both flagged for review):**

1. **Seed trigger — level-triggered, self-healing (recommended).** Seed whenever the post-transition state
   `isMastered(after)` is true, calling the idempotent `seedReviewCard`. Because seeding is ignore-if-exists,
   the call is a no-op after the first success — but a **transient seed failure self-heals on the next answer**
   for that word. The alternative, *edge-triggered* seeding (only on the single `graduated` crossing), matches
   the epic's literal wording but makes a one-time seed failure **permanent** (the crossing never recurs, so the
   word stays graduated-with-no-card forever). The response's `graduated` flag stays **edge-triggered** (a client
   signal — "crossed on this answer"); only the *seed action* is level-triggered. This cleanly separates a
   client event from a server integrity action and is exactly what DS02's idempotency was built to enable.
2. **Seed failure is fail-open, logged.** Mirrors DS01's `answer_events` fail-open: the authoritative
   `WordState` write must not be lost to a Review-seeding failure. On a `seedReviewCard` throw the handler logs
   `error` and still returns `200` with the authoritative state + `graduated`. With decision 1 the missing card
   self-heals next answer; a fully transactional state+seed write is the stronger fix and is noted as deferred
   (ties to the concurrency limitation raised in the DS01/DS02 review).

**Not in this DS**: the client cutover / shadow harness / golden-master (PH04); Review UI/flow (separate
review-mode epic); orphaned-card or graduated-without-card cleanup (deferred). `POST /api/state/word` stays
untouched.

**Parity note.** The `WordState → GraduationPerformance` mapping is **duplicated** into `@gll/server` rather
than shared, matching the DS01 precedent for `LEARNING_CONFIG` (server owns its copy; parity is enforced by
the PH04 golden-master test, not a shared constant). See §2 — this is the one place a shared helper was
consciously declined.

---

## 2. Core Requirements

| Requirement | Decision | Rationale |
| --- | --- | --- |
| Seed location | Inside the existing `POST /api/answer` handler, after the `WordState` upsert | Same request as graduation detection (ADR pillar 2: "seeds in the same request") |
| Seed trigger | **Level-triggered**: `if (isMastered(after, masteryThreshold)) seedReviewCard(...)` | Idempotent seed → no-op after first success, but self-heals a transient failure; edge-triggered would make a seed failure permanent |
| Response `graduated` | Unchanged from DS01 — **edge-triggered** (`!wasMastered && isMastered(after)`) | Client-facing signal ("crossed this answer") is distinct from the server's level-triggered seed action |
| Rating inference | Reuse `FsrsScheduler.seed` (runs `seedRating` internally); server passes only `GraduationPerformance` | No rating re-implementation; `ts-fsrs` stays behind the `@gll/srs-review` port |
| `GraduationPerformance` mapping | Add `toGraduationPerformance(ws)` to `@gll/server` (copy of the `cli-demo-db` 4-liner); **not** shared | Behavioural glue with no clean library home (`srs-review` never imports `WordState` by design; `srs-engine-v2` must not import Review types). Parity enforced by test, per the `LEARNING_CONFIG` precedent |
| Persistence | `SqliteReviewStore.seedReviewCard(USER_ID, card)` (from DS02) | Idempotent ignore-if-exists; one-way graduation |
| Scheduler/store construction | `new FsrsScheduler()` + `new SqliteReviewStore(getDb())` per request, like the handler's other stores | Matches existing handler pattern; no injection framework introduced |
| Single `now` | Introduce `const now = new Date()` at handler top; reuse for `answer_events.createdAt` **and** `scheduler.seed(..., now)` | One timestamp per request; also tidies DS01's inline `new Date().toISOString()` |
| Seed-failure semantics | **Fail-open**: on `seedReviewCard` throw, `log.error` and still return `200` + authoritative state | Learning write must not be lost to a Review-seed failure (DS01 fail-open precedent); self-heals next answer |
| `ts-fsrs` boundary | Server may import `@gll/srs-review` (which imports `ts-fsrs`); the **frontend bundle** must not | ADR: "frontend never imports `ts-fsrs`". Guard: `srs-demo` has zero `ts-fsrs` imports (already true) |
| Contract impact | **None** — no `@gll/api-contract` change; `AnswerResponse` already carries `graduated` | Review card is server state; the client only needs the `graduated` signal it already gets |

## 3. Data Structures

No schema change, no contract change. New server-local pure helper only:

```typescript
// apps/server/src/review/graduation-performance.ts  (copy of the cli-demo-db mapping)
import type { WordState } from '@gll/srs-engine-v2';
import type { GraduationPerformance } from '@gll/srs-review';

/** Learning WordState → Review seed input. Server-owned copy; parity via the PH04 golden-master. */
export function toGraduationPerformance(ws: WordState): GraduationPerformance {
  return {
    correctStreak: ws.correctStreak,
    lapses: ws.lapses,
    correctRatio: ws.seen > 0 ? ws.correct / ws.seen : 0,
  };
}
```

Handler seeding block (added to [answer.ts](../../../apps/server/src/routes/answer.ts) after the `WordState` upsert):

```typescript
// after: await store.upsertWordState(USER_ID, after);
if (isMastered(after, LEARNING_CONFIG.masteryThreshold)) {
  try {
    const scheduler = new FsrsScheduler();
    const card = scheduler.seed(after.wordId, toGraduationPerformance(after), now);
    await new SqliteReviewStore(getDb()).seedReviewCard(USER_ID, card); // idempotent (DS02)
  } catch (err) {
    log.error('review-card seed failed', {
      correlationId: correlationId ?? undefined,
      wordId: after.wordId,
      err: err instanceof Error ? err.message : String(err),
    });
    // fail-open: authoritative WordState stands; self-heals on next mastered answer.
  }
}
```

## 4. User Workflows

```
POST /api/answer  (DS01 handler, now with seeding)
  → const now = new Date()
  → validate → before = getAllWordStates(demo-user).get(wordId)
  → after = updateRunState(...).get(wordId); upsertWordState(after)
  → graduated = !isMastered(before,T) && isMastered(after,T)      // edge — response flag
  → appendAnswerEvent({... createdAt: now.toISOString() })        // DS01, fail-open
  → if isMastered(after,T):                                       // level — seed action
       card = FsrsScheduler().seed(wordId, toGraduationPerformance(after), now)
       seedReviewCard(demo-user, card)                            // idempotent (DS02)
         └─ throws? log.error, continue (fail-open; self-heals next mastered answer)
  → 200 { wordState: toPayload(after), graduated }
```

## 5. Stories

### Phase 3: Server-side Review seeding (EP37-PH03)

### EP37-ST06: Seed a `ReviewCard` on graduation (`@gll/server`)

**Scope**: One helper + a seeding block in the existing handler. No contract, no schema, no client, no route added. `POST /api/state/word` untouched.
**Read List**: `apps/server/src/routes/answer.ts`, `apps/server/src/config/learning.ts`, `packages/srs-review/src/FsrsScheduler.ts`, `packages/srs-review/src/types.ts`, `apps/cli-demo-db/src/graduation-performance.ts`, `packages/db/src/sqlite-review-store.ts` (`seedReviewCard` from DS02)
**Tasks**:

- [ ] Add `apps/server/src/review/graduation-performance.ts` (`toGraduationPerformance`, copy of the cli mapping)
- [ ] In `answer.ts`: hoist `const now = new Date()`; reuse it for `answer_events.createdAt` and seeding
- [ ] After the `WordState` upsert, when `isMastered(after, masteryThreshold)`: `FsrsScheduler().seed(...)` → `SqliteReviewStore(getDb()).seedReviewCard(USER_ID, card)`
- [ ] Wrap seeding in try/catch: on throw, `log.error` and continue (fail-open); never import `ts-fsrs` in the frontend

**Acceptance Criteria**:

- [ ] A fresh word answered correct until it crosses `masteryThreshold` results in **exactly one** `review_cards` row for `(demo-user, wordId)`, with `due`/`schedulerData` produced by `FsrsScheduler` (not hand-rolled)
- [ ] The seeded card's rating reflects `FsrsScheduler`'s heuristic on the graduation-moment `GraduationPerformance` (e.g. zero-lapse strong streak seeds a longer interval than a lapsed word) — asserted via the store, not by re-deriving the rating in the test
- [ ] **Idempotent**: continuing to answer the (already-graduated) word correct does **not** add a second row or reset the existing card's `due`/`schedulerData` (DS02 guarantee, verified end-to-end through the route)
- [ ] **Self-heal**: if the first seed attempt throws (simulated store failure), the next mastered answer seeds the card; the response is `200` with authoritative state both times and the `WordState` write is intact
- [ ] `graduated` in the response is still edge-triggered (true only on the crossing answer), independent of the level-triggered seed
- [ ] The `srs-demo` frontend bundle imports no `ts-fsrs` (grep guard stays clean); `@gll/server` typechecks and its tests pass

## 6. Success Criteria

1. Graduating a word via `POST /api/answer` seeds exactly one `ReviewCard` through `FsrsScheduler` + `seedReviewCard`, in the same request, with no contract or schema change.
2. Rating inference is `FsrsScheduler`'s existing heuristic — no rating logic is re-implemented in the server; the only new server code is the `GraduationPerformance` mapping.
3. Re-graduation/continued-correct answers never add a duplicate card or reset FSRS progress (DS02 idempotency proven through the route).
4. A seed failure is logged and fails open (authoritative `WordState` preserved) and self-heals on the next mastered answer.
5. `ts-fsrs` is imported only behind the `@gll/srs-review` port and in the server that depends on it — never in the frontend bundle.
6. No type errors; `POST /api/state/word` behaviour unchanged.
