# EP37-DS04: Client Cutover, Rollout Gate & Golden-Master (Phase 4) Specification

**Date**: 20260708T222525Z
**Status**: Accepted — **amended 20260708 (see Amendment 1)**
**Epic**: [EP37 - Refactor: Learning Authority](../../plans/epics/EP37-refactor-learning-authority.md)

---

## Amendment 1 (20260708) — Direct cutover; drop flag/shadow/golden-master gate

**Decision (supersedes the rollout mechanics below).** The staged rollout is replaced with a
**direct, unconditional server-authoritative cutover**, verified by **manual testing** rather than an
automated gate. What this changes vs the body of this spec:

- **No feature flag.** The `SERVER_AUTHORITY` flag (§2, §3, ST08) is **not introduced**. `srs-demo` always
  persists via `POST /api/answer`; there is no on/off/shadow selector.
- **No shadow parallel-run.** ST07's shadow compare-and-log stage is **dropped**. The client does not
  double-write or diff server-vs-local at runtime.
- **No golden-master merge gate.** ST09's automated byte-parity test is **not** built as a gate; parity is
  instead confirmed by manual verification of the running app. (Parity still holds *by construction* — both
  sides fold the same `processRecheckResult` with the same config.)
- **Legacy client path removed at the call site.** The batch-end `saveWordState` loop is **deleted** from
  `finishBatchAndTransition` and replaced by the ordered `/api/answer` replay. `POST /api/state/word` and
  `saveWordState` remain defined but are **no longer reached** from the answer flow (no off-switch retained).

**Retained unchanged (the correctness core):** recheck as a **wire fact** — `AnswerRequest.recheck`, the
server applying `processRecheckResult` branched on it, the `answer_events.recheck` column, and the client
sourcing the bit via the pure `classifyRechecks(results, pre-advance recheckPending)`. Without this the
server would advance mastery on a re-asked miss and diverge from today's behaviour. The §2 recheck
reconciliation and its ADR touch (below) stand.

**Implementation note:** `WordQuizResult` carries no latency, so the client replay sends `latencyMs: 0`
(diagnostics-only; never touches the transition).

**As-built story mapping:** ST07 lands as the recheck reconciliation only (contract + server + `answer_events`
+ `classifyRechecks`), no shadow. ST08 lands as the flagless replay cutover. ST09 is **not implemented**.

---

**Architecture**:
[`srs-demo` Learning Authority, Review Authority & Debug-Trace Contract](../../../product-documentation/architecture/20260708T125551Z-engineering-srs-demo-learning-authority-and-debug-trace.md) — **Rollout & safety** (client cutover + feature flag + shadow parallel-run + golden-master gate). Builds on [DS01](20260708T141610Z-EP37-DS01-server-learning-transition.md) (`/api/answer` + transition channel), [DS02](20260708T171133Z-EP37-DS02-cross-table-integrity.md) (integrity), [DS03](20260708T195919Z-EP37-DS03-server-review-seeding.md) (Review seeding).

---

## 1. Feature Overview

This DS covers **Phase 4 (EP37-PH04)**: flip `srs-demo` from client-authoritative Learning
(compute-then-`POST /api/state/word`) to **server-authoritative** (`POST /api/answer` owns the transition),
behind a feature flag that **ships on by default**, gated by a **golden-master parity test** and preceded by
a **shadow parallel-run**. The legacy client-compute path is retained as an off-switch escape hatch.

**The recheck reconciliation (decided; see §2).** Investigation for this DS surfaced a parity blocker: the
client folds each answer through [`processRecheckResult`](../../../packages/srs-engine-v2/src/engine/session.ts#L39-L68),
which has a **recheck branch** — when a word was just missed, its immediate re-ask bumps `seen`/`correct`
**only**, freezing mastery/streak/lapses. The server's `/api/answer` (DS01) runs **plain `updateRunState`**,
which would advance mastery on that same answer → the two `WordState` sequences diverge on any session with a
wrong answer, and the byte-identical golden-master could never pass. **Resolution (Option A):** the answer is
a **wire fact** — the client sends `recheck: boolean` on `AnswerRequest`, and the server applies the matching
transition by **reusing the same pure `processRecheckResult`** (not a reimplementation). `recheck` is a fact
about the event (like `correct`/`latencyMs`), not a threshold, so it honours DS01's "contract carries wire
facts, server owns policy" rule. This also closes a latent gap: `answer_events` must record `recheck` or the
transition-channel replay (DS01/debug-trace) reproduces the wrong `afterState`.

> **Note — light ADR touch.** The authority ADR says recheck *orchestration* stays client-side but never
> stated how the recheck *transition* reconciles with server authority. Recommend a one-paragraph amendment
> ratifying this rule (client emits the recheck fact; server applies it via the shared engine; pool state
> stays client-side). Not a blocker for DS04; noted for governance.

**Parity is achieved by construction, then proven.** Server and client run the **same pure functions**
(`processRecheckResult`) with the **same config values** (`LEARNING_CONFIG` ≡ client `CONFIG`). ST09 locks it.

**Not in this DS**: Review UI/flow (separate epic); adaptive-session orchestration stays client-side
(`advanceAdaptiveSession`, pools, recheck *trigger*, shelving); debug-trace app; orphan/graduated-without-card
cleanup. `POST /api/state/word` stays reachable via the flag-off path.

---

## 2. Core Requirements

| Requirement | Decision | Rationale |
| --- | --- | --- |
| Recheck as wire fact | Add `recheck?: boolean` to `AnswerRequest` (default `undefined` ≡ `false`) | The one bit the server needs for byte-parity; a fact, not policy (DS01 rule) |
| Server transition | `/api/answer` reuses `processRecheckResult(wordId, correct, runState, pending, reentered, T, thresholds)` with `pending = recheck ? new Set([wordId]) : new Set()` | Reuse the exact pure branch; zero reimplementation; parity by construction |
| Transition channel | Add a `recheck` column to `answer_events` (+ `AnswerEventRecord.recheck`) | Replay must reproduce the true `afterState`, incl. recheck answers |
| Graduation on recheck | No special case — recheck freezes mastery, so `graduated` stays `false` and seeding (DS03, absence-gated) no-ops | Falls out of reusing `processRecheckResult`; no new branch in the seed path |
| Client sources the recheck bit | New pure engine helper `classifyRechecks(results, recheckPending): boolean[]` (mirrors `processRecheckResult`'s guard: recheck iff word is in the batch-start `recheckPending`, consumed once). Client calls it with the **pre-advance** `sessionState.recheckPending` + `output.results` | Exact by construction (same guard, shared engine); no flag threaded through `updateMasteryState`/`advanceAdaptiveSession`; trivially unit-testable |
| Cutover mechanic | At the batch boundary, replay `output.results` (word results) through `POST /api/answer` **in order**, adopting the returned authoritative `WordState` | Same ordered input the client folds → identical result; keeps orchestration untouched |
| Orchestration | `advanceAdaptiveSession` still runs client-side for pool/recheck/shelving on its **locally-computed** runState (proven byte-equal to the server's) | Epic scope: orchestration stays client-side; server owns persistence |
| Feature flag | Client-side `SERVER_AUTHORITY` (default **on**; `import.meta.env` / localStorage override for the escape hatch) selects persistence path | ADR: ships on by default, legacy retained as off-switch |
| Legacy path | `POST /api/state/word` + the batch-end `saveWordState` loop retained, reachable only when the flag is **off** | Escape hatch; deleted in a later cleanup, not here |
| Shadow parallel-run (ST07) | Behind the flag in a **shadow** mode: replay to `/api/answer`, compare server vs local `WordState` per word, **log divergences** — truth stays the legacy path | De-risk before flipping truth; surfaces any residual drift |
| Golden-master (ST09) | A **pure test** (no browser): scripted representative sessions folded through (a) client compute and (b) the server transition path; assert **byte-identical** `WordState` sequences incl. recheck. Merge gate for the on-by-default flip | ADR gate; deterministic because both fold the same pure functions |
| Error handling | A failed `/api/answer` during cutover surfaces a typed error and does **not** silently drop the answer; the client does not overwrite local state with a divergent/failed result | Epic edge/limit acceptance criterion |

## 3. Data Structures

**`@gll/api-contract` (`src/srs.ts`) — one field:**

```typescript
export interface AnswerRequest {
  wordId: string;
  correct: boolean;
  latencyMs: number;
  recheck?: boolean; // true = re-confirmation of a prior miss (seen/correct-only bump). Default false.
}
```

**`@gll/db` — `answer_events` gains `recheck` (migration):**

```typescript
// schema.ts (added column)
recheck: integer('recheck', { mode: 'boolean' }).notNull().default(false),
// AnswerEventRecord gains: recheck: boolean;
```

**Server `/api/answer` transition (replaces the bare `updateRunState` call):**

```typescript
const { runState: next } = processRecheckResult(
  req.wordId, req.correct, runState,
  req.recheck ? new Set([req.wordId]) : new Set(), // recheckPending
  new Set(),                                       // recheckReentered (WordState-irrelevant here)
  LEARNING_CONFIG.masteryThreshold,
  LEARNING_CONFIG.streakThresholds,
);
const after = next.get(req.wordId)!;
```

**Engine — pure recheck classifier (new export, additive):** reproduces `processRecheckResult`'s branch
guard exactly, so the client can label each replayed answer without reimplementing recheck logic. Only
`recheckPending` matters (`recheckReentered` affects neither the branch nor the `WordState` delta).

```typescript
// packages/srs-engine-v2/src/engine/session.ts
/** Per-result recheck flags for a batch: true where the answer is a recheck
 *  (word in recheckPending, consumed once), matching processRecheckResult. */
export function classifyRechecks(results: WordQuizResult[], recheckPending: Set<string>): boolean[] {
  const pending = new Set(recheckPending);
  return results.map((r) => {
    if (pending.has(r.wordId)) { pending.delete(r.wordId); return true; }
    return false;
  });
}
```

**Client flag:**

```typescript
// srs-demo — default ON; legacy path only when explicitly disabled.
export const SERVER_AUTHORITY =
  (import.meta.env.VITE_SERVER_AUTHORITY ?? localStorage.getItem('serverAuthority') ?? 'on') !== 'off';
```

## 4. User Workflows

```
Batch ends (finishBatchAndTransition)
  → output = finishBatch(batchState)
  → preRecheck = sessionState.recheckPending          // capture BEFORE advancing
  → flags = classifyRechecks(wordResults, preRecheck) // per-result recheck labels
  → sessionState = advanceAdaptiveSession(...)        // client orchestration + local runState (unchanged)
  → if SERVER_AUTHORITY:
       for each word result in output.results (in order):
         POST /api/answer { wordId, correct, latencyMs, recheck: flags[i] }
           → server: processRecheckResult(...) → persist WordState → (DS03) seed on graduation
           ← adopt authoritative WordState
         on error → surface typed error, do NOT drop/overwrite the answer
     else (flag off / legacy):
       for each unique word: saveWordState(runState.get(wid))   // POST /api/state/word (unchanged)

Shadow mode (ST07, pre-flip):
  → do BOTH: legacy saveWordState is truth; ALSO replay to /api/answer and
    compare server WordState vs local runState; log divergences (no truth change)
```

## 5. Stories

### Phase 4: Client cutover & rollout gate (EP37-PH04)

### EP37-ST07: Recheck-aware transition + shadow parallel-run

**Scope**: The recheck reconciliation (contract + server + `answer_events` + engine flag surfacing) and a shadow harness that compares without changing the source of truth.
**Read List**: `packages/api-contract/src/srs.ts`, `apps/server/src/routes/answer.ts`, `packages/srs-engine-v2/src/engine/session.ts` (`processRecheckResult`, `updateMasteryState`), `packages/db/src/schema.ts`, `packages/db/src/answer-event-store.ts`, `apps/srs-demo/src/App.vue` (`finishBatchAndTransition`), `apps/srs-demo/src/composables/useStore.ts`
**Tasks**:

- [ ] Add `recheck?: boolean` to `AnswerRequest`; build `@gll/api-contract`
- [ ] Server `/api/answer`: replace bare `updateRunState` with `processRecheckResult` branched on `recheck`; keep `graduated`/seeding as-is
- [ ] `answer_events`: add `recheck` column (migration) + `AnswerEventRecord.recheck`; record it on every append
- [ ] Engine: add + export pure `classifyRechecks(results, recheckPending)` (mirrors `processRecheckResult`'s guard; additive, no behaviour change) with unit tests
- [ ] `srs-demo` shadow mode: capture pre-advance `recheckPending`, `classifyRechecks` → replay `output.results` to `/api/answer` with flags, compare to local `runState`, log divergences; legacy `saveWordState` stays the source of truth

**Acceptance Criteria**:

- [ ] For a scripted wrong→recheck sequence, server `WordState` equals the client's `processRecheckResult` output field-for-field (mastery frozen on the recheck)
- [ ] `answer_events` rows carry the correct `recheck` value; folding the pure engine over them (respecting `recheck`) reproduces the stored `afterState` sequence
- [ ] Shadow mode logs a divergence when (and only when) server and local `WordState` differ; no persisted-truth change while shadowing
- [ ] `POST /api/state/word` and existing flows unaffected

### EP37-ST08: Cutover to server authority (flag on by default)

**Scope**: Flip the persistence path; retain legacy behind the off-switch.
**Read List**: `apps/srs-demo/src/App.vue`, `apps/srs-demo/src/composables/useStore.ts`, ST07 output
**Tasks**:

- [ ] Add the `SERVER_AUTHORITY` flag (default on; env/localStorage override)
- [ ] When on: batch-end persistence is the ordered `/api/answer` replay (adopt authoritative `WordState`); drop the `saveWordState` loop from this path
- [ ] When off: the legacy `saveWordState` (`POST /api/state/word`) loop runs unchanged
- [ ] On a failed `/api/answer`, surface a typed error and do not overwrite local state with a failed/divergent result

**Acceptance Criteria**:

- [ ] With the flag **on** (default), answers persist via `/api/answer`; `review_cards` seed on graduation (DS03); `POST /api/state/word` is not called
- [ ] With the flag **off**, behaviour is byte-identical to today's legacy client-compute path (escape hatch verified)
- [ ] A simulated `/api/answer` failure surfaces an error and leaves the client from silently dropping the answer
- [ ] `srs-demo` frontend bundle imports no `ts-fsrs`

### EP37-ST09: Golden-master parity test (acceptance gate)

**Scope**: A deterministic parity test that is the merge gate for the on-by-default flip.
**Read List**: `packages/srs-engine-v2/src/engine/session.ts`, `apps/server/src/routes/answer.ts`, DS01 replay note
**Tasks**:

- [ ] Capture ≥1 representative session (mix of correct/wrong/**recheck**/graduation) as an ordered `(wordId, correct, recheck)` script
- [ ] Fold it through (a) the client compute path and (b) the server transition path (`processRecheckResult` replay, as `/api/answer` does)
- [ ] Assert **byte-identical** `WordState` sequences per word, including recheck answers and graduation points

**Acceptance Criteria**:

- [ ] The two folds are deep-equal for every word across the scripted session(s)
- [ ] A deliberately mismatched config (e.g. server `masteryThreshold` bumped) makes the test **fail** (guard proves the test bites)
- [ ] The test runs in CI without a browser and is required to pass before the flag ships on by default

## 6. Success Criteria

1. `srs-demo` persists Learning via `POST /api/answer` with the flag **on by default**; the legacy `POST /api/state/word` path is reachable only via the off-switch and reproduces today's behaviour exactly.
2. The recheck transition is byte-identical on server and client because both reuse `processRecheckResult`; `recheck` travels as a wire fact and is recorded in `answer_events` for faithful replay.
3. The shadow parallel-run reports divergences without changing the source of truth; the golden-master parity test passes and is the merge gate for the flip.
4. A failed `/api/answer` surfaces a typed error and never silently drops or corrupts an answer.
5. Graduation still seeds a `ReviewCard` (DS03) on the server path; the frontend imports no `ts-fsrs`.
6. No type errors; orchestration (`advanceAdaptiveSession`, pools, recheck trigger, shelving) remains client-side.
