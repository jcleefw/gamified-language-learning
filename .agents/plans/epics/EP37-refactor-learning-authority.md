# EP37 - Refactor: Learning Authority (server-authoritative Learning + Review seeding)

**Created**: 20260708T140523Z
**Status**: Accepted

<!-- Status: Draft | Accepted | In Progress | Impl-Complete | BDD Pending | Completed | Shelved | Withdrawn -->

**Type**: Epic Plan
**Depends on**: EP36 (`@gll/srs-review`: `FsrsScheduler`, `SqliteReviewStore`, review types), EP30 (`@gll/db`), EP20 (`srs-engine-v2` Learning transition), EP31 (`srs-demo` persistence bridge being refactored)
**Parallel with**: Debug-trace epic (shares the transition-channel correlation id; not blocking)
**Predecessor**: N/A — this branch was formerly scoped as "Review in `srs-demo`"; that Review UI/flow is now a **separate** review-mode epic that depends on EP37.

**Architecture**: [`srs-demo` Learning Authority, Review Authority & Debug-Trace Contract](../../../product-documentation/architecture/20260708T125551Z-engineering-srs-demo-learning-authority-and-debug-trace.md) — EP37 implements **pillars 1–3 + the transition channel + the rollout gate**. Pillar 4 (debug trace) and the Review UI are out of scope. Also lands the foundational [Logging Strategy — Injected `@gll/logger`](../../../product-documentation/architecture/20260708T143342Z-engineering-logging-strategy-injected-logger.md) (Phase 0). Reconciles with [Quiz Contract & Answer Authority](../../../product-documentation/architecture/20260313T000000Z-engineering-quiz-contract-answer-authority.md) (EP15) without fully satisfying it (see Out of scope).

---

## Problem Statement

`srs-demo` runs the Learning loop **client-side**: the browser executes the pure engine
(`finishBatch` → `advanceAdaptiveSession`), computes mastery/graduation, and POSTs the *result* to a
thin `POST /api/state/word` that blindly stores a client-computed `WordState`. This is **emergent,
unratified drift** — it contradicts EP15's still-"complete" server-authority ADR, leaves Review with
no server-side seeding hook (graduation happens in the browser), and makes state transitions
effectively unobservable (the reason `debug-logs.ts` had to be hand-rolled).

The ADR settles this. **EP37 makes `srs-demo`'s persisted Learning state authoritative on the
server**: the per-answer state transition runs server-side via a new `POST /api/answer`, graduation
is detected server-side and seeds a `ReviewCard` in the same request, cross-table integrity is
enforced in the store layer, and the whole flip is gated behind a feature flag + shadow parallel-run
so behaviour is provably unchanged.

This unblocks the review-mode epic (it now has a real graduation hook) and lays the authoritative,
replayable transition stream the debug-trace epic builds on.

---

## Scope

**In scope** (ADR pillars 1–3 + transition channel + rollout gate + logging foundation):

- **Phase 0 — `@gll/logger` foundation**: a dedicated logger package (injected `Logger` port,
  `ConsoleLogger` + `NoopLogger`) per the logging ADR; wired into `@gll/db` and the server.
- **Pillar 1 — Learning state authority → server**: `POST /api/answer` contract in `@gll/api-contract`
  (**wire DTOs only** — behavioral config is server-owned, not in the contract); a Hono route that runs
  the **same pure `@gll/srs-engine-v2` transition** and persists `WordState` via `SqliteLearningStore`,
  returning authoritative state + a `graduated` event.
- **Transition channel**: a durable, authoritative per-answer transition record (inputs + before/after
  `WordState`) written on the `/api/answer` path — the replayable half of the debug trace.
- **Pillar 3 — Cross-table integrity in `@gll/db`** (not the Hono route): re-graduation
  ignore-if-exists; readers tolerate orphaned review cards; graduation is one-way.
- **Pillar 2 — Server-side Review seeding**: on a `graduated` event, the handler seeds a `ReviewCard`
  via `FsrsScheduler` + `SqliteReviewStore` with server-side rating inference. Frontend never imports
  `ts-fsrs`.
- **Client cutover**: `srs-demo` posts each answer and adopts the returned authoritative state instead
  of computing-then-POSTing; keeps question-gen, grading, and orchestration client-side.
- **Rollout gate**: a feature flag that **defaults on** — server-authority is the shipped default, with
  the legacy client-compute path retained as an off-switch/escape hatch. The golden-master parity test
  (below) must pass **before** the on-by-default flip merges; a shadow parallel-run precedes it.

**Out of scope**:

- **EP15 full answer verification** — server-side question generation and answer *verification*
  (withholding the key). The client keeps generating/grading; self-reported `correct` is an **accepted
  risk** per the ADR. Deferred.
- **Adaptive-session orchestration on the server** (`advanceAdaptiveSession`, `nextActivePool`,
  recheck, shelving) — stays client-side.
- **Pillar 4 — debug-trace app** (API + appearance channels, start/stop UI, replay tooling) — separate
  debug-trace epic. EP37 delivers only the server transition channel it consumes.
- **Review UI/flow in `srs-demo`** (surfacing due cards, review questions) — separate review-mode epic,
  depends on EP37.
- **Orphaned-card cleanup** and Review→Learning re-entry — deferred.
- **`cli-demo-db`** — intentionally full local authority; not retargeted. It **does** inherit pillar-3
  integrity rules via `@gll/db`.
- **Learning config in the shared contract** — behavioral thresholds are **server-owned**, never in
  `@gll/api-contract`. A frontend (web or a future mobile app) renders UI and sends raw answers; it must
  not carry/version learning policy, or behaviour would diverge per client.

---

## Stories

### Phase 0: Logging foundation (EP37-PH00)

### EP37-ST00: `@gll/logger` package + injection

**Scope**: New `@gll/logger` (injected `Logger` port, `ConsoleLogger`, `NoopLogger`) per the logging ADR; `@gll/db` stores accept an injected logger (default `NoopLogger`); server constructs and injects a `ConsoleLogger`. No behavioural change to existing flows.

### Phase 1: Server-side Learning transition (EP37-PH01) — Pillar 1

### EP37-ST01: `POST /api/answer` contract in `@gll/api-contract`

**Scope**: `AnswerRequest { wordId, correct, latencyMs }` + `AnswerResponse { wordState, newlyMastered, graduated }` DTOs and error codes; no server/client logic.

### EP37-ST02: Hono `POST /api/answer` route runs the pure transition

**Scope**: Server route executes the `@gll/srs-engine-v2` per-word transition, persists via `SqliteLearningStore`, returns authoritative `WordState` + events. Reuses the existing pure engine — no reimplementation.

### EP37-ST03: Authoritative transition record (transition channel)

**Scope**: On the `/api/answer` path, durably record `{ correlationId, wordId, input, before, after, events, seq }`. Append-only, queryable, replayable through the pure engine.

### Phase 2: Cross-table integrity in `@gll/db` (EP37-PH02) — Pillar 3

### EP37-ST04: Re-graduation is idempotent (ignore-if-exists)

**Scope**: Change the review-card seeding write in `SqliteReviewStore` from overwrite (`onConflictDoUpdate`) to ignore-if-exists so re-graduation never resets FSRS progress. Store layer only.

### EP37-ST05: Orphan tolerance + one-way graduation invariant

**Scope**: `getDueReviewCards` readers tolerate cards whose word is gone (skip, never crash); assert graduation-is-one-way (a word is not simultaneously active-in-Learning and in-Review) at the store boundary.

### Phase 3: Server-side Review seeding (EP37-PH03) — Pillar 2

### EP37-ST06: Seed `ReviewCard` on the `graduated` event

**Scope**: In the `/api/answer` handler, when a `graduated` event fires, infer the rating server-side and seed a `ReviewCard` via `FsrsScheduler` + `SqliteReviewStore` (idempotent per ST04). Frontend never imports `ts-fsrs`.

### Phase 4: Client cutover & rollout gate (EP37-PH04)

### EP37-ST07: Feature flag + shadow parallel-run harness

**Scope**: Behind a flag, `srs-demo` computes locally **and** calls `/api/answer`, compares the two `WordState` results, and logs divergences — without changing the source of truth yet.

### EP37-ST08: `srs-demo` cutover to server authority (flag on by default)

**Scope**: `srs-demo` posts each answer and adopts the returned authoritative state; server-authority ships as the **default**, with the legacy compute-then-`POST /api/state/word` path reachable only via the off-switch. Orchestration stays client-side.

### EP37-ST09: Golden-master parity test (acceptance gate)

**Scope**: Capture representative sessions (via the transition channel) and assert the server path reproduces byte-identical `WordState` sequences vs. the legacy client path. Passing this test is the merge gate for shipping the flag **on by default**.

---

## Overall Acceptance Criteria

- [ ] `POST /api/answer` runs the transition server-side, persists `WordState`, and returns
      authoritative state + `newlyMastered`/`graduated` events.
- [ ] A `graduated` event seeds exactly one `ReviewCard`; re-graduation of an already-reviewed word
      does **not** reset its FSRS progress (idempotent).
- [ ] Integrity rules live in `@gll/db` (verified by a direct-to-store test, no server), so
      `cli-demo-db` inherits them.
- [ ] `getDueReviewCards` returns without error when a card's word has been deleted (orphan tolerated).
- [ ] The flag ships **on by default** (server-authority); server state matches legacy client state on
      the golden-master session (byte-identical `WordState` sequence). Toggling the flag **off** restores
      the exact legacy client-compute behaviour as an escape hatch.
- [ ] A per-answer transition record is persisted with inputs + before/after state and is replayable
      through the pure engine.
- [ ] Frontend bundle does not import `ts-fsrs`.
- [ ] **Edge/limit**: a malformed/failed `/api/answer` request leaves persisted `WordState` unchanged
      and surfaces a typed error; the client does not silently drop the answer.

---

## Dependencies

- **EP36** — `@gll/srs-review` (`FsrsScheduler`, review types) and `SqliteReviewStore` in `@gll/db`.
- **EP30 / EP34** — `@gll/db` persistence + async storage contract.
- **EP20** — the pure `srs-engine-v2` Learning transition executed server-side.
- **The ADR** (above) — must remain Accepted; EP37 realises pillars 1–3.

## Next Steps

1. ✅ Review and approve plan
2. ✅ DS01 — PH00 logging foundation + PH01 `/api/answer` contract + route + transition record ([DS01](../../changelogs/EP37--refactor-learning-authority/20260708T141610Z-EP37-DS01-server-learning-transition.md))
3. ✅ DS02 — PH02 cross-table integrity in `@gll/db` (`seedReviewCard` ignore-if-exists, orphan tolerance, one-way graduation) ([DS02](../../changelogs/EP37--refactor-learning-authority/20260708T171133Z-EP37-DS02-cross-table-integrity.md))
4. Create DS for PH03 (server-side Review seeding on the `graduated` event — consumes `seedReviewCard`)
5. Begin implementation behind the feature flag
