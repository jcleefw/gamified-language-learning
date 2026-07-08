# ADR: `srs-demo` Learning Authority, Review Authority & Debug-Trace Contract

**Date**: 20260708T125551Z
**Status**: Accepted

<!-- Status: Accepted | Superseded | Deprecated -->

**Superseded by**: N/A
**Epic**: This ADR is realised by three epics — see *Epic decomposition* below. Epic numbers are assigned when each is created; this ADR does not fix them.
**RFC**: N/A

---

## Context

The `srs-demo` app runs the Learning loop **client-side**: `App.vue` calls the pure engine
(`finishBatch` → `advanceAdaptiveSession`), computes mastery/streaks/lapses, and detects graduation
(`getNewlyMasteredIds`). It then POSTs the *result* to a thin server endpoint,
`POST /api/state/word`, which blindly stores the client-computed `WordState`
([`apps/server/src/routes/state.ts`](../../apps/server/src/routes/state.ts),
[`apps/srs-demo/src/App.vue`](../../apps/srs-demo/src/App.vue) `finishBatchAndTransition`). The Hono
server is a persistence bridge; it never runs the engine.

Three problems flow from this, surfaced while planning EP36's Review phase (Track B):

1. **The authority is unratified drift, not a decision.** `20260313T000000Z-…-quiz-contract-answer-authority`
   (EP15) decided *"the server owns the quiz from question generation through answer verification"* and is
   marked Impl-Complete. `srs-demo` never implemented that; client-authority emerged from EP24 (no-backend
   demo) and EP31 (server added only as a persistence bridge because `better-sqlite3` can't load in a Vite
   browser bundle). The code contradicts a written, still-"complete" ADR, and no ADR ever overturned it.

2. **Review has no server-side hook.** `20260321T145300Z-…-srs-review-phase` and the packaging ADR
   (`20260708T005635Z-…-srs-review-phase-packaging`) frame Review as *server-authority*: the server owns
   `FsrsScheduler` + `ReviewStore` + rating inference, and the frontend never imports `ts-fsrs`. But a
   review card is seeded **at graduation**, and graduation is detected client-side — so there is no place on
   the server to seed it. Track B (ST10–ST12) is blocked on this mismatch.

3. **Learning state transitions are effectively unobservable.** Debugging a wrong `WordState` required
   hand-rolling a client-side logger that batches snapshots in browser memory and POSTs a JSON blob to a
   dumb file-sink ([`useQuizDebugLog.ts`](../../apps/srs-demo/src/composables/useQuizDebugLog.ts),
   [`routes/debug-logs.ts`](../../apps/server/src/routes/debug-logs.ts)). It captures state at
   *batch boundaries*, not per transition; it omits the *inputs* (grade, latency, question) that caused a
   transition; it is non-durable; and the authoritative write path knows none of it. The three real debug
   scenarios — (i) API-boundary issues, (ii) "the wrong word appeared" (orchestration), (iii) "this word's
   state is wrong" (transition) — span both sides of the wire and need a *scoped, user-controlled* trace.

This ADR governs **`srs-demo` only**. `cli-demo-db` intentionally holds full local authority (direct-to-DB,
server-bypassing) and is **out of scope** — it is a deliberately different consumer of the same engine, not
a replica of `srs-demo`.

---

## Decision

Four ratified pillars. Pillars 1–3 make `srs-demo`'s persisted state authoritative and consistent; pillar 4
makes the resulting transitions observable.

### Pillar 1 — Learning **state** authority moves to the server

The **state transition** executes on the server. A new endpoint (`POST /api/answer`, contract owned by
`@gll/api-contract`, shape finalised by the **Learning-authority epic**) receives `{ wordId, correct, latencyMs }`, runs the **same pure
`@gll/srs-engine-v2` transition** the client runs today, persists the resulting `WordState`, and returns the
authoritative state plus events (`newlyMastered`, `graduated`). The client adopts the returned state instead
of computing-then-POSTing its own.

**Deliberately scoped as *state* authority, not full quiz authority.** The client continues to **generate
questions and grade the answer** (it already holds the answer key via client-side `buildQuizItems`), and it
retains **adaptive-session orchestration** (`advanceAdaptiveSession`, `nextActivePool`, recheck, shelving
rebalance). EP15's stronger claim — server-side question generation and answer *verification* (withholding the
key) — is **explicitly deferred**; it would require moving orchestration server-side (a much larger, stateful
rewrite) and is not justified for a demo. The residual gap (client self-reports `correct`) is an **accepted
risk** for `srs-demo`, recorded in Consequences.

### Pillar 2 — Review authority is server-side, seeded on the transition path

Because graduation is now detected server-side (pillar 1), the server owns Review end-to-end:
`FsrsScheduler` + `SqliteReviewStore` + rating inference all live behind the API, and **the frontend never
imports `ts-fsrs`**. When `POST /api/answer` detects a `graduated` event, the handler seeds a `ReviewCard`
in the same request. This resolves the Track B blocker and honours the Review-phase ADRs as written.

### Pillar 3 — Cross-table integrity lives in the store layer

There are no foreign keys and no `PRAGMA foreign_keys` (per the schema ADR); tables are independent. The
following invariants are enforced in the **store layer (`@gll/db`)**, not in the Hono route — so any
direct-to-DB consumer inherits them:

- **Re-graduation is idempotent.** Seeding a review card for a word that already has one must **not** reset
  FSRS progress. `SqliteReviewStore.upsertReviewCard` currently `onConflictDoUpdate` (overwrites); Review
  seeding changes to **ignore-if-exists**. (Explicit resets remain a separate, intentional operation.)
- **Readers tolerate orphans.** `getDueReviewCards` does not join `words`; a card for a deleted word can stay
  "due" forever. Readers must skip/tolerate orphans rather than crash. A cleanup story is **deferred** (out of
  scope for the Learning-authority epic).
- **Graduation is one-way; Review is terminal for Learning.** A word must not be simultaneously "active in
  Learning" and "in Review". Graduation is the single transition into Review; the invariant is asserted at the
  store boundary. (Split-brain from an out-of-band Learning-table reset is a corruption case, not a supported
  state.)

### Pillar 4 — A scoped, correlated debug-trace contract

Observability is a first-class deliverable, **co-designed with pillar 1 but scoped to the debug-trace epic**.
This ADR ratifies the *contract*, not the implementation:

- **Scoped sessions.** A trace has explicit **start/stop** control (evolving today's flush model); it is
  situational, not always-on.
- **One correlation id** stitches a served question → the `POST /api/answer` request → the server transition
  → the resulting orchestration decision into a single, ordered timeline.
- **Three channels**, because the truth lives on different sides of the wire:
  1. **API channel** (boundary) — request/response/**errors** at `fetch`. → scenario (i)
  2. **Appearance channel** (client) — pool selection, question served, recheck, shelving decisions. →
     scenario (ii)
  3. **Transition channel** (server) — the authoritative per-answer `WordState` change, with inputs. →
     scenario (iii)
- **Replayable.** Because the engine is pure, the transition channel is a deterministic input log: replaying
  it reproduces any state bug and yields regression fixtures for free.

The transition channel is a byproduct of pillar 1; the API and appearance channels stay client-side by nature
and do **not** depend on the authority move.

### Rollout & safety (binds the Learning-authority epic)

The authority flip is gated to guarantee behavioural parity:

- **Same pure engine on both sides** → transitions are equal by construction, not by a second implementation.
- **Feature flag / strangler-fig**: the current compute-locally-then-POST path stays until the flag flips.
- **Parallel-run (shadow)**: client and server both compute, divergences are logged, before the server becomes
  the source of truth.
- **Golden-master**: captured sessions (sourced from the transition channel) assert byte-identical `WordState`
  sequences. This is the acceptance gate for pillar 1.

### Epic decomposition

This ADR is realised by **three epics, defined by responsibility**. Numbers are assigned at creation time and
are intentionally not fixed here (scope of the review-mode epic in particular may still change).

- **Learning-authority epic** — pillars 1 + 3, the transition channel, and the rollout gate. This is the
  foundation and the head of this ADR; the other two depend on the decisions it locks in.
- **Debug-trace epic** — pillar 4, all three channels. Shares the correlation id with the Learning-authority
  epic; its API and appearance (client) channels can proceed in parallel and do not depend on the authority
  move.
- **Review-mode epic** — Review UI/flow in `srs-demo`. Depends on the Learning-authority epic (needs the
  server-side graduation hook) and pillar 2.

**Dependency edges**: Review-mode → Learning-authority (hard); Debug-trace ↔ Learning-authority (shared
correlation id only — soft).

---

## Consequences

**Positive**:

- Resolves the standing contradiction with EP15: `srs-demo`'s persisted Learning state becomes authoritative
  and matches a written decision.
- Gives Review a real server-side seeding hook, unblocking Track B (the review-mode epic).
- Turns the "this word's state is wrong" debug scenario from a lossy client snapshot into a durable,
  authoritative, **replayable** server-side event stream — retiring the weakest part of the current
  `debug-logs.ts` hack.
- Integrity rules in `@gll/db` are inherited by every consumer, including `cli-demo-db`.
- No engine reimplementation: the same pure package runs on the server, so risk is contained to *where* it runs.

**Negative**:

- The client still self-reports `correct` (question generation/grading stays client-side). EP15's full
  answer-verification goal remains **unmet** for `srs-demo`; a malicious/buggy client can still assert a wrong
  answer as correct. Accepted for a demo; revisit only if `srs-demo` becomes a real product surface.
- Adds a network round-trip on the per-answer path (previously fire-and-forget). Mitigated by keeping
  orchestration client-side and adopting the returned state optimistically.
- Two authority models now coexist by design (`srs-demo` = server for state; `cli-demo-db` = full local). This
  is intentional but must be documented so it is not mistaken for inconsistency.

**Neutral**:

- Orphaned review cards and Learning/Review split-brain are *tolerated*, not *solved*; a cleanup story is
  deferred.
- Shelving already follows a server-backed pattern (DB stagnation counters), so pillar 1 extends an existing
  shape rather than introducing a new one.
- The debug-trace contract (pillar 4) is ratified here but implemented by the debug-trace epic; the API and
  appearance channels are independent of the authority decision and could ship even if pillar 1 slipped.
