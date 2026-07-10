# EP40 - Debug-Trace Observability for `srs-demo` (Learning + Revision Authority)

**Created**: 20260710T122913Z
**Status**: Accepted

<!-- Status: Draft | Accepted | In Progress | Impl-Complete | BDD Pending | Completed | Shelved | Withdrawn -->

**Type**: Epic Plan
**Depends on**: EP37 (Learning-authority — server transition channel + correlation-id plumbing) · Logger ADR `20260708T143342Z` (complete)
**Parallel with**: EP39 (Review-mode redesign — soft; the client channels are independent of Review UI)
**Predecessor**: N/A

---

## Problem Statement

`srs-demo` Learning and Revision state now transition **server-side** (EP37: `POST /api/answer`;
Review authority: `POST /api/reviews/answer`), but the transitions are only partially observable.
Debugging today relies on a lossy client hack — [`useQuizDebugLog.ts`](../../../apps/srs-demo/src/composables/useQuizDebugLog.ts)
batches snapshots in browser memory and POSTs a JSON blob to a dumb file-sink
([`debug-logs.ts`](../../../apps/server/src/routes/debug-logs.ts)). It captures state at *batch
boundaries*, omits the *inputs* that caused a transition, is non-durable, and the authoritative
write path knows nothing of it.

Pillar 4 of the srs-demo authority ADR (`20260708T125551Z`) ratified a **scoped, correlated
debug-trace contract** to replace it. EP37 delivered the transition channel for Learning as a
byproduct (`answer_events` with `before/after` state + inputs + `correlation_id`) and the Logger ADR
gave us the `correlationId`-carrying foundation. What remains is the contract itself: a single
correlation id stitching a served question → answer request → server transition → orchestration
decision into one ordered, **replayable** timeline — across **both** the Learning and the Revision
authority paths.

Two authority paths, one contract: the trace must be symmetric. Today the Revision transition
channel ([`review_answer_events`](../../../packages/db/src/schema.ts)) records the *answer*
(`correct`, `latency_ms`, `question_type`, `rating`) but **not** the card-state transition
(`before`/`after` `due`/`schedulerData`), so the "this card's state is wrong" scenario is not
replayable on the Revision side the way it is for Learning. And neither answer path emits a
correlation id from the client, so the timeline is broken at its source for both.

## Scope

**In scope**:

- **Client correlation-id generation + propagation** — a per-question id sent as `x-correlation-id`
  on **both** `POST /api/answer` and `POST /api/reviews/answer`, stitching the client timeline to
  the server transition rows that already read the header.
- **Scoped trace sessions** — explicit start/stop control (evolving today's flush model); tracing is
  situational, not always-on.
- **API channel** (boundary) — request/response/**errors** captured at the `fetch` seam. → debug
  scenario (i).
- **Appearance channel** (client) — pool selection, question served, recheck trigger, shelving
  decisions. → debug scenario (ii).
- **Transition channel — Revision parity** — extend the Revision authority record with `before`/
  `after` card-state snapshots so `review_answer_events` is replayable to the same standard as
  `answer_events` (Learning already has this from EP37). → debug scenario (iii), both authorities.
- **Replay harness** — turn a captured transition session (either authority) into a deterministic
  regression fixture that reproduces a state bug against the pure engine.
- **Retire the hack** — remove `useQuizDebugLog.ts` and the `debug-logs.ts` file-sink once the three
  channels cover their scenarios.

**Out of scope**:

- **Logging infrastructure** — delivered by the Logger ADR (`@gll/logger`, `PinoLogger`/`NoopLogger`,
  injected ports); this epic *consumes* it.
- **Full quiz answer-verification** — EP15's server-side question generation / key-withholding stays
  deferred (accepted-risk per the authority ADR); the client still self-reports `correct`.
- **Orphaned-review-card cleanup and Learning/Review split-brain resolution** — tolerated, not solved,
  per the authority ADR.
- **`cli-demo-db` tracing** — the authority ADR governs `srs-demo` only.
- **Remote/prod log transport config** — pino transports are a construction-time concern behind the
  port, not this epic.

---

## Stories

<!-- Phases group stories by sub-domain; stories still belong to the Epic directly. -->

### Phase 1: Correlation & Session Foundation (EP40-PH01)

### EP40-ST01: Client correlation-id generation & propagation across both answer paths

**Scope**: Client — mint a per-question correlation id and send it as `x-correlation-id` on both `POST /api/answer` and `POST /api/reviews/answer`.

### EP40-ST02: Scoped trace session with start/stop control

**Scope**: Client — a situational trace session (start/stop) replacing the always-on flush model; only records while active.

### Phase 2: The Three Channels (EP40-PH02)

### EP40-ST03: API channel — request/response/error capture at the `fetch` boundary

**Scope**: Client — structured capture of request, response, and errors at the API seam, keyed by correlation id.

### EP40-ST04: Appearance channel — orchestration decisions

**Scope**: Client — record pool selection, question served, recheck trigger, and shelving decisions to the trace, keyed by correlation id.

### EP40-ST05: Transition channel — Revision authority replay parity

**Scope**: Server/`@gll/db` — add `before`/`after` card-state snapshots to the Revision transition record so `review_answer_events` matches `answer_events` replay fidelity.

### Phase 3: Replay & Retirement (EP40-PH03)

### EP40-ST06: Replay harness — captured transition session → regression fixture

**Scope**: Tooling — replay a captured transition session (either authority) through the pure engine to reproduce a bug and emit a deterministic fixture.

### EP40-ST07: Retire the `useQuizDebugLog` / `debug-logs` hack

**Scope**: Client + server — delete the browser-memory logger and the file-sink route once the channels cover all three scenarios.

---

## Overall Acceptance Criteria

- [ ] A single correlation id links a served question → its answer request → the server transition
      row → the orchestration decision, for **both** Learning (`/api/answer`) and Revision
      (`/api/reviews/answer`) paths.
- [ ] A trace can be explicitly started and stopped; nothing is recorded while inactive.
- [ ] All three channels (API boundary, appearance, transition) populate for a traced session and
      reconcile on the shared correlation id into one ordered timeline.
- [ ] The Revision transition record carries `before`/`after` card state; a captured Revision session
      replays to a byte-identical card-state sequence through the pure engine (parity with Learning).
- [ ] The replay harness reproduces a known state bug from a captured session and emits a regression
      fixture.
- [ ] `useQuizDebugLog.ts` and `debug-logs.ts` are removed; no remaining code writes to the old
      file-sink.
- [ ] **Edge/failure case**: a missing `x-correlation-id` degrades gracefully (transition still
      persists; row records a null/anonymous correlation) and a trace-event-write failure is
      fail-open — it must never lose or block the authoritative state/card advance.

---

## Dependencies

- **EP37** — server-side transition channel (`answer_events`), correlation-id header plumbing, and the
  Learning authority hook this epic extends to Revision.
- **Logger ADR `20260708T143342Z`** — `@gll/logger` foundation (complete); consumed, not built here.
- **Authority ADR `20260708T125551Z`** — ratifies the Pillar 4 contract this epic implements.

## Next Steps

1. Review and approve plan
2. Create Design Spec (DS) — lock the correlation-id shape, the trace-session control surface, and the
   `review_answer_events` before/after schema change
3. Begin implementation (Phase 1 → 2 → 3)
