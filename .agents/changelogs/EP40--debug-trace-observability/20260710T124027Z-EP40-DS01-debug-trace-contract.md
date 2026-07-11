# EP40-DS01: Debug-Trace Contract & Correlation Foundation Specification

**Date**: 20260710T124027Z
**Status**: Draft
**Epic**: [EP40 - Debug-Trace Observability](../../plans/epics/EP40-debug-trace-observability.md)

**Architecture**:
[srs-demo Learning Authority, Review Authority & Debug-Trace Contract](../../../product-documentation/architecture/20260708T125551Z-engineering-srs-demo-learning-authority-and-debug-trace.md) — **Pillar 4**, Accepted. This DS delivers the **contract half** of EP40: the one **correlation id** that stitches the timeline, the **scoped trace-session** control surface, the **three-channel** record shapes, and the **Revision transition-channel parity** schema change (EP40-ST05). The client channel *wiring* (ST03 API, ST04 appearance), the replay harness (ST06) and the hack retirement (ST07) are deferred to **DS02**. Consumes the [Logger ADR](../../../product-documentation/architecture/20260708T143342Z-engineering-logging-strategy-injected-logger.md) (`@gll/logger`, complete) — no logging infrastructure is built here.

---

## 1. Feature Overview

EP37 already emits a **Learning** transition channel as a byproduct: `POST /api/answer` reads
`x-correlation-id`, tags a `child` logger, and appends a **replayable** row to `answer_events`
(`before_state`, `after_state`, inputs, `graduated`, `recheck`, `correlation_id`). The **Revision**
authority path (`POST /api/reviews/answer`) has the *plumbing* — correlation id + a `child` logger +
a durable `review_answer_events` append — but its row records the **answer**, not the **card-state
transition**. And **no client emits a correlation id** on either path, so the timeline has no root.

This DS locks the contract that makes both authorities observable *symmetrically*:

- **Correlation id** — a per-question id minted client-side and sent as `x-correlation-id` on **both**
  `POST /api/answer` and `POST /api/reviews/answer`. The server already reads the header; this DS
  defines its shape, lifecycle (one per served question, reused for that question's answer + any
  recheck re-ask), and the null-fallback contract.
- **Scoped trace session** — an explicit **start/stop** surface that gates whether client channels
  record. This DS specifies the control contract (a session id + active flag + the correlation ids it
  scopes); the channel *implementations* are DS02.
- **Three-channel record shapes** — the typed shape of an API-channel, appearance-channel, and
  transition-channel entry, all keyed on `correlationId`, so a session reconciles into one ordered
  timeline regardless of which side of the wire produced each entry.
- **Revision transition parity (EP40-ST05)** — extend the Revision authority record with `before`/
  `after` card-state snapshots so a captured Revision session replays to a byte-identical card-state
  sequence, matching the Learning channel's fidelity (the ADR's scenario (iii), *both* authorities).

**The one invariant this DS locks (testable).** A trace entry is **diagnostics, never control flow**:
appending to any channel is **fail-open** and off the authoritative path — a trace-write failure (or a
missing correlation id) must **never** block or alter the Learning `WordState` transition or the
Revision card advance. This mirrors the existing fail-open `review_answer_events` append in
[`reviews.ts`](../../../apps/server/src/routes/reviews.ts) and is the property that lets tracing be
switched on in a live session safely.

**What is reused, not built** (keeps this DS small):

- **`@gll/logger`** — `PinoLogger`/`NoopLogger`, the `Logger` port, `child({ correlationId })`. Fully
  delivered by the Logger ADR; consumed as-is.
- **Correlation plumbing** — `x-correlation-id` header read + `child` logger already exist on **both**
  routes ([`answer.ts:37`](../../../apps/server/src/routes/answer.ts#L37),
  [`reviews.ts:89`](../../../apps/server/src/routes/reviews.ts#L89)). This DS supplies the *sender*.
- **`answer_events` (Learning transition channel)** — already at target fidelity from EP37; the
  Revision change (ST05) brings `review_answer_events` up to the same bar, it is not a rebuild.

**Not in this DS**: the API-channel `fetch` interceptor (ST03) and appearance-channel instrumentation
(ST04) — DS02; the replay harness (ST06); removal of `useQuizDebugLog.ts` / `debug-logs.ts` (ST07).
`POST /api/answer`'s Learning transition row is untouched (already at parity).

---

## 2. Core Requirements

| Requirement | Decision | Rationale |
| --- | --- | --- |
| Correlation id scope | One id per **served question**, reused for that question's answer request and any recheck re-ask | Stitches question → transition → orchestration into one timeline; a recheck is the same logical event |
| Correlation id transport | Client sets `x-correlation-id` header on both answer POSTs | Server already reads it on both routes; header keeps it out of the typed request bodies (a transport concern, not a wire fact) |
| Missing correlation id | Degrade gracefully — transition/advance still persists; row stores `null` correlation | Diagnostics must never gate authority; matches nullable `correlation_id` columns already in schema |
| Trace-session control | Explicit start/stop; client channels record **only** while active | ADR Pillar 4 — "situational, not always-on"; evolves today's flush model |
| Channel keying | Every entry (API, appearance, transition) carries `correlationId` | Single reconciliation key across both sides of the wire |
| Revision transition fidelity (ST05) | Record `before`/`after` card state on the Revision authority path | Replay parity with Learning; scenario (iii) must hold for Revision, not just Learning |
| Revision record placement (OQ1 — resolved) | **New `review_transition_events` table** — a pure transition log, separate from the `review_answer_events` answer log | Clean separation of answer-log vs. transition-log; joined to inputs by `correlation_id`. Trade-off accepted: a second fail-open write on the due branch. Note the mild asymmetry — Learning's `answer_events` is a *combined* answer+transition log; both remain replayable, which is what parity requires |
| Client channel sink (OQ2 — resolved) | **In-memory during the session, exported on stop** — no server sink | API/appearance tracing is **once-off diagnosis** when an issue is identified, not a durable stream; reconciled offline against the DB transition rows by `correlation_id`. Consequence: `debug-logs.ts` is **deleted outright** (ST07), not replaced by an endpoint |
| Trace-write failure | Fail-open on all channels; off the authoritative path | Tracing is safe to enable live; a sink failure loses a diagnostic, never a state change |

## 3. Data Structures

```typescript
// --- Correlation (client → both answer POSTs, header `x-correlation-id`) ---
/** Minted once per served question; reused for its answer + any recheck re-ask. */
type CorrelationId = string; // opaque, url-safe (e.g. crypto.randomUUID())

// --- Scoped trace session (client control surface; wiring in DS02) ---
// OQ2 resolved: entries live in this session's memory and are EXPORTED on stop
// (once-off diagnosis). No server sink; reconciled offline against DB transition rows.
interface TraceSession {
  sessionId: string;
  active: boolean;
  startedAt: string;              // ISO
  stoppedAt?: string;             // ISO, set on stop
  correlationIds: CorrelationId[]; // questions observed while active
  entries: TraceEntry[];          // api + appearance, buffered in-memory; exported on stop
}

// --- Three channels, one reconciliation key ---
type TraceChannel = 'api' | 'appearance' | 'transition';

interface TraceEntry {
  correlationId: CorrelationId | null;
  channel: TraceChannel;
  at: string;                      // ISO, orders the timeline
  data: unknown;                   // channel-specific payload (shapes below)
}

// API channel (boundary) — scenario (i). DS02 wiring.
interface ApiChannelData { method: string; path: string; status?: number; error?: string; }

// Appearance channel (client orchestration) — scenario (ii). DS02 wiring.
interface AppearanceChannelData {
  kind: 'pool-selected' | 'question-served' | 'recheck-triggered' | 'shelving-decision';
  detail: unknown;
}

// --- Revision transition parity (EP40-ST05, THIS DS) ---
// Card-state snapshot recorded in the NEW review_transition_events table for replay.
interface ReviewCardSnapshot {
  due: string;                     // ISO
  stability: number;
  difficulty: number;
  schedulerData: unknown;          // ts-fsrs internal state (server-only; never crosses to client)
}
// NEW table review_transition_events (OQ1) — pure transition log, mirrors answer_events'
// before/after role; joined to the answer inputs in review_answer_events by correlation_id.
//   correlation_id, user_id, word_id, before_card (JSON), after_card (JSON), created_at
// A row is written ONLY on the due (advance) branch — an eager (not-due) answer has no
// transition, so it produces no transition row (the analogue of nullable `rating`).
```

## 4. User Workflows

```
Trace ON → question served (mint correlationId, appearance:question-served)
        → answer POST (x-correlation-id; api:request → server transition row → api:response)
        → orchestration (appearance:pool-selected / recheck / shelving)
        → [repeat per question] → Trace OFF → reconcile entries by correlationId → ordered timeline
                                                                              ↘ replay (DS02/ST06)
```

## 5. Stories

### Phase 1: Correlation & Session Foundation (EP40-PH01)

### EP40-ST01: Client correlation-id generation & propagation across both answer paths

**Scope**: Client — mint per-question id; send `x-correlation-id` on `/api/answer` and `/api/reviews/answer`.
**Read List**: `apps/srs-demo/src/App.vue`; the client review-answer call site; `apps/server/src/routes/answer.ts`, `reviews.ts` (header read — reference only).
**Tasks**:

- [ ] Mint a `CorrelationId` when a question is served; hold it for that question's answer + recheck re-ask.
- [ ] Attach `x-correlation-id` to both answer POST requests.
      **Acceptance Criteria**:
- [ ] The server row (`answer_events` / `review_answer_events`) for an answer carries the same id the client minted for that question.
- [ ] A recheck re-ask of a just-missed word reuses the original question's id.

### EP40-ST02: Scoped trace session (start/stop control surface)

**Scope**: Client — a `TraceSession` with explicit start/stop; records only while active.
**Read List**: `apps/srs-demo/src/composables/useQuizDebugLog.ts` (the flush model being evolved).
**Tasks**:

- [ ] Implement start/stop control producing a `TraceSession`; expose active-state to channels (DS02 consumes it).
      **Acceptance Criteria**:
- [ ] No `TraceEntry` is recorded while the session is inactive.
- [ ] A started→stopped session exposes the ordered set of `correlationId`s observed.

### EP40-ST05: Revision transition-channel replay parity

**Scope**: Server + `@gll/db` — a new `review_transition_events` table recording `before`/`after` card state on the Revision authority path (OQ1).
**Read List**: `apps/server/src/routes/reviews.ts`; `packages/db/src/schema.ts` (`answer_events`, `review_answer_events`); `packages/db/src/sqlite-answer-event-store.ts` (shape to mirror).
**Tasks**:

- [ ] Add `review_transition_events` table (`correlation_id`, `user_id`, `word_id`, `before_card`, `after_card`, `created_at`) + migration.
- [ ] Add a `SqliteReviewTransitionEventStore` (mirroring `SqliteAnswerEventStore`) with an injected `Logger`; append on the **due** branch only, **fail-open**.
- [ ] Wire the append into `POST /api/reviews/answer` after the persisted advance, keyed by the request's `correlation_id`.
      **Acceptance Criteria**:
- [ ] A due Revision answer writes one `review_transition_events` row with `before`/`after` card state; an eager (not-due) answer writes **no** transition row.
- [ ] A captured Revision session replays through the pure scheduler to a byte-identical card-state sequence (parity with `answer_events`).
- [ ] A transition-write failure does **not** block or alter the persisted card advance (fail-open, tested).

## 6. Success Criteria

1. One correlation id links a served question → its answer request → the server transition row for **both** Learning and Revision paths.
2. Client channels record only within an active trace session; entries reconcile by `correlationId`.
3. Revision transition rows reach `answer_events` replay fidelity; a Revision session replays byte-identically.
4. Missing correlation id and trace-write failure are both fail-open — no effect on the authoritative transition/advance.
5. No type errors.

---

## Resolved Decisions

- **OQ1 — Revision record placement (ST05): RESOLVED → new `review_transition_events` table.** A pure
  transition log separate from the `review_answer_events` answer log, joined to inputs by
  `correlation_id`. Chosen for clean answer/transition separation; the extra fail-open write on the due
  branch is accepted. Noted asymmetry: Learning's `answer_events` is a *combined* answer+transition
  log — both remain replayable, which is all parity requires.
- **OQ2 — Client trace sink: RESOLVED → in-memory + export, no server sink.** API/appearance tracing
  is once-off diagnosis when an issue is identified, not a durable stream; buffered in the trace
  session and exported on stop, reconciled offline against DB transition rows by `correlation_id`.
  **Consequence for ST07**: `debug-logs.ts` is deleted outright (not replaced by a trace endpoint).
