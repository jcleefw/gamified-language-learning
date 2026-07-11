# EP40-DS02: Client Channels, Export & Replay Specification

**Date**: 20260710T125911Z
**Status**: Draft
**Epic**: [EP40 - Debug-Trace Observability](../../plans/epics/EP40-debug-trace-observability.md)

**Architecture**:
[srs-demo Learning Authority, Review Authority & Debug-Trace Contract](../../../product-documentation/architecture/20260708T125551Z-engineering-srs-demo-learning-authority-and-debug-trace.md) — **Pillar 4**, Accepted. This DS delivers the **client half** of EP40 on top of the contract locked in [EP40-DS01](20260710T124027Z-EP40-DS01-debug-trace-contract.md): the **API channel** (EP40-ST03), the **appearance channel** (EP40-ST04), the **session export** format, the **replay harness** (EP40-ST06), and the **retirement** of the old `useQuizDebugLog` / `debug-logs.ts` hack (EP40-ST07). It consumes DS01's `CorrelationId`, `TraceSession`, and `TraceEntry` shapes as given.

---

## 1. Feature Overview

DS01 locked *what* the three channels look like and *how* they reconcile (one `correlationId`, a
start/stop `TraceSession`, entries buffered in memory and exported on stop — **no server sink**). DS02
builds the two client channels, the export, and the offline replay:

- **API channel (ST03)** — wrap the two answer `fetch` calls in
  [`useStore.ts`](../../../apps/srs-demo/src/composables/useStore.ts) (`/api/answer` L97,
  `/api/reviews/answer` L147) so each records an `api` `TraceEntry` — method, path, status, and
  **error** — keyed by the same `x-correlation-id` the request carries. This is the seam that already
  sets the header (ST01), so channel + correlation are wired at one point. → scenario (i).
- **Appearance channel (ST04)** — instrument the orchestration seams that decide *what the learner
  sees next*: pool selection and recheck in
  [`useLearningSession.ts`](../../../apps/srs-demo/src/composables/useLearningSession.ts), the review
  queue in [`useReviewSession.ts`](../../../apps/srs-demo/src/composables/useReviewSession.ts), and
  shelving in [`useShelving.ts`](../../../apps/srs-demo/src/composables/useShelving.ts). Each emits an
  `appearance` `TraceEntry` keyed by the current question's `correlationId`. → scenario (ii).
- **Export** — on `TraceSession` stop, serialise `{ session-meta, entries[] }` (API + appearance,
  ordered by `at`) to a downloadable JSON file. This is the once-off diagnostic artefact (DS01/OQ2);
  it is **reconciled offline** against the durable DB transition rows by `correlationId`.
- **Replay harness (ST06)** — a Node/tooling script that reads the durable **transition** rows
  (`answer_events` for Learning, `review_transition_events` for Revision) for a given `correlationId`
  set and replays their inputs through the **pure** engine (`@gll/srs-engine-v2` /
  `@gll/srs-review`), asserting the recomputed state sequence equals the recorded `after_state` — and
  emitting that sequence as a regression fixture. Replay uses the durable rows, **not** the client
  export (the export supplies human context, the DB supplies the authoritative inputs).
- **Retirement (ST07)** — once the channels cover scenarios (i)–(iii), delete
  [`useQuizDebugLog.ts`](../../../apps/srs-demo/src/composables/useQuizDebugLog.ts) and its call sites,
  and remove the [`debug-logs.ts`](../../../apps/server/src/routes/debug-logs.ts) route + its app
  registration. Deleted outright — DS01/OQ2 chose no server sink to replace it.

**The invariant carried from DS01 (testable).** Every channel write is **fail-open and off the hot
path**: instrumentation wraps but never gates the answer `fetch`, the state transition, or an
orchestration decision. A trace buffer error is swallowed; the learner flow is unaffected whether a
trace is active or not.

**What is reused, not built**:

- **`CorrelationId` / `TraceSession` / `TraceEntry`** and the `x-correlation-id` propagation (ST01) —
  from DS01; DS02 consumes them.
- **Durable transition rows** — `answer_events` (EP37) and `review_transition_events` (DS01/ST05);
  the replay harness reads them, it does not add to them.
- **The pure engines** — replay imports the same `@gll/srs-engine-v2` / `@gll/srs-review` transitions
  the server runs; no second implementation.

**Not in this DS**: the correlation-id and session contracts (DS01/ST01–ST02); any server sink
(explicitly rejected in DS01/OQ2); `answer_events` changes (already at parity).

---

## 2. Core Requirements

| Requirement | Decision | Rationale |
| --- | --- | --- |
| API-channel seam | Wrap the two answer `fetch`es in `useStore.ts` | Single choke point that already carries the correlation header (ST01) — channel + key wired once |
| API-channel captures errors | Record status **and** thrown/`!ok` errors | Scenario (i) is boundary *failures*; the current code throws on `!ok` and loses context |
| Appearance-channel seams | Instrument pool-selection, recheck, review-queue, shelving | These are the "why did *this* word appear" decisions (scenario ii) — the orchestration the client still owns |
| Appearance keying | Tag each entry with the current question's `correlationId` | Lets an appearance decision line up with its API call and server transition |
| Export trigger & format | On session stop → downloadable `{ meta, entries[] }` JSON, ordered by `at` | Once-off diagnostic artefact (DS01/OQ2); no endpoint, reconciled offline |
| Replay source | Durable DB transition rows, **not** the client export | The DB holds the authoritative inputs/after-state; the export holds human context only |
| Replay assertion | Recomputed sequence == recorded `after_state`; emit as fixture | Pure engine ⇒ deterministic; a mismatch *is* the bug, and the run *is* the regression fixture |
| Retirement scope | Delete `useQuizDebugLog.ts` + `debug-logs.ts` + registrations | No server sink chosen (DS01/OQ2); nothing to migrate the old blob into |
| Fail-open (all of the above) | Instrumentation never gates fetch/transition/orchestration | Tracing is safe to leave in; matches DS01's safety invariant |

## 3. Data Structures

```typescript
// Consumed from DS01: CorrelationId, TraceChannel, TraceEntry, TraceSession.

// API channel payload (TraceEntry.data when channel === 'api')
interface ApiChannelData {
  method: string;
  path: string;          // '/api/answer' | '/api/reviews/answer' | …
  status?: number;       // absent if the request threw before a response
  ok?: boolean;
  error?: string;        // network throw or non-ok body message
}

// Appearance channel payload (TraceEntry.data when channel === 'appearance')
interface AppearanceChannelData {
  kind: 'pool-selected' | 'question-served' | 'recheck-triggered' | 'shelving-decision';
  detail: unknown;       // e.g. selected wordIds, the recheck wordId, shelve/unshelve + reason
}

// Exported artefact (written on TraceSession stop)
interface TraceExport {
  sessionId: string;
  startedAt: string;
  stoppedAt: string;
  correlationIds: CorrelationId[];
  entries: TraceEntry[]; // api + appearance, ordered by `at`
  // NOTE: transition entries are NOT here — they live in the DB and are joined offline by correlationId.
}

// Replay harness (ST06) — reads durable transition rows, not the export.
interface ReplayResult {
  correlationId: CorrelationId;
  matched: boolean;              // recomputed after-state == recorded after_state
  recomputed: unknown;           // WordState (Learning) | ReviewCard (Revision)
  recorded: unknown;
}
```

## 4. User Workflows

```
Diagnose an issue:
  Trace ON → reproduce the bug → Trace OFF → export downloads trace-<session>.json
    → read export (API + appearance) to see the client story, keyed by correlationId
    → for scenario (iii): run replay harness over the DB transition rows for those correlationIds
        → mismatch pinpoints the bad transition AND drops a regression fixture
```

## 5. Stories

### Phase 2: The Three Channels (EP40-PH02)

### EP40-ST03: API channel — request/response/error capture at the `fetch` boundary

**Scope**: Client — record an `api` `TraceEntry` around both answer `fetch`es.
**Read List**: `apps/srs-demo/src/composables/useStore.ts` (L90–160); DS01 §3 (`TraceEntry`, `TraceSession`).
**Tasks**:

- [ ] Wrap the `/api/answer` and `/api/reviews/answer` calls so each records method/path/status/ok and, on `!ok` or throw, the error — keyed by the request's `correlationId`, only while the session is active.
- [ ] Keep the existing throw-on-failure control flow unchanged (record, then rethrow).
      **Acceptance Criteria**:
- [ ] A traced answer produces one `api` entry with the same `correlationId` as its transition row.
- [ ] A failed request (non-ok or network throw) records an entry with `error` populated; the learner-facing behaviour is unchanged.
- [ ] With the session inactive, no `api` entry is recorded.

### EP40-ST04: Appearance channel — orchestration decisions

**Scope**: Client — record `appearance` entries at the pool/recheck/review-queue/shelving seams.
**Read List**: `apps/srs-demo/src/composables/useLearningSession.ts`, `useReviewSession.ts`, `useShelving.ts`; the old signals in `useQuizDebugLog.ts` (what to preserve).
**Tasks**:

- [ ] Emit `question-served` + `pool-selected` on Learning pool advance; `recheck-triggered` on a re-ask; `shelving-decision` on shelve/unshelve; a review-queue equivalent in `useReviewSession.ts`.
- [ ] Key each entry with the current question's `correlationId`; record only while the session is active.
      **Acceptance Criteria**:
- [ ] For a traced question, the appearance entries reconcile with its API + transition entries on one `correlationId` into an ordered timeline.
- [ ] The per-transition detail the old `logBatch*` provided (pool, shelved set) is representable via appearance entries (no diagnostic regression).

### Phase 3: Replay & Retirement (EP40-PH03)

### EP40-ST06: Replay harness — transition rows → regression fixture

**Scope**: Tooling — replay durable transition rows through the pure engine.
**Read List**: `packages/db/src/schema.ts` (`answer_events`, `review_transition_events`); `packages/srs-engine-v2` + `packages/srs-review` transition entry points; `apps/server/src/config/learning.ts`.
**Tasks**:

- [ ] Load transition rows for a `correlationId` set; replay inputs (Learning: `correct`/`latencyMs`/`recheck`; Revision: `rating` derivation from the recorded before-card) through the pure engine.
- [ ] Assert recomputed after-state equals recorded `after_state`/`after_card`; emit the sequence as a fixture file.
      **Acceptance Criteria**:
- [ ] Replaying a captured session reproduces its recorded state sequence byte-identically (or reports the first divergence).
- [ ] Works for **both** Learning (`answer_events`) and Revision (`review_transition_events`) rows.
- [ ] The emitted fixture re-runs as a standalone regression test.

### EP40-ST07: Retire the `useQuizDebugLog` / `debug-logs` hack

**Scope**: Client + server — delete the old logger, its call sites, and the file-sink route.
**Read List**: `apps/srs-demo/src/composables/useQuizDebugLog.ts` + its importers (`App.vue` L7, session composables); `apps/server/src/routes/debug-logs.ts`; `apps/server/src/app.ts` (route registration).
**Tasks**:

- [ ] Remove `useQuizDebugLog.ts` and every `log*`/`flushLogs` call site.
- [ ] Remove the `debug-logs.ts` route and its registration in `app.ts`.
      **Acceptance Criteria**:
- [ ] No code references `useQuizDebugLog` or posts to `/api/debug-logs`.
- [ ] The three channels + export cover scenarios (i)–(iii) with the hack gone (verified against acceptance above).

## 6. Success Criteria

1. A traced session exports one JSON artefact whose API + appearance entries reconcile by `correlationId`, and joins offline to the DB transition rows into one ordered timeline.
2. The replay harness reproduces a captured state sequence byte-identically for both Learning and Revision, emitting a reusable fixture.
3. `useQuizDebugLog.ts` and `debug-logs.ts` are deleted; nothing references them.
4. All instrumentation is fail-open — an inactive or erroring trace never alters the learner flow or the authoritative transition.
5. No type errors.
