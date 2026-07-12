# EP40-DS02: Debug-Trace Recording — Channels, Sessions & Artifact Assembly (Phases 3–5) Specification

**Date**: 20260712T004215Z
**Status**: Accepted
**Epic**: [EP40 - Debug-Trace Recording & Replay](../../plans/epics/EP40-debug-trace-recording-and-replay.md)

**Architecture**:
[`srs-demo` Learning Authority, Review Authority & Debug-Trace Contract](../../../product-documentation/architecture/20260708T125551Z-engineering-srs-demo-learning-authority-and-debug-trace.md) (Pillar 4 — scoped sessions, one correlation id, transition + appearance channels) ·
[Seeding & Replay — One Domain-Replay Tool](../../../product-documentation/architecture/20260711T140330Z-engineering-seeding-replay-domain-replay-tool.md) (D4 self-contained artifact, D7 retire the hack).

**Depends on**: [EP40-DS01](20260712T004215Z-EP40-DS01-shared-transition-core-and-replay-tool.md) — the `ReplayArtifact` contract and the `resolved_thresholds` capture. Build DS01 first; DS02 produces the artifacts DS01 consumes.

---

## 1. Feature Overview

DS01 built the **consume** side (replay). DS02 builds the **record** side in `srs-demo`: the tester hits
**Start**, plays a session, and downloads a **self-contained artifact** they can hand to
`pnpm seed replay <artifact>`. It realizes the recording half of Pillar 4.

- **PH03 — Recording channels.**
  - **ST05 — Correlation id + transition channel.** One `correlationId` is generated **client-side per served
    question** and carried `question served → POST /api/answer → server transition`, so the authoritative
    per-answer `WordState` change (already durable in `answer_events`, now with DS01's `resolvedThresholds`)
    is a **correlated** record. The server already reads `x-correlation-id` and stores it — this DS makes the
    client actually **send** it and remember the ordered id list for the active recording.
  - **ST06 — Appearance channel.** Instrument `srs-demo` orchestration to record, as **read-only context**,
    each appearance decision (active-pool selection, question served, recheck trigger, shelving/rebalance),
    each stitched to the `correlationId` of the question it concerns. **Recorded, not recomputed** (ADR D4).
- **PH04 — Recording UX: sessions & scoping.**
  - **ST07 — Start/Stop + artifact assembly & download.** A Start/Stop control; a **phase-scoped** session
    (Learning *or* Review) that **spans decks**; on Stop, assemble the two channels + the server's transition
    slice (baseline + inputs + `resolvedThresholds`) into one DB-independent artifact and download it.
  - **ST08 — Nav-guard soft-confirm + Learning↔Review crossing finalize.** A mid-quiz cross-navigation raises
    a **soft-confirm** (Cancel default) that **finalizes and downloads** the active recording before leaving;
    the Learning↔Review crossing **finalizes** rather than silently dropping. Recording never leaks across the
    phase boundary and never loses what it had.
- **PH05 — Cleanup. ST09** removes the superseded client-snapshot hack (`useQuizDebugLog.ts`, the
  `debug-logs.ts` file-sink route, and the snapshot half of `PoolDebugPanel.vue`).

**Scope honesty.** The **replayable** artifact is the **Learning** phase (`/api/answer` word transitions,
direction-blind — the only channel with the golden-master property, DS01). A **Review**-phase session records
the same two channels against the review-answer path as **context**; Review *replay* is not in EP40 (DS01 is
Learning-only). What both phases share is the **session boundary + finalize** behaviour (ST07/ST08). Sentence
answers do not hit the transition path (ADR D4) and are appearance-context only.

**Not in this DS**: the API-boundary channel (request/response/errors at `fetch`) — Pillar 4 lists it but the
epic defers it; seeded-RNG appearance recompute (ADR D3, deferred); `@gll/srs-fixtures` extraction (EP42+).

---

## 2. Core Requirements

| Requirement | Decision | Rationale |
| --- | --- | --- |
| Recording home | New `apps/srs-demo/src/composables/useDebugRecording.ts`; `App.vue` owns Start/Stop + finalize wiring | One owner for session state, id issuance, appearance buffer, assemble+download — replaces the scattered `useQuizDebugLog` calls |
| Correlation id | `crypto.randomUUID()` per **served question**, held as "current correlationId" until the next question is served | Pillar 4 — one id stitches question → answer → transition; per-question is the finest scope the transition channel keys on |
| Transport | `postAnswer` sends `x-correlation-id: <id>`; the server already reads it into `answer_events` | Server side exists (answer.ts line 43); this closes the client half. No contract/body change |
| Session id | `crypto.randomUUID()` at **Start**; tags the recording and every appearance event | Scoped-session primitive (Pillar 4); also the artifact `meta.sessionId` |
| Session state | `idle → recording → (finalizing) → idle`; a session is **Learning** or **Review** (its phase captured at Start) and **spans decks** | Phase-scoped, deck-spanning (epic ST07); phase decides which appearance/transition path is captured |
| Appearance capture | Emit `AppearanceEvent` at: active-pool selection (`nextActivePool`), question served, recheck trigger, shelving/rebalance — each with the current `correlationId` | The "wrong word appeared" scenario, as read-only context (ADR D4); replaces the batch-snapshot hack with per-decision, correlated records |
| Capture gating | Appearance/id issuance are **no-ops unless recording** | Situational, not always-on (Pillar 4); zero cost off the recording path |
| Transition slice source | On finalize, `POST /api/debug/transitions { correlationIds }` returns `{ baseline, inputs, thresholds }` assembled **server-side** from `answer_events` | The server owns the `WordState`/threshold rows; the browser does no `WordState` arithmetic — it only decorates with appearance + meta |
| Baseline | Server derives lazy per-word baseline = first `beforeState` per touched word (skips brand-new words) | ADR D4; matches DS01's replay seed expectation |
| Assembly | Client merges `{ baseline, inputs, thresholds }` + its `appearance` + `meta` into a `ReplayArtifact` (DS01 shape) and downloads JSON via a Blob | Self-contained, DB-independent (ADR D4); the JSON is the contract DS01's `parseArtifact` validates |
| Finalize triggers | (a) explicit Stop, (b) nav-guard soft-confirm on mid-quiz cross-nav, (c) Learning↔Review crossing | Recording never silently dropped; never leaks across the phase boundary (epic ST08) |
| Nav-guard | Mid-quiz cross-navigation → **soft-confirm** (Cancel is default); confirm ⇒ finalize+download+navigate, cancel ⇒ stay | Protects an in-flight recording without blocking navigation (epic ST08) |
| Empty session | Stop/finalize with **zero** transitions downloads nothing and resets to `idle` (a toast, no empty file) | No junk artifacts; a recording with no answers has nothing to replay |
| Cleanup | Delete `useQuizDebugLog.ts`, `routes/debug-logs.ts` (+ `app.ts` registration), and `PoolDebugPanel.vue`'s snapshot half; drop `logDeck*/logBatch*/flushLogs` calls | Superseded by correlated recording + transition-recompute replay (ADR D7) |

---

## 3. Data Structures

**`apps/srs-demo/src/composables/useDebugRecording.ts` — the recorder (local shapes; the downloaded JSON
mirrors DS01's `ReplayArtifact`, the `AppConfig` local-shape precedent):**

```typescript
type Phase = 'learning' | 'review';
type RecordingState = 'idle' | 'recording' | 'finalizing';

interface AppearanceEvent {
  correlationId: string | null;   // the question this decision concerns; null for a decision before any serve
  kind: 'pool-selected' | 'question-served' | 'recheck-triggered' | 'shelving';
  at: string;                     // ISO
  data: unknown;                  // kind-specific: pool ids, servedWordId/direction, recheck wordId, shelved/unshelved ids
}

interface UseDebugRecording {
  state: Ref<RecordingState>;
  isRecording: ComputedRef<boolean>;
  phase: Ref<Phase | null>;

  start(phase: Phase): void;                 // sessionId = randomUUID(); clears buffers
  nextCorrelationId(): string;               // issue + set "current" (no-op returns '' when idle)
  currentCorrelationId(): string | null;
  recordAppearance(e: Omit<AppearanceEvent, 'at'>): void;   // no-op unless recording
  finalizeAndDownload(): Promise<'downloaded' | 'empty' | 'idle'>;  // assemble → Blob download → reset
  cancel(): void;                            // reset to idle without download (not used by the guard)
}
```

**Transport — `useStore.postAnswer` gains the id:**

```typescript
export async function postAnswer(req: AnswerRequest, correlationId?: string): Promise<WordState> {
  const res = await fetch('/api/answer', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(correlationId ? { 'x-correlation-id': correlationId } : {}),
    },
    body: JSON.stringify(req),
  });
  /* ...unchanged... */
}
```

**Server assembly endpoint — `apps/server/src/routes/debug.ts` (new; registered in `app.ts`):**

```typescript
// POST /api/debug/transitions  { correlationIds: string[] }  → the transition slice of the artifact
interface DebugTransitionsResponse {
  thresholds: ResolvedThresholds;   // asserted uniform across the rows (DS01 shape)
  baseline: WordState[];            // first beforeState per touched word (skips brand-new)
  inputs: TransitionInput[];        // one per answer_events row, ordered by the request's id order
}
// Reads answer_events by correlationId for the current user; maps afterState → recordedAfter.
// 400 if a non-uniform thresholds set is spanned (a recording must not cross a config change).
```

**`ReplayArtifact` assembled and downloaded (DS01 contract) — the client adds `meta` + `appearance`:**

```
{ version: 1,
  meta: { createdAt, sessionId, phase, originUserId },
  thresholds, baseline, inputs,     // from POST /api/debug/transitions
  appearance }                      // from the client buffer
```

---

## 4. User Workflows

**Record → replay (Learning):**

```
[Start · Learning]  → recorder.start('learning')  (sessionId issued)
  play, per question:
     serve  → cid = recorder.nextCorrelationId(); recordAppearance('question-served', {cid, wordId, direction})
     answer → postAnswer({wordId, correct, latencyMs, recheck}, cid)   // x-correlation-id: cid
              server: applyAnswer → answer_events{ cid, before, after, resolvedThresholds }  (DS01)
     orchestration → recordAppearance('pool-selected' | 'recheck-triggered' | 'shelving', {cid, ...})
[Stop]  → finalizeAndDownload():
     POST /api/debug/transitions { correlationIds: [...issued in order] }
        → { thresholds, baseline, inputs }
     assemble ReplayArtifact { meta, thresholds, baseline, inputs, appearance }
     download <sessionId>.json ; reset → idle
  → hand to:  pnpm seed replay <sessionId>.json   (DS01)
```

**Cross-navigation while recording (ST08):**

```
mid-quiz nav to another phase (Learn↔Review) OR home, batch in progress
  → soft-confirm "Finish and download the recording before leaving?" [Cancel*] [Finish & leave]
      Cancel  → stay (recording continues)
      Finish  → finalizeAndDownload() → then existing navTo() (which already flushes the partial batch)
  (not recording → today's navTo behaviour, unchanged)
```

---

## 5. Stories

### Phase 3: Recording channels (EP40-PH03)

### EP40-ST05: Correlation id + transition-channel wiring

**Scope**: `srs-demo` — issue + transport the id; server side already persists it.
**Read List**: [apps/srs-demo/src/composables/useStore.ts](../../../apps/srs-demo/src/composables/useStore.ts), [apps/srs-demo/src/composables/useLearningSession.ts](../../../apps/srs-demo/src/composables/useLearningSession.ts) (the `postAnswer` loop ~line 384), [apps/server/src/routes/answer.ts](../../../apps/server/src/routes/answer.ts) (header read, line 43)
**Tasks**:

- [x] Add `useDebugRecording.ts` skeleton: session state, `sessionId`, `start/cancel`, `nextCorrelationId`/`currentCorrelationId` (no-op when idle)
- [x] `postAnswer(req, correlationId?)` sends `x-correlation-id`; `useLearningSession` passes the current id
      **Acceptance Criteria**:
- [x] While recording, each served question has a distinct `correlationId`; its `/api/answer` row in `answer_events` carries that id (and DS01's `resolvedThresholds`)
- [x] While **not** recording, `postAnswer` sends no `x-correlation-id` and behaviour is unchanged (regression)
- [x] The recorder holds the **ordered** list of ids issued during the session

### EP40-ST06: Appearance-channel recording

**Scope**: `srs-demo` — instrument orchestration as read-only context.
**Read List**: [apps/srs-demo/src/composables/useLearningSession.ts](../../../apps/srs-demo/src/composables/useLearningSession.ts) (`nextActivePool` ~451, recheck ~355, `logBatch*`/`logDeck*` call sites), [apps/srs-demo/src/composables/useShelving.ts](../../../apps/srs-demo/src/composables/useShelving.ts)
**Tasks**:

- [x] Add `recordAppearance` (no-op unless recording); emit at pool selection, question served, recheck trigger, shelving/rebalance, each stitched to the current `correlationId`
- [x] Wire the same call sites the old `logDeckStarted/logBatch*` occupied, but as per-decision correlated events (not batch snapshots)
      **Acceptance Criteria**:
- [x] A recorded session's appearance buffer contains a correlated entry per orchestration decision, each with `kind`, `at`, `correlationId`, and a `kind`-appropriate payload
- [x] Appearance capture is **read-only** — removing/ignoring it does not change any `WordState` or orchestration outcome
- [x] Off the recording path, no appearance events are produced (no cost)

### Phase 4: Recording UX — sessions & scoping (EP40-PH04)

### EP40-ST07: Start/Stop session + artifact assembly & download

**Scope**: `srs-demo` UI + one server assembly endpoint.
**Read List**: [apps/srs-demo/src/App.vue](../../../apps/srs-demo/src/App.vue) (screen state, `navTo`, `flushLogs`), [apps/srs-demo/src/components/NavMenu.vue](../../../apps/srs-demo/src/components/NavMenu.vue), [apps/server/src/routes/answer.ts](../../../apps/server/src/routes/answer.ts), `apps/server/src/app.ts`, DS01 `apps/server/src/replay/artifact.ts`
**Tasks**:

- [x] `POST /api/debug/transitions { correlationIds }` → `{ thresholds, baseline, inputs }` from `answer_events` (400 on non-uniform thresholds); register in `app.ts`
- [x] `finalizeAndDownload()`: fetch the slice, assemble `ReplayArtifact` (add `meta` + `appearance`), download `<sessionId>.json`; empty session ⇒ toast + reset
- [x] A Start/Stop recording control (phase inferred from the current screen); session spans decks
      **Acceptance Criteria**:
- [x] Start → play across **two** decks → Stop downloads one artifact whose `inputs` span both decks
- [x] The downloaded artifact passes DS01 `parseArtifact` and replays **byte-exact** via `pnpm seed replay` (golden-master round-trip)
- [x] The artifact is self-contained — replays on a fresh `:memory:` DB with no origin-DB access
- [x] A Stop with zero transitions downloads nothing, shows a toast, and resets to `idle`

### EP40-ST08: Nav-guard soft-confirm + Learning↔Review crossing finalize

**Scope**: `srs-demo` UI — the `navTo` guard.
**Read List**: [apps/srs-demo/src/App.vue](../../../apps/srs-demo/src/App.vue) (`navTo` lines 125–143, `activeNav`), [apps/srs-demo/src/components/NavMenu.vue](../../../apps/srs-demo/src/components/NavMenu.vue)
**Tasks**:

- [x] In `navTo`, when recording and the target crosses the phase (or leaves a mid-quiz batch), raise a soft-confirm (Cancel default); confirm ⇒ `finalizeAndDownload()` then proceed (existing partial-batch flush stays), cancel ⇒ stay
- [x] Ensure a Learning↔Review crossing finalizes the active recording rather than carrying it across
      **Acceptance Criteria**:
- [x] Mid-quiz cross-nav while recording shows the soft-confirm with **Cancel** as default; Cancel keeps recording and stays
- [x] Confirm finalizes+downloads, then navigates; the recording never spans the Learning↔Review boundary
- [x] Not recording ⇒ `navTo` behaves exactly as today (partial-batch flush only; regression)

### Phase 5: Cleanup (EP40-PH05)

### EP40-ST09: Retire the client-snapshot debug hack

**Scope**: delete superseded code across `srs-demo` + `server`.
**Read List**: [apps/srs-demo/src/composables/useQuizDebugLog.ts](../../../apps/srs-demo/src/composables/useQuizDebugLog.ts), [apps/server/src/routes/debug-logs.ts](../../../apps/server/src/routes/debug-logs.ts), `apps/server/src/app.ts`, [apps/srs-demo/src/components/PoolDebugPanel.vue](../../../apps/srs-demo/src/components/PoolDebugPanel.vue), [apps/srs-demo/src/App.vue](../../../apps/srs-demo/src/App.vue) (`flushLogs`), `apps/srs-demo/src/composables/useLearningSession.ts` (`logDeck*/logBatch*`)
**Tasks**:

- [x] Remove `useQuizDebugLog.ts` and all `logDeckStarted/logBatchStarted/logBatchQuestions/logBatchResult/flushLogs` call sites; delete `routes/debug-logs.ts` + its `app.ts` registration; remove the snapshot half of `PoolDebugPanel.vue` and `App.vue`'s `flushLogs`
- [x] Update/remove the tests that referenced the old logger
      **Acceptance Criteria**:
- [x] No reference to `useQuizDebugLog`, `/api/debug-logs`, or `flushLogs` remains in the codebase
- [x] `srs-demo` builds and the Learning/Review flows work with the snapshot hack gone; recording (ST07) is the only debug-trace path
- [x] `PoolDebugPanel.vue` retains any non-snapshot (live pool inspection) function it had, or is removed entirely if snapshot was its sole purpose

## 6. Success Criteria

1. One `correlationId` per served question stitches `question → /api/answer → answer_events`; while not recording, the answer path is byte-unchanged.
2. The appearance channel captures each orchestration decision as **read-only, correlated** context — never altering any `WordState` or orchestration outcome.
3. Start/Stop records a **phase-scoped** session that **spans decks**; Stop assembles and downloads one **self-contained** artifact.
4. The downloaded artifact passes DS01 `parseArtifact` and **replays byte-exact** via `pnpm seed replay` and as a Vitest fixture (the record→replay round-trip closes).
5. A mid-quiz cross-navigation **soft-confirms** (Cancel default) and **finalizes+downloads**; a recording never leaks across the Learning↔Review boundary and never silently drops what it had.
6. The old snapshot hack (`useQuizDebugLog` / `debug-logs.ts` / `PoolDebugPanel` snapshot) is gone. No type errors.
