# EP40-DS01: Shared Transition Core & Artifact-Replay Tool (Phases 1–2) Specification

**Date**: 20260712T004215Z
**Status**: Accepted
**Epic**: [EP40 - Debug-Trace Recording & Replay](../../plans/epics/EP40-debug-trace-recording-and-replay.md)

**Architecture**:
[Seeding & Replay — One Domain-Replay Tool](../../../product-documentation/architecture/20260711T140330Z-engineering-seeding-replay-domain-replay-tool.md) (D2, D3, D4 — replay half) ·
[`srs-demo` Learning Authority, Review Authority & Debug-Trace Contract](../../../product-documentation/architecture/20260708T125551Z-engineering-srs-demo-learning-authority-and-debug-trace.md) (Pillar 4 — the *replayable* transition channel).

---

## 1. Feature Overview

This DS covers the **consume** side of EP40 — everything server-side that turns a captured session into an
engine-reproducible fixture. It is buildable and testable against transition-only artifacts **before** the
`srs-demo` recording UI (DS02) exists, so it lands first.

- **PH01 — Shared transition core & artifact contract.**
  - **ST01** lifts the transition logic inlined in `POST /api/answer`
    ([answer.ts](../../../apps/server/src/routes/answer.ts) lines 77–111) into a pure, dependency-injected
    `applyAnswer(store, event, thresholds) → { before, after, graduated }`. The route calls it; replay calls
    the same function. This is the golden-master property claimed **by construction** (ADR D3), not by a second
    implementation. Pure extraction — **no behaviour change**.
  - **ST02** defines the **self-contained artifact contract** (lazy per-word baseline + ordered inputs +
    resolved thresholds + appearance context) and adds **resolved-threshold capture on the write path** so a
    transition record carries the config it was computed under — the one input `answer_events` lacks today
    (ADR D4). Contract types live in the composition layer (`apps/server`), **not** `@gll/api-contract`.
- **PH02 — Replay tool.**
  - **ST03** is the `replayArtifact` core: seed a fresh `:memory:` `SqliteLearningStore` (no new store impl)
    or an existing DB from the baseline, **fold** the recorded inputs through `applyAnswer`, and **diff** each
    recomputed `WordState` against the recorded `afterState`, reporting the **first divergence** with its
    inputs. Deterministic by construction — the transition path reads no clock and no RNG (ADR D2).
  - **ST04** is the two thin shells over the core: a `replay <artifact>` mode on the existing seed CLI
    ([seed/cli.ts](../../../apps/server/src/seed/cli.ts)) that prints a step table and exits non-zero on first
    divergence, and a Vitest fixture runner that turns a dropped-in artifact into a regression assertion.

**Placement note (ADR D6).** The ADR's eventual home for the shared core is `@gll/srs-fixtures`. That
extraction is **YAGNI-gated and out of scope for EP40** (the epic's follow-up EP42+). EP40's replay tool lands
**in `apps/server`** alongside the existing seeder; the pure/process seam (`applyAnswer`, `replayArtifact`,
artifact types = pure; CLI argv/db-path = shell) is drawn now so the later lift-into-package is mechanical.

**Not in this DS**: recording (correlation-id wiring, appearance channel, Start/Stop UI, nav-guard) → DS02.
Retiring the client-snapshot hack → DS02 (ST09). `cli-demo-db` live-loop parity, `@gll/srs-fixtures`
extraction, seeded-RNG appearance recompute → deferred (epic Out of scope).

---

## 2. Core Requirements

| Requirement | Decision | Rationale |
| --- | --- | --- |
| Transition unit | Extract `applyAnswer(store, event, thresholds) → { before, after, graduated }`; both `/api/answer` and replay call it | Parity by construction (ADR D3); no second transition impl |
| `applyAnswer` boundary | Reads prior state via `store.getAllWordStates`, folds via **`processRecheckResult`** (exact current branch), **upserts** `after`, returns `{ before, after, graduated }` | The store write is how the fold accumulates across a stream; keeps the route's byte-behaviour identical |
| What stays in the route | `answer_events` append (transition channel) + review-card seeding remain **around** `applyAnswer` in `answer.ts` | Those are side-channels replay does not reproduce; only the state transition is shared |
| `thresholds` shape | `{ masteryThreshold: number; streakThresholds: StreakThresholds }` — resolved per-user by the route (`FIXED_SYSTEM` + `resolveUserThresholds`) and passed in | Config is server-owned and per-user (EP41); `applyAnswer` stays pure of config resolution |
| Resolved-threshold capture | Add `resolvedThresholds` to `AnswerEventRecord` + a `resolved_thresholds` JSON column on `answer_events` | The transition depends on per-user config the raw row does not record (ADR D4); the replay input the artifact needs |
| Artifact home | Artifact types + zod parser in `apps/server` (composition layer), **not** `@gll/api-contract` | Contract carries wire DTOs only; the artifact is a tool contract, server-owned (ADR D6, EP37-DS01 precedent) |
| Artifact self-containment | Carries `thresholds` + lazy per-word `baseline` + ordered `inputs` (`wordId, correct, latencyMs, recheck, recordedAfter`) + `appearance` context; replays with **no origin-DB dependency** | ADR D4 — a ~25 KB file reproduces the exact `WordState` on any machine |
| Baseline laziness | One snapshot per **touched** word = its `WordState` at **first appearance** (the first input's `beforeState`); brand-new words (before = null) contribute **no** baseline entry | Seeds a fresh store minimally; absent entry ⇒ store returns null ⇒ `applyAnswer` matches the live first-sighting path |
| Replay determinism | Fold reads no clock/RNG (`processRecheckResult` is pure); a faithful session diffs **byte-exact** (golden-master) | ADR D2; the honest determinism scope (transition channel only) |
| Replay store | Reuse `SqliteLearningStore` over `better-sqlite3 ':memory:'` (fresh) or an existing db-path — **no new store impl** | ADR D2 — one store interface, one write sink |
| Divergence report | Stop at and report the **first** step where `after ≠ recordedAfter`: `{ step, input, expected, actual }` | The pinpointed bug is the first divergence with its exact inputs (ADR D2) |
| Appearance in replay | Carried as **read-only context**; **not** folded/recomputed | ADR D4/D3 — orchestration recompute is explicitly deferred |
| CLI surface | `replay <artifact>` mode on the existing seed CLI; `--fresh` (default, `:memory:`) / `--existing-db`; **zero-config** db-path (`defaultDbPath`) | ADR D6 — thin per-app wrapper, preserves the zero-config-db hard requirement; no generic `--db-path` flag |
| CLI exit code | Prints step table; exits **non-zero** on first divergence, `0` on a clean replay | Usable as a scriptable reproduction gate |
| Fixture runner | A Vitest helper: drop an artifact in a fixtures dir → assert `replayArtifact(...).ok` | Captured artifacts double as free regression fixtures (ADR "golden-master by construction") |

---

## 3. Data Structures

**`apps/server/src/replay/artifact.ts` — the self-contained artifact contract (server-owned; DS02's browser
recorder writes JSON matching this, mirroring the `AppConfig` local-shape precedent):**

```typescript
import type { WordState } from '@gll/srs-engine-v2';
// `ResolvedThresholds` is owned by @gll/db (so the transition record can carry it without an
// app→package import); the artifact re-imports it rather than declaring a second copy.
import type { ResolvedThresholds } from '@gll/db';

/** One recorded transition input, stitched to its served question by correlationId, in answer_events id order. */
export interface TransitionInput {
  correlationId: string;
  wordId: string;
  correct: boolean;
  latencyMs: number;
  recheck: boolean;
  recordedAfter: WordState;   // the authoritative afterState this step is diffed against
}

/** Recorded orchestration context — read-only, NOT recomputed (ADR D4). Shape owned by DS02. */
export interface AppearanceEvent {
  correlationId: string;      // stitches to the transition it preceded (null-tolerant for un-answered served questions)
  kind: 'pool-selected' | 'question-served' | 'recheck-triggered' | 'shelving';
  at: string;                 // ISO
  data: unknown;              // channel-specific payload (DS02)
}

/** A self-contained, DB-independent replay artifact. */
export interface ReplayArtifact {
  version: 1;
  meta: {
    createdAt: string;                    // ISO
    sessionId: string;                    // the recording session (DS02)
    phase: 'learning' | 'review';         // scope; word-transition replay consumes the Learning stream
    originUserId: string;                 // informational only — replay injects its own userId
  };
  thresholds: ResolvedThresholds;         // uniform across the session; asserted on parse
  baseline: WordState[];                  // lazy: one per touched word that had prior state
  inputs: TransitionInput[];              // ordered
  appearance: AppearanceEvent[];          // context
}

/** zod schema `replayArtifactSchema` validates the above; `parseArtifact(json): ReplayArtifact` throws on a bad file. */
```

**`apps/server/src/routes/answer.ts` → `apps/server/src/learning/apply-answer.ts` — the extracted core:**

```typescript
import { processRecheckResult, isMastered, type WordState } from '@gll/srs-engine-v2';
import type { ILearningStore, ResolvedThresholds } from '@gll/db';

export interface AnswerEvent {
  wordId: string;
  correct: boolean;
  latencyMs: number;   // carried for the record; the transition itself does not read it
  recheck: boolean;
}

export interface AppliedAnswer {
  before: WordState | null;
  after: WordState;
  graduated: boolean;
}

/** The store surface the transition needs — read prior state, persist the result. */
export type LearningTransitionStore = Pick<ILearningStore, 'getAllWordStates' | 'upsertWordState'>;

/**
 * The single Learning state transition. Reads prior state, folds the answer through the exact pure
 * recheck branch, persists `after`, and reports graduation. The live route and artifact-replay both
 * call this — parity by construction (ADR D3). Pure of clock/RNG ⇒ deterministic replay (ADR D2).
 */
export async function applyAnswer(
  store: LearningTransitionStore,
  userId: string,
  event: AnswerEvent,
  thresholds: ResolvedThresholds,
): Promise<AppliedAnswer> {
  const runState = await store.getAllWordStates(userId);
  const before = runState.get(event.wordId) ?? null;

  const { runState: next } = processRecheckResult(
    event.wordId,
    event.correct,
    runState,
    event.recheck ? new Set([event.wordId]) : new Set(),
    new Set(),
    thresholds.masteryThreshold,
    thresholds.streakThresholds,
  );
  const after = next.get(event.wordId)!;
  await store.upsertWordState(userId, after);

  const wasMastered = before ? isMastered(before, thresholds.masteryThreshold) : false;
  const graduated = !wasMastered && isMastered(after, thresholds.masteryThreshold);
  return { before, after, graduated };
}
```

**`packages/db` — `answer_events` gains the resolved config (extends EP37-DS01's table/record):**

```typescript
// schema.ts — additive column (no FKs, per schema ADR)
resolvedThresholds: text('resolved_thresholds').notNull(),  // JSON ResolvedThresholds; the config the row was computed under

// types/answer-event-store.ts — AnswerEventRecord gains:
resolvedThresholds: ResolvedThresholds;
```

**`apps/server/src/replay/replay-artifact.ts` — the core + diff:**

```typescript
export interface ReplayDivergence {
  step: number;              // 0-based index into inputs
  input: TransitionInput;
  expected: WordState;       // input.recordedAfter
  actual: WordState;         // recomputed
}

export interface ReplayResult {
  ok: boolean;
  steps: number;             // steps executed (== inputs.length when ok)
  divergence: ReplayDivergence | null;
}

/**
 * Seed `store` from the artifact baseline, fold every input through applyAnswer using the artifact's
 * OWN thresholds, and diff each recomputed WordState against recordedAfter. Stops at the first mismatch.
 */
export async function replayArtifact(
  artifact: ReplayArtifact,
  deps: { store: LearningStore; userId: string },
): Promise<ReplayResult>;
```

---

## 4. User Workflows

**Live route after extraction (ST01–ST02) — behaviour unchanged, one call factored out:**

```
POST /api/answer { wordId, correct, latencyMs, recheck? }   (x-correlation-id?)
  → thresholds = { FIXED_SYSTEM.masteryThreshold, resolveUserThresholds(user) }
  → { before, after, graduated } = applyAnswer(store, USER_ID, event, thresholds)
  → appendAnswerEvent({ ...before/after, resolvedThresholds: thresholds, correlationId, ... })   (fail-open)
  → if isMastered(after): seed review card if absent                                              (fail-open)
  → 200 { wordState: toPayload(after), graduated }
```

**Replay (ST03–ST04):**

```
pnpm seed replay <artifact.json> [--fresh | --existing-db]
  → parseArtifact(file)                                  (bad shape ⇒ exit 1, message)
  → store = SqliteLearningStore(:memory:  | defaultDbPath)
  → seed baseline: upsertWordState(userId, ws) for each baseline entry
  → for i, input in inputs:
       { after } = applyAnswer(store, userId, input, artifact.thresholds)
       if after ≠ input.recordedAfter:
          print step table up to i, mark divergence (expected vs actual, inputs) → exit 1
  → all match: print step table → "✓ replayed N steps, byte-exact" → exit 0

Vitest: replayArtifact(loadFixture('x.json'), { store: memStore(), userId }) ⇒ expect(result.ok).toBe(true)
```

---

## 5. Stories

### Phase 1: Shared transition core & artifact contract (EP40-PH01)

### EP40-ST01: Extract shared `applyAnswer`

**Scope**: `apps/server` — pure extraction, no behaviour change.
**Read List**: [apps/server/src/routes/answer.ts](../../../apps/server/src/routes/answer.ts), [apps/server/src/config/learning.ts](../../../apps/server/src/config/learning.ts), `packages/srs-engine-v2/src/**` (`processRecheckResult`, `isMastered`), `packages/db/src/sqlite-learning-store.ts`
**Tasks**:

- [x] Add `apps/server/src/learning/apply-answer.ts` with `applyAnswer`, `AnswerEvent`, `AppliedAnswer` (body = lines 77–111 of `answer.ts`, verbatim logic)
- [x] Rewrite `answer.ts` to build `thresholds`, call `applyAnswer`, and keep `appendAnswerEvent` + review seeding around it
      **Acceptance Criteria**:
- [x] `/api/answer` responses are **byte-identical** before/after the refactor (existing route tests unchanged and green)
- [x] `applyAnswer` imports no Hono/route/config-resolution code (pure of the composition layer); thresholds are injected
- [x] The recheck branch (frozen mastery/streak) still holds — a re-asked missed word bumps `seen`/`correct` only

### EP40-ST02: Artifact contract + resolved-threshold capture

**Scope**: `apps/server` artifact types/parser + `@gll/db` `answer_events` column.
**Read List**: [packages/db/src/types/answer-event-store.ts](../../../packages/db/src/types/answer-event-store.ts), `packages/db/src/schema.ts`, `packages/db/src/sqlite-answer-event-store.ts`, [.agents/changelogs/EP37--refactor-learning-authority/20260708T141610Z-EP37-DS01-server-learning-transition.md](../EP37--refactor-learning-authority/20260708T141610Z-EP37-DS01-server-learning-transition.md)
**Tasks**:

- [x] Add `resolved_thresholds` (JSON, `notNull`) to `answer_events`; add `resolvedThresholds` to `AnswerEventRecord`; persist/read it in `SqliteAnswerEventStore`; have `answer.ts` pass the resolved `thresholds`
- [x] Add `ResolvedThresholds` to `@gll/db` (owned there so the transition record carries it without an app→package import; `apply-answer.ts` needs it too)
- [x] Add `apps/server/src/replay/artifact.ts`: `ReplayArtifact`, `TransitionInput`, `AppearanceEvent` (importing `ResolvedThresholds` from `@gll/db`), `replayArtifactSchema` (zod, reusing the `@gll/api-contract` zod dep), `parseArtifact`
      **Acceptance Criteria**:
- [x] Every `/api/answer` row now carries the `resolvedThresholds` it was computed under; existing rows/tests migrate cleanly (init/migration as the repo does it)
- [x] `parseArtifact` accepts a well-formed artifact and **rejects** (throws, clear message) missing thresholds, a baseline/input `WordState` shape error, or a non-uniform `thresholds`
- [x] Artifact types are **not** exported from `@gll/api-contract`

### Phase 2: Replay tool — consume (EP40-PH02)

### EP40-ST03: `replayArtifact` core + diff

**Scope**: `apps/server/src/replay` — the fold + diff. Reuses `SqliteLearningStore`.
**Read List**: `apps/server/src/learning/apply-answer.ts` (ST01), `apps/server/src/replay/artifact.ts` (ST02), `packages/db/src/sqlite-learning-store.ts`, [seed/apply-scenario.ts](../../../apps/server/src/seed/apply-scenario.ts) (`:memory:` / db construction precedent)
**Tasks**:

- [x] Add `replay-artifact.ts`: seed baseline via `upsertWordState`, fold `inputs` through `applyAnswer` with `artifact.thresholds`, diff `after` vs `recordedAfter`, return `ReplayResult` stopping at the first `ReplayDivergence`
- [x] Add an in-memory store factory (`better-sqlite3 ':memory:'` + schema init) for `--fresh` replay
      **Acceptance Criteria**:
- [x] A faithful artifact replays **byte-exact** (`ok: true`, `steps === inputs.length`, `divergence === null`) on a fresh `:memory:` store — **no** dependency on any origin DB
- [x] A tampered `recordedAfter` at step *k* yields `ok: false`, `divergence.step === k`, and correct `expected`/`actual`/`input`
- [x] Replay is deterministic: the same artifact yields the identical result across runs (no clock/RNG read)
- [x] A word with no baseline entry (brand-new) replays correctly (store returns null → matches live first-sighting)

### EP40-ST04: CLI replay mode + Vitest fixture runner

**Scope**: `apps/server` — thin shells over the ST03 core.
**Read List**: [apps/server/src/seed/cli.ts](../../../apps/server/src/seed/cli.ts), [apps/server/src/seed/run-seed.ts](../../../apps/server/src/seed/run-seed.ts), [apps/server/src/config/db-path.ts](../../../apps/server/src/config/db-path.ts), `apps/server/src/seed/__tests__/**`
**Tasks**:

- [x] Add a `replay <artifact>` mode to the seed CLI dispatch: `--fresh` (default) / `--existing-db` (zero-config `defaultDbPath`); parse → replay → print step table → exit `0`/`1`
- [x] Add a Vitest fixture runner (`replay/__tests__/fixtures/*.json` + a helper that asserts `replayArtifact(...).ok`)
      **Acceptance Criteria**:
- [x] `pnpm seed replay <faithful>` prints the step table and exits `0`; `pnpm seed replay <divergent>` prints up to the divergence and exits **non-zero**
- [x] A malformed/missing artifact file exits `1` with a readable message (not a stack trace)
- [x] Dropping a captured artifact into the fixtures dir makes it a passing regression assertion with no per-fixture code
- [x] The `pnpm seed <scenario>` path (existing seeding) is unaffected (regression)

## 6. Success Criteria

1. `applyAnswer` is the **single** Learning transition; `/api/answer` and `replayArtifact` both call it — no second implementation, and `/api/answer` behaviour is byte-identical to before the extraction.
2. `answer_events` durably records the `resolvedThresholds` each transition used — the one replay input the raw row lacked.
3. A captured artifact is self-contained (baseline + inputs + thresholds + appearance) and replays on a fresh `:memory:` DB with **zero** origin-DB dependency.
4. Replay recomputes the `WordState` trajectory and reports the **first** divergence with its inputs; a faithful session is byte-exact (golden-master).
5. `pnpm seed replay <artifact>` reproduces the trajectory and exits non-zero on divergence; the same artifact runs as a Vitest regression fixture.
6. Artifact/replay types live in `apps/server`, not `@gll/api-contract`; the pure-core / process-shell seam is drawn for the deferred `@gll/srs-fixtures` lift. No type errors.
