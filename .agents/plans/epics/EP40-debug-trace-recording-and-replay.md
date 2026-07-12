# EP40 - Debug-Trace Recording & Replay (end-to-end)

**Created**: 20260712T003617Z

**Status**: In Progress

<!-- Status: Draft | Accepted | In Progress | Impl-Complete | BDD Pending | Completed | Shelved | Withdrawn -->

<!-- Progress: DS01 (Phases 1–2 — shared applyAnswer core + replay tool) implemented & green. DS02 (Phases 3–5 — recording, UX, cleanup) implemented & green; record→replay round-trip byte-exact. -->

**Type**: Epic Plan
**Depends on**: EP37 (learning-authority: `/api/answer` + `answer_events`), EP38/EP39 (review mode — needed for the Learning↔Review crossing)
**Parallel with**: N/A
**Predecessor**: N/A

---

## Problem Statement

When a learner finishes a session and a word's `WordState` is **not what was expected**, there is no way
to reproduce the bug. The tester can see it is wrong by eye but cannot **hand it to the engine** to
reproduce, because the state transitions are effectively unobservable: today's client-side logger
([`useQuizDebugLog.ts`](../../apps/srs-demo/src/composables/useQuizDebugLog.ts) →
[`debug-logs.ts`](../../apps/server/src/routes/debug-logs.ts) file-sink) captures batch-boundary
snapshots, omits the inputs that caused each transition, is non-durable, and cannot be re-run.

EP40 delivers the full loop the tester actually needs: **hit Start in the UI → play the session →
download a self-contained artifact → hand it to the engine to replay and diff**. It realizes the
**recording side of Pillar 4** of the
[Learning-Authority & Debug-Trace ADR](../../product-documentation/architecture/20260708T125551Z-engineering-srs-demo-learning-authority-and-debug-trace.md)
and the **replay half** of the
[Seeding & Replay — One Domain-Replay Tool ADR](../../product-documentation/architecture/20260711T140330Z-engineering-seeding-replay-domain-replay-tool.md).
The cross-app *consolidation* the tool ADR also decides (`@gll/srs-fixtures` extraction + `cli-demo-db`
seeder merge) is **out of scope here** — it is a separate follow-up epic (its YAGNI trigger, the
replay consumer, is what EP40 builds).

## Scope

**In scope**:

- **Replay tool** (server-side): one shared `applyAnswer` used by both the live `/api/answer` route and
  replay (parity by construction); a `replayArtifact` core that seeds a fresh `:memory:`/existing store,
  folds the recorded inputs, and diffs against recorded states; a CLI replay mode + a Vitest fixture runner.
- **Self-contained artifact contract**: lazy per-word baseline + ordered inputs + **resolved thresholds**
  (captured on the write path — the one input `answer_events` lacks today) + recorded appearance context.
  Word-transition scope, direction-blind (follows `answer_events`).
- **Full Pillar 4 recording** in `srs-demo`: one correlation id stitching *question served → `/api/answer`
  → server transition*; the **transition channel** (server, authoritative) and the **appearance channel**
  (client orchestration: pool selection, question served, recheck, shelving) recorded as context;
  **Start/Stop** control; **phase-scoped** sessions (Learning *or* Review) that **span decks**; the
  **nav-guard soft-confirm** that finalizes a recording on mid-quiz cross-navigation and the
  **Learning↔Review crossing** that finalizes-and-downloads rather than silently dropping.
- Retiring the old client-snapshot debug hack.

**Out of scope**:

- `@gll/srs-fixtures` extraction + `cli-demo-db` seeder consolidation + injected-target unification →
  **separate follow-up epic (EP42+)**. EP40's replay tool lands in `apps/server`.
- **Seeded-RNG orchestration recompute** (re-deriving *which word appeared* as an automatic divergence) —
  deferred per the tool ADR's D3; appearance is recorded context, not recomputed.
- `cli-demo-db` live-loop `applyAnswer` parity (its loop runs an inline transition) — a later consolidation.
- The API-boundary debug channel (request/response/errors at `fetch`) — Pillar 4 lists it, but EP40's
  driving scenario is transition + appearance; the API channel can be a later add.

---

## Stories

<!-- Phases: shared core/contract → replay (consume) → recording channels → recording UX → cleanup.
     Replay (Ph2) can be built/tested against transition-only artifacts before the full UI exists. -->

### Phase 1: Shared transition core & artifact contract (EP40-PH01)

### EP40-ST01: Extract shared `applyAnswer`

**Scope**: `apps/server` — lift the transition logic out of the `POST /api/answer` handler
([answer.ts](../../apps/server/src/routes/answer.ts)) into a pure, dependency-injected
`applyAnswer(store, event, thresholds) → { before, after, graduated }`. The route calls it; replay will
call the same function. No behaviour change — pure extraction that makes replay parity structural.

### EP40-ST02: Artifact contract + resolved-threshold capture

**Scope**: Define the self-contained artifact schema (lazy per-word baseline + ordered inputs +
resolved thresholds + appearance context) and add **resolved-threshold capture on the write path** so a
transition record carries the config it was computed under (today `answer_events` does not). Contract
types live in the composition layer (`apps/server` for now), not in `@gll/api-contract`.

### Phase 2: Replay tool — consume (EP40-PH02)

### EP40-ST03: `replayArtifact` core + diff

**Scope**: Fold a recorded answer stream through `applyAnswer`, seeding a fresh `:memory:`
(`SqliteLearningStore`, no new store impl) or an existing DB, and diff each recomputed `WordState`
against the recorded `afterState`; report the first divergence with its inputs. Deterministic (the
transition path reads no clock/RNG).

### EP40-ST04: CLI replay mode + Vitest fixture runner

**Scope**: Thin wrappers over the core — a `replay <artifact>` mode on the existing seed CLI
([seed/cli.ts](../../apps/server/src/seed/cli.ts)) that prints the step table and exits non-zero on
first divergence (`--fresh`/`--existing-db`, zero-config DB path), plus a Vitest runner that turns a
dropped-in artifact into a regression assertion.

### Phase 3: Recording channels (EP40-PH03)

### EP40-ST05: Correlation id + transition-channel recording

**Scope**: One correlation id generated client-side and carried *question served → `/api/answer` →
server transition*, so the authoritative per-answer `WordState` change (with inputs) is a correlated,
durable record. Server side largely exists (`answer_events`); this wires the correlation id end-to-end
and ensures the transition record is complete (with ST02's thresholds).

### EP40-ST06: Appearance-channel recording

**Scope**: `srs-demo` client — instrument orchestration to record, as **read-only context**, each
appearance decision (active-pool selection, question served, recheck trigger, shelving/rebalance),
correlation-stitched to its transition. Recorded, not recomputed.

### Phase 4: Recording UX — sessions & scoping (EP40-PH04)

### EP40-ST07: Start/Stop session + self-contained artifact assembly & download

**Scope**: `srs-demo` UI — a Start/Stop recording control; a **phase-scoped** session (Learning *or*
Review) that spans decks; assemble the two channels + lazy per-word baseline + thresholds into one
self-contained, downloadable artifact (DB-independent).

### EP40-ST08: Nav-guard soft-confirm + Learning↔Review crossing finalize

**Scope**: `srs-demo` UI — cross-navigation between phases is intended at the deck overview; a mid-quiz
attempt raises a **soft-confirm** (Cancel default) that **finalizes and downloads** the active recording
before leaving; the Learning↔Review crossing finalizes rather than silently dropping. Recording never
leaks across the boundary and never loses what it had.

### Phase 5: Cleanup (EP40-PH05)

### EP40-ST09: Retire the client-snapshot debug hack

**Scope**: Remove `useQuizDebugLog.ts`, the `debug-logs.ts` file-sink route, and the snapshot half of
`PoolDebugPanel.vue`, now superseded by the correlated recording + transition-recompute replay.

---

## Overall Acceptance Criteria

- [x] `applyAnswer` is a single pure function; the `/api/answer` route and replay both call it — no second transition implementation. *(DS01-ST01)*
- [x] An artifact is self-contained (baseline + inputs + resolved thresholds + appearance) and replays on a fresh `:memory:` DB with no dependency on the origin database. *(DS01-ST02/ST03)*
- [x] Replay recomputes the `WordState` trajectory and reports the first divergence; for a faithful session the diff is byte-exact (golden-master). *(DS01-ST03/ST04)*
- [x] Recording in `srs-demo`: Start/Stop works; one correlation id stitches question → answer → transition; the appearance channel is captured as read-only context. *(DS02-ST05/ST06/ST07)*
- [x] A session is phase-scoped (Learning *or* Review), spans decks, and a mid-quiz cross-navigation soft-confirms and finalizes the artifact (never silently dropped). *(DS02-ST07/ST08)*
- [x] `pnpm seed replay <artifact>` reproduces the `WordState` trajectory and the same artifact runs as a Vitest regression fixture; a **captured** artifact now closes the record→replay round-trip byte-exact *(DS02-ST07, `record-replay-roundtrip.test.ts`)*.
- [x] The old snapshot hack (`useQuizDebugLog`/`debug-logs.ts` route) is removed. `PoolDebugPanel` was pure live pool-inspection (no snapshot half) and is retained. *(DS02-ST09)*

---

## Dependencies

- [Seeding & Replay — One Domain-Replay Tool ADR](../../product-documentation/architecture/20260711T140330Z-engineering-seeding-replay-domain-replay-tool.md) — replay half (D1–D4, D7).
- [Learning-Authority & Debug-Trace ADR](../../product-documentation/architecture/20260708T125551Z-engineering-srs-demo-learning-authority-and-debug-trace.md) — Pillar 4 recording (correlation id, three channels, scoped sessions).
- EP37 (`/api/answer` + `answer_events`), EP38/EP39 (review mode, for the Learning↔Review crossing).

## Next Steps

1. Review and approve plan.
2. Create Design Spec(s) — natural split: DS01 = shared core + replay (Ph1–2, server-side), DS02 = recording (Ph3–4, `srs-demo`), plus cleanup.
3. Begin implementation with EP40-ST01 (`applyAnswer` extraction) — the unblocking foundation both sides depend on.
4. Follow-up epic (EP42+): `@gll/srs-fixtures` extraction + `cli-demo-db` seeder consolidation (the deferred cross-app DRY work).
