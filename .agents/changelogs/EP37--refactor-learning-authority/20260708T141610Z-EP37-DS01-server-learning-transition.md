# EP37-DS01: Logging Foundation & Server-side Learning Transition (Phases 0–1) Specification

**Date**: 20260708T141610Z
**Status**: Accepted
**Epic**: [EP37 - Refactor: Learning Authority](../../plans/epics/EP37-refactor-learning-authority.md)

**Architecture**:
[`srs-demo` Learning Authority, Review Authority & Debug-Trace Contract](../../../product-documentation/architecture/20260708T125551Z-engineering-srs-demo-learning-authority-and-debug-trace.md) (Pillar 1 + transition channel) ·
[Logging Strategy — Injected `@gll/logger`](../../../product-documentation/architecture/20260708T143342Z-engineering-logging-strategy-injected-logger.md) (Phase 0). Reconciles with (does not fully satisfy) [Quiz Contract & Answer Authority](../../../product-documentation/architecture/20260313T000000Z-engineering-quiz-contract-answer-authority.md).

---

## 1. Feature Overview

This DS covers **Phase 0 (EP37-PH00)** and **Phase 1 (EP37-PH01)**:

- **PH00 — `@gll/logger` foundation.** A dedicated logger package (injected `Logger` port,
  `PinoLogger` wrapping [`pino`](https://github.com/pinojs/pino) + `NoopLogger`) so the I/O layer can
  report failures without reaching for `console`. `pino` is a dependency of `@gll/logger` only — its
  types never leak past the port. Built first because PH01's event store needs it.
- **PH01 — Server-side Learning transition.** Today `srs-demo` computes the new `WordState` in the
  browser and POSTs the *result* to a dumb `POST /api/state/word`. PH01 adds `POST /api/answer`, which
  accepts the *raw answer* (`{ wordId, correct, latencyMs }`), runs the **same pure
  `@gll/srs-engine-v2` transition** server-side, persists it, and returns the authoritative `WordState`
  plus whether the word **graduated**. It also lands the **transition channel**: an append-only,
  replayable `answer_events` record written on the same request.

**Two decisions locked by this DS:**

1. **Behavioral config is server-owned, not in the contract.** `LEARNING_CONFIG` (mastery/streak
   thresholds) lives in `@gll/server`. `@gll/api-contract` carries **only wire DTOs**. A frontend —
   web today, a mobile app later — renders UI and sends raw answers; it must never carry or version
   learning policy, or behaviour would diverge per client. This *is* server-authority.
   - **Config shape** is the engine's `SessionConfig`/`StreakThresholds` types (already owned by
     `@gll/srs-engine-v2`); the server holds only the *values*. No config type is added to the contract.
   - **No config class.** A class adds value only for derived values/methods, of which there are none;
     immutability + shape are already given by a typed `const`.
   - **No zod for config yet.** `LEARNING_CONFIG` is a hand-authored literal, so TypeScript already
     guarantees its shape — running zod over it validates nothing new. Adopt zod validation **only when
     config becomes env-driven** (parse+validate merged `process.env` at boot), reusing the existing
     `@gll/api-contract` zod dependency. Until then it stays a plain typed const.
2. **Logging is an injected port.** The store that logs in this DS (`SqliteAnswerEventStore`) takes
   `logger: Logger = new NoopLogger()`; the server injects a `PinoLogger`. Other `@gll/db` stores gain
   the param only when they actually log (RULES §4 — no speculative plumbing). Pure-logic packages take
   no logger.

**Not in this DS**: Review-card seeding on graduation (PH03), integrity rules (PH02), client cutover +
shadow harness (PH04), any orchestration move. `POST /api/state/word` is left **untouched** — the new
endpoint is additive so nothing breaks before the PH04 cutover.

**Parity is the point.** The server must reproduce the client's transition byte-for-byte, so it reuses
the identical pure functions and identical config values. No reimplementation.

---

## 2. Core Requirements

| Requirement | Decision | Rationale |
| --- | --- | --- |
| Logger package | New `@gll/logger`: `Logger` port + `PinoLogger` (wraps `pino`; structured JSON, level-filtered) + `NoopLogger` (default, no dep) | Logging ADR; `pino` behind the port, types don't leak past `Logger` |
| Logger injection | `SqliteAnswerEventStore` accepts `logger: Logger = new NoopLogger()`; server injects `PinoLogger`; other stores stay unchanged until they log; pure-logic packages take none | Silent/pure tests; app owns the sink; no speculative param (RULES §4) |
| Transition function | Server calls `updateRunState(runState, wordId, correct, thresholds)` from `@gll/srs-engine-v2` — the same function the client runs | Parity by construction, zero reimplementation (ADR pillar 1) |
| Config **home** | `LEARNING_CONFIG` in `@gll/server` (`src/config/learning.ts`); **not** in `@gll/api-contract` | Behavioral policy is server-authoritative; contract is wire-only; supports multiple frontends without drift |
| Config values | `masteryThreshold: 2`, `streakThresholds: { correctStreakThreshold: 2, wrongStreakThreshold: 2, maxMastery: 2 }` — equal to the current client `CONFIG` | Any drift breaks byte-parity / the golden-master gate |
| Client config during transition | Web client keeps its existing `CONFIG` until the PH04 cutover; parity enforced by the golden-master test, **not** by a shared constant | Avoids leaking policy into the contract; client copy is dead after cutover |
| Endpoint | New `POST /api/answer`; `POST /api/state/word` left **in place and unchanged** | Additive; legacy path is the PH04 escape hatch |
| Request shape | `{ wordId: string; correct: boolean; latencyMs: number }` | Raw answer; server derives state. `latencyMs` recorded now, consumed by review inference in PH03 |
| Response shape | `ApiResponse<AnswerResponse>`, `AnswerResponse = { wordState: WordStatePayload; graduated: boolean }` | Client adopts authoritative state; `graduated` is the PH03 seeding trigger |
| "Graduated" definition | `!isMastered(before, masteryThreshold) && isMastered(after, masteryThreshold)` (missing prior word = mastery 0) | Graduation = crossing the threshold on *this* answer; `newlyMastered ≡ graduated` here |
| Reading prior state | Reuse `LearningStore.getAllWordStates(userId)` and pick `wordId` | Avoids a store-interface change in PH01; a `getWordState` optimisation is deferred |
| User id | Fixed `demo-user` (as in `state.ts`) | Multi-user is out of scope for the demo |
| Transition record | New append-only `answer_events` table in `@gll/db` + `SqliteAnswerEventStore.appendAnswerEvent`; written every `/api/answer` | Durable, queryable, replayable (ADR transition channel) |
| Event-write failure | `appendAnswerEvent` **throws** on failure (no `console` in `@gll/db`); it logs via the **injected logger**; the route catches, logs `error`, and still returns the already-persisted state (**fail-open**) | State write must not be lost to a diagnostics failure; nothing is silently swallowed |
| Correlation id | Read `x-correlation-id` request header if present, else `null`; route builds `logger.child({ correlationId })` | Full propagation is the debug-trace epic's job; PH01 needs only the column + child logger |
| Validation | Reject non-string/empty `wordId`, non-boolean `correct`, negative/non-number `latencyMs` → `400 BAD_REQUEST`; persisted state unchanged | Edge/limit acceptance criterion |

---

## 3. Data Structures

**`@gll/logger` (`src/index.ts`):**

```typescript
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export interface LogContext { correlationId?: string; [key: string]: unknown; }

export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
  child(context: LogContext): Logger;  // merges context into every subsequent call
}

export class PinoLogger implements Logger { /* wraps pino; child() → pino.child(); level → pino level */ }
export class NoopLogger implements Logger { /* no-op, no dependency; default for libraries + tests */ }
// pino is a dependency of @gll/logger only; never imported by @gll/db, the server, or clients.
```

**`@gll/api-contract` (`src/srs.ts`) — additions (wire DTOs only; NO config):**

```typescript
/** Request body for POST /api/answer — the raw answer, server derives state. */
export interface AnswerRequest {
  wordId: string;
  correct: boolean;
  latencyMs: number;
}

/** Response data for POST /api/answer. */
export interface AnswerResponse {
  wordState: WordStatePayload;   // authoritative post-transition state
  graduated: boolean;            // word crossed masteryThreshold on this answer
}
```

**`@gll/server` (`src/config/learning.ts`) — server-owned behavioral config:**

```typescript
import type { StreakThresholds } from '@gll/srs-engine-v2';

export const LEARNING_CONFIG: { masteryThreshold: number; streakThresholds: StreakThresholds } = {
  masteryThreshold: 2,
  streakThresholds: { correctStreakThreshold: 2, wrongStreakThreshold: 2, maxMastery: 2 },
};
```

**`@gll/db` — new `answer_events` table (append-only; no FKs, per schema ADR):**

```typescript
// schema.ts
export const answerEvents = sqliteTable('answer_events', {
  id: integer('id').primaryKey({ autoIncrement: true }), // monotonic seq for replay ordering
  correlationId: text('correlation_id'),                 // nullable; debug-trace epic populates
  userId: text('user_id').notNull(),
  wordId: text('word_id').notNull(),
  correct: integer('correct', { mode: 'boolean' }).notNull(),
  latencyMs: integer('latency_ms').notNull(),
  beforeState: text('before_state'),                     // JSON WordState | null (first sighting)
  afterState: text('after_state').notNull(),             // JSON WordState
  graduated: integer('graduated', { mode: 'boolean' }).notNull(),
  createdAt: text('created_at').notNull(),               // ISO 8601
});

// answer-event-store.ts
export interface AnswerEventRecord {
  correlationId: string | null;
  userId: string;
  wordId: string;
  correct: boolean;
  latencyMs: number;
  beforeState: WordState | null;
  afterState: WordState;
  graduated: boolean;
  createdAt: string;
}

export interface AnswerEventStore {
  appendAnswerEvent(record: AnswerEventRecord): Promise<void>;
}

// SqliteAnswerEventStore(db, logger: Logger = new NoopLogger()) — logs+throws on failure
```

Replay property: because `updateRunState` is pure, folding `answer_events` for a `(userId, wordId)`
in `id` order reproduces the exact `afterState` sequence — the basis of the ST09 golden-master gate.

---

## 4. User Workflows

```
Client answers a question
  → POST /api/answer { wordId, correct, latencyMs }   (x-correlation-id?)
     → log = logger.child({ correlationId })
     → validate body ──(invalid)──▶ log.warn; 400 BAD_REQUEST, no writes
     → before = getAllWordStates(demo-user).get(wordId)              (may be undefined)
     → next   = updateRunState(runState, wordId, correct, LEARNING_CONFIG.streakThresholds)
     → after  = next.get(wordId)
     → graduated = !isMastered(before, T) && isMastered(after, T)    // T = masteryThreshold
     → upsertWordState(demo-user, after)                            // persist authoritative state
     → try appendAnswerEvent({ correlationId, before, after, ... })
         catch → log.error('answer_event append failed', { err }); continue (fail-open)
     → 200 { wordState: toPayload(after), graduated }
  ← client adopts returned wordState  (cutover wiring is PH04)
```

---

## 5. Stories

### Phase 0: Logging foundation (EP37-PH00)

### EP37-ST00: `@gll/logger` package + injection

**Scope**: New package + inject into `@gll/db` stores and the server. No behavioural change to existing flows.
**Read List**: `packages/srs-shelving/package.json` (scaffold), `packages/db/src/sqlite-review-store.ts` (store ctor pattern), `apps/server/src/app.ts`, `product-documentation/architecture/20260708T143342Z-engineering-logging-strategy-injected-logger.md`
**Tasks**:

- [ ] Scaffold `packages/logger` (`@gll/logger`) with a `pino` dependency: `Logger` port, `PinoLogger`, `NoopLogger`, `LogLevel`, `LogContext`
- [ ] `PinoLogger` wraps `pino` — structured JSON, `level` from `minLevel`, `child(context)` → `pino.child(context)`; pino not exported past the port
- [ ] Add `@gll/db` dependency on `@gll/logger` (used by `SqliteAnswerEventStore` in ST03; other stores unchanged)
- [ ] Server constructs a `PinoLogger` (`apps/server/src/logger.ts`) for routes/stores to use

**Acceptance Criteria**:

- [ ] `NoopLogger` produces no output; unit tests stay silent by default
- [ ] `PinoLogger` respects `minLevel` (e.g. `warn` suppresses `debug`/`info`) and includes `correlationId` when present
- [ ] `child({ correlationId })` returns a logger that stamps that context on every call
- [ ] `pino` is imported only within `@gll/logger` (not by `@gll/db`, the server, or clients)
- [ ] Existing stores are untouched (no `logger` param added speculatively)

### Phase 1: Server-side Learning transition (EP37-PH01)

### EP37-ST01: `/api/answer` contract (`@gll/api-contract`)

**Scope**: Wire DTOs only — **no config**, no server/client logic.
**Read List**: `packages/api-contract/src/srs.ts`, `packages/api-contract/src/index.ts`
**Tasks**:

- [ ] Add `AnswerRequest`, `AnswerResponse` to `src/srs.ts` (reuse `WordStatePayload`)
- [ ] Confirm they surface via `src/index.ts`; build `@gll/api-contract`

**Acceptance Criteria**:

- [ ] `AnswerResponse.wordState` reuses `WordStatePayload` (no duplicate field list)
- [ ] **No** learning config/thresholds are exported from `@gll/api-contract`
- [ ] Package typechecks and builds

### EP37-ST02: `POST /api/answer` route + server config (`@gll/server`)

**Scope**: One Hono route + server-owned config; reuse engine + `SqliteLearningStore` + injected logger. Leave `state.ts` untouched.
**Read List**: `apps/server/src/routes/state.ts`, `packages/srs-engine-v2/src/types/word-state.ts` (`updateRunState`, `isMastered`), `packages/db/src/sqlite-learning-store.ts`, `apps/server/src/app.ts` (route registration)
**Tasks**:

- [ ] Add `src/config/learning.ts` exporting `LEARNING_CONFIG` (values above)
- [ ] Add `routes/answer.ts`: `logger.child({ correlationId })` → validate → load prior state → `updateRunState` → persist `after` → compute `graduated` → return `AnswerResponse`
- [ ] Register the route alongside `state`; use `LEARNING_CONFIG` (no local literals)

**Acceptance Criteria**:

- [ ] Fresh word answered `correct` three times → `mastery` goes 0→1→2 (streak≥2 bumps mastery, capped at `maxMastery` 2); **third** response `graduated: true`, first two `false` (crosses `masteryThreshold` 2 on the 3rd correct)
- [ ] Response `wordState` deep-equals `updateRunState` output, persisted via `getAllWordStates`
- [ ] Invalid body (empty `wordId`, non-boolean `correct`, negative `latencyMs`) → `400`, persisted state unchanged, a `warn` logged
- [ ] `POST /api/state/word` behaviour unaffected (regression check)

### EP37-ST03: Transition record — `answer_events` channel (`@gll/db`)

**Scope**: Schema + injected-logger store + wire into the route (fail-open).
**Read List**: `packages/db/src/schema.ts`, `packages/db/src/sqlite-review-store.ts`, `packages/db/src/index.ts`, `apps/server/src/routes/answer.ts` (from ST02)
**Tasks**:

- [ ] Add `answer_events` table to `schema.ts` (no FKs) + init/migration as the repo does it
- [ ] Add `AnswerEventStore` + `SqliteAnswerEventStore(db, logger = NoopLogger)`; `appendAnswerEvent` logs + throws on failure; export from `@gll/db`
- [ ] Call `appendAnswerEvent` in `/api/answer` after persisting state; on throw, `log.error` and still return state (fail-open)

**Acceptance Criteria**:

- [ ] Each `/api/answer` call appends exactly one row: `before/after` JSON, `correct`, `latencyMs`, `graduated`, `createdAt`, `correlationId` (or `null`)
- [ ] Rows ordered by monotonic `id` (replay ordering)
- [ ] **Replay test**: folding `updateRunState` over a word's events in `id` order reproduces the stored `afterState` sequence exactly
- [ ] On a simulated append failure, the route logs `error`, returns `200` with the persisted state, and the state write is intact (not rolled back)

## 6. Success Criteria

1. `@gll/logger` exists (wrapping `pino`); `SqliteAnswerEventStore` accepts an injected logger (default `NoopLogger`); the server injects `PinoLogger`; `pino` is not imported outside `@gll/logger`.
2. `POST /api/answer` runs the transition server-side and returns `{ wordState, graduated }` using **server-owned** `LEARNING_CONFIG`; no config leaks into `@gll/api-contract`.
3. Server-computed `WordState` is deep-equal to the client's `updateRunState` output for the same answer sequence (parity foundation for ST09).
4. Every answer is durably recorded in `answer_events` and is replayable through the pure engine; an append failure is logged and fails open.
5. Legacy `POST /api/state/word` is untouched; the new endpoint is purely additive.
6. Malformed requests are rejected with `400` and leave persisted state unchanged.
7. No type errors; `ts-fsrs` is not imported anywhere in this DS's code.
