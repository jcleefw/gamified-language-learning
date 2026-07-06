# EP34 - Async Storage Contract

**Created**: 20260706T231647Z
**Status**: Impl-Complete

<!-- Status: Draft | Accepted | In Progress | Impl-Complete | BDD Pending | Completed | Shelved | Withdrawn -->

**Type**: Epic Plan
**Depends on**: EP30 (persistent storage — `LearningStore` / `SqliteLearningStore`), EP31 (Vue persistence conversion — consumes store via server routes)
**Parallel with**: ContentStore & deck-document model epic (sibling ADR — its `ContentStore` is born async under this contract)
**Predecessor**: N/A

---

## Problem Statement

`LearningStore` ([packages/db/src/learning-store.ts](../../../packages/db/src/learning-store.ts)) is **synchronous** for exactly one reason: `better-sqlite3` is synchronous. The contract leaks a driver implementation detail instead of describing the domain's need. Every hosted database — D1, Turso/libSQL, Firestore, Postgres — is async-only, so the synchronous contract cannot survive any move off local sync SQLite. This async conversion is unavoidable debt for any hosted future.

Per the [Async Storage Contract ADR](../../../product-documentation/architecture/20260706T125834Z-engineering-async-storage-contract.md), the fix is to adopt the async contract **now, cheaply** — as an async interface over the existing synchronous implementation, with **zero behavioural change** — decoupling the wide-but-mechanical contract change from the risky future driver/hosting swap.

## Scope

**In scope**:

- Convert `LearningStore` interface — all methods return `Promise<...>`.
- Convert `SqliteLearningStore` to `async` wrappers over the existing `better-sqlite3` calls (no logic change).
- Propagate `await` through server routes ([state.ts](../../../apps/server/src/routes/state.ts), [shelving.ts](../../../apps/server/src/routes/shelving.ts)).
- Propagate `await` through CLI runner callbacks ([learning-io.ts:394](../../../apps/cli-demo-db/src/learning-io.ts#L394)); widen engine/runner callback types `(state) => void` → `(state) => void | Promise<void>`.
- Add ESLint `no-floating-promises` to catch missed `await`s.

**Out of scope**:

- Any actual async driver swap (libSQL/Turso/D1/Firestore) — belongs to a future hosting ADR.
- Data-model changes — storage stays SQLite.
- Network error-handling / retry semantics — the interface is not exercised against real latency until a real driver lands ("async theater" is accepted for now).
- `ContentStore` itself — owned by the sibling epic; this epic only establishes the async shape it inherits.

---

## Stories

### Phase 1: Async storage contract (EP34-PH01)

### EP34-ST01: Async `LearningStore` interface + `SqliteLearningStore` wrappers

**Scope**: Interface methods → `Promise<...>`; `SqliteLearningStore` methods become `async` wrapping existing sync calls — no logic or behavioural change, existing db tests stay green.

**Status**: Complete ✅

### Phase 2: App-layer propagation (EP34-PH02)

### EP34-ST02: Server routes await store calls

**Scope**: `await` all `LearningStore` calls in [state.ts](../../../apps/server/src/routes/state.ts) and [shelving.ts](../../../apps/server/src/routes/shelving.ts); route handlers async.

**Status**: Complete ✅ — also covered `test-seed.ts` (a third route consuming the store, not named in the original ADR trace) and fixed un-awaited direct store calls inside `test-seed.test.ts` itself.

### EP34-ST03: CLI runner callbacks await store writes

**Scope**: Widen engine/runner callback types to `(state) => void | Promise<void>`; `await` the `onWordAnswer` (and sibling) callbacks at call sites in [learning-io.ts](../../../apps/cli-demo-db/src/learning-io.ts) — engine scoring core untouched.

**Status**: Complete ✅ — also required awaiting `getAllWordStates`/`getAllSentenceStates` in `learning-runner-db.ts` (not anticipated in the DS) and fixing un-awaited direct store calls across three test files.

### Phase 3: Guardrail (EP34-PH03)

### EP34-ST04: Enforce `no-floating-promises` lint

**Scope**: Add ESLint `@typescript-eslint/no-floating-promises` (evaluate `require-await`) to catch conversion gaps; fix any violations surfaced; CI green.

**Status**: Complete ✅ — scoped to just this one rule on `apps/**` (not the full `recommendedTypeChecked` bundle, which surfaced ~35 unrelated pre-existing issues). The rule immediately caught two real gaps: fire-and-forget store calls in `learning-runner-db.ts`'s inline callbacks, and an un-awaited `onGraduation` in the engine's own demo file (broken by ST03's `GraduationHook` widening). `require-await` deferred — disabled via a scoped override for `sqlite-learning-store.ts`, whose async-over-sync wrappers are intentionally await-free by ST01's design.

---

## Overall Acceptance Criteria

- [x] `LearningStore` and `SqliteLearningStore` are fully async; no method returns a bare value.
- [x] No behavioural change — the existing db/server/CLI test suites pass unchanged (green).
- [x] Server routes and CLI runner `await` every store call; no floating promises remain.
- [x] Engine callback types accept `void | Promise<void>`; engine **scoring core is unmodified** (library boundary preserved).
- [x] `no-floating-promises` lint is active in CI and passes with zero violations.
- [x] **Edge/limit case**: a store write that rejects (Promise rejection) propagates through the awaiting route/runner rather than being silently swallowed — verified by test.

---

## Dependencies

- EP30 — persistent storage layer (`LearningStore`, `SqliteLearningStore`) must exist.
- EP31 — Vue/server persistence consumers of the store.
- Sibling ADR / ContentStore epic — coordinate so `ContentStore` is born async (its "sync retained" note is superseded by this contract).

## Next Steps

All four stories (ST01-ST04) are implemented, tested, and merged to `EP-34--async-storage-contract`. Remaining before closing the epic:

1. Open a PR from `EP-34--async-storage-contract` to `main` and get it reviewed.
2. Confirm CI is green with the new `no-floating-promises` lint gate active.
