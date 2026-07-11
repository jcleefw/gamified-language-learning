# EP40-BUG01: Replay harness reports null-correlation transition rows as state divergences (not "unreplayable")

**Date**: 20260710T155306Z
**Status**: Open
**Epic**: [EP40 — Debug-Trace Observability](../../plans/epics/EP40-debug-trace-observability.md)
**Design Spec**: [EP40-DS02 — Client Channels, Export & Replay](20260710T125911Z-EP40-DS02-client-channels-and-replay.md) (ST06)
**Type**: Bug Fix
**Severity**: Low — diagnostic-only surface; no effect on the authoritative Learning/Revision state or on any learner flow.

---

## 1. Problem Statement

The ST06 replay harness marks a **fail-open, null-correlation** Revision transition row as
`matched: false` — indistinguishable in the emitted fixture from a genuine state divergence (an
actual scheduling bug). A reviewer reading `allMatched: false` on a captured session can chase a
"regression" that is really just an anonymous row the harness *cannot* replay.

Surfaced during runtime verification of DS02, driving the real `POST /api/reviews/answer` socket
against an isolated server + throwaway DB.

### Reproduction

```bash
# 1. Seed a DUE review card.
curl -s -X POST $B/api/test/seed -H 'Content-Type: application/json' -d '{
  "name":"v","description":"v","deckId":"d1","wordStates":[],"stagnationCounters":[],
  "shelvedWords":[],"reviewCards":[{"wordId":"w-nocorr","dueOffsetMs":-86400000}]}'

# 2. Answer it WITHOUT an x-correlation-id header (the graceful-degrade path, DS01 core requirement).
curl -s -X POST $B/api/reviews/answer -H 'Content-Type: application/json' \
  -d '{"wordId":"w-nocorr","correct":false,"latencyMs":900,"questionType":"mcq"}'
# → 200 {"advanced":true}; a review_transition_events row IS written with correlation_id = NULL.

# 3. Run the replay harness over the rows the server just wrote.
# → REVISION replay: { count: 2, allMatched: false,
#     perRow: [ { corr: "verify-corr-DUE", matched: true },
#               { corr: null,              matched: false } ] }   ← the null row "fails"
```

The null-correlation row **did** persist correctly (graceful degrade works) and the card **did**
advance correctly — yet replay flags it as a mismatch.

---

## 2. Root Cause

Two contracts locked in DS01 collide at the replay join.

**(a) Missing correlation id degrades gracefully — the transition row still persists, keyed NULL.**
This is the DS01 core requirement and the ADR's fail-open invariant: diagnostics must never gate the
authoritative advance.

**(b) The transition log records only before/after cards, not the FSRS rating (OQ1).**
`review_transition_events` is a *pure* transition log, deliberately separated from the
`review_answer_events` answer log. The rating needed to replay lives only in the answer log, and the
harness recovers it by joining the two tables **on `correlation_id`**:

[`apps/server/src/tooling/replay-transitions.ts:149`](../../../apps/server/src/tooling/replay-transitions.ts#L149)
```typescript
const ratingByCorrelation = new Map<string, ReviewRating>();
for (const a of db.select().from(schema.review_answer_events).all()) {
  if (a.correlation_id !== null && a.rating !== null) {
    ratingByCorrelation.set(a.correlation_id, a.rating as ReviewRating);
  }
}
// …
rating:
  r.correlation_id !== null
    ? ratingByCorrelation.get(r.correlation_id) ?? null   // NULL key ⇒ no rating
    : null,
```

A `NULL` correlation id is not a valid map key, so the join yields **no rating**. `replayRevisionRows`
then hits its "cannot replay without the rating" branch and returns `matched: false`:

[`apps/server/src/tooling/replay-transitions.ts:119`](../../../apps/server/src/tooling/replay-transitions.ts#L119)
```typescript
// Cannot replay without the rating (lives in the answer log) — report, don't crash.
if (row.rating === null) {
  return { correlationId: row.correlationId, wordId: row.wordId,
           matched: false, recomputed: null, recorded: row.afterCard };
}
```

**The conflation:** `matched: false` is overloaded. It means both "recomputed after-state ≠ recorded
after-state" (a real bug — the signal the harness exists to catch) *and* "this row has no join key, so
it can't be replayed at all" (an expected consequence of an anonymous fail-open write). The fixture's
`allMatched` / `firstDivergence` therefore can't tell a scheduling regression apart from a header-less
answer.

This only affects **Revision** replay (Learning's `answer_events` is a *combined* answer+transition
log — the inputs and after-state live in one row, so no correlation join is needed and a null
correlation id replays fine). It's the OQ1 "separate logs" decision meeting the DS01 graceful-degrade
contract.

---

## 3. Impact

- **No runtime/state impact.** The authoritative card advance and both durable rows are correct; this
  is purely how the offline diagnostic tool *labels* a row.
- **Diagnostic false-positive.** A captured session containing any header-less Revision answer reports
  `allMatched: false` with the anonymous row as (or before) the `firstDivergence`, sending a
  reviewer after a non-bug.
- Grows with any real-world source of null correlation ids: an older client, a replay of a request
  that dropped the header, or the graceful-degrade path exercised deliberately.

---

## 4. Proposed Fix

Distinguish "unreplayable" from "divergent" so a missing join key is never counted as a mismatch.
Options, smallest first:

1. **Add an `unreplayable` outcome to `ReplayResult`** (e.g. `matched: boolean | 'unreplayable'`, or a
   separate `status: 'matched' | 'diverged' | 'unreplayable'`). `buildFixture` counts only `diverged`
   toward `allMatched`/`firstDivergence`; `unreplayable` rows are surfaced in a separate list with a
   reason (`"no correlation id — cannot join rating"`). Keeps the OQ1 schema untouched.
2. **Join transition ↔ answer on a shared surrogate key** instead of the nullable `correlation_id`
   (e.g. persist the `review_answer_events.id` on the transition row, or vice-versa). Makes replay
   survive a missing header entirely — but adds a column and a write-ordering dependency between the
   two fail-open appends, so weigh against OQ1's clean-separation rationale.

Recommend **Option 1**: it fixes the misreport at the harness (the actual defect) without disturbing
the DS01/OQ1 schema decision, and it makes the "anonymous rows aren't replayable" limitation explicit
in the fixture rather than hidden inside a false failure.

Either way, add a regression test to
[`apps/server/src/__tests__/replay-transitions.test.ts`](../../../apps/server/src/__tests__/replay-transitions.test.ts):
a due Revision answer written with `correlation_id = NULL` must **not** count as a divergence
(`allMatched` stays `true`; the row is reported as unreplayable).

---

## 5. Notes

- Raised rather than silently patched because the cleanest structural fix (Option 2) touches the OQ1
  rationale in DS01 — the DS author should choose whether replay parity is worth coupling the two
  logs, or whether the "anonymous rows are unreplayable" limitation is acceptable and just needs
  honest reporting (Option 1).
- Verification evidence: the correlated row replayed `matched: true`; only the `correlation_id = NULL`
  row misreported. The graceful-degrade write itself is correct (row persisted, card advanced).
