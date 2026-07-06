# ADR: Async Storage Contract

**Status:** Proposed

**Date:** 2026-07-06

**Deciders:** Solo founder

> **Shared principle (common to this ADR and its sibling, [ContentStore & deck-document model](20260706T125002Z-engineering-contentstore-deck-document-model.md)):**
> Storage interfaces should be **domain-owned and driver-agnostic**, mirroring the discipline already applied to the engine boundary — where a persistence detail leaking into `@gll/srs-engine-v2` was explicitly rejected (see [srs-engine-v2 library boundary](../../.agents/memory/EP30--persistent-storage/srs-engine-v2-library-boundary.md)). The sibling ADR closes the *content* leak (no interface). This ADR closes the *shape* leak: the storage contract encodes a property of one specific driver.

---

## Context

The storage-boundary audit found that `LearningStore` ([learning-store.ts](../../packages/db/src/learning-store.ts)) is **synchronous** — every method returns a concrete value (`RunState`, `void`, `string[]`), never a `Promise`. It is synchronous for exactly one reason: `better-sqlite3` is synchronous. The contract leaked an implementation detail of the current driver rather than describing the domain's need.

This matters because **every hosted database is async-only** — Cloudflare D1, Turso/libSQL, Firestore, Postgres. The synchronous contract cannot survive a move off local sync SQLite, **including the originally-planned D1** ([infra ADR](20260301T161844Z-infra-cloudflare-platform.md)). The async conversion is therefore unavoidable debt for any cloud/hosted future, independent of vendor.

**Scope of the ripple (already traced):**

- Interface method signatures → `Promise<...>`.
- `SqliteLearningStore` implementation → trivially wrapped `async` (no logic change).
- Server routes (`state.ts`, `shelving.ts`) → `await` store calls.
- Runner callbacks in [learning-io.ts:394](../../apps/cli-demo-db/src/learning-io.ts#L394) → currently `onWordAnswer(ws)` invoked **without** `await`; must be awaited. Callback types `(state) => void` → `(state) => void | Promise<void>`.
- **The engine core is untouched.** The store never enters the scoring logic — only app-layer callbacks touch it — so the library boundary confines the ripple to the app layer.

**Timing observation:** the async contract is not *needed* until storage goes networked. But it can be adopted **now, cheaply**, as an async interface over the existing synchronous implementation (`async` methods wrapping sync `better-sqlite3` calls), with zero behavioural change — decoupling the contract change from the eventual driver swap.

---

## Decision

### 1. The storage contract is async

Make `LearningStore` async — all methods return `Promise<...>`. For consistency the principle applies to the **whole storage surface**: the `ContentStore` introduced by the sibling ADR is **born async**, so the two interfaces don't reintroduce an asymmetry (sync content + async learner state). `LearningStore` is the concrete driver of this ADR; `ContentStore` inherits the shape.

### 2. Adopt now, over the existing synchronous implementation

Land the async contract **immediately**, implemented over `better-sqlite3` via `async` wrappers (`async getAllWordStates(userId) { return this.db...; }`). No driver change, no behavioural change, tests stay green. This pays the single largest future-migration cost **in isolation, under no time pressure**, and turns the eventual driver swap (libSQL/D1/Firestore) into a localized change with **no contract ripple**.

### 3. Propagate the async boundary through the app layer

- Engine/runner callback types become `(state) => void | Promise<void>`; call sites `await` them.
- Server routes `await` store calls.
- Add an ESLint `no-floating-promises` rule to catch missed `await`s introduced by the conversion.

The actual choice of async driver (libSQL/Turso is the natural fit — same SQL dialect, local file *and* remote, keeps Drizzle) is **out of scope**; it belongs to a future hosting ADR.

---

## Rationale

- **The contract should describe the domain, not the driver** — Async is the honest shape of a storage boundary that must one day cross a network. Encoding sync locked the interface to `better-sqlite3`.
- **Pay the cost decoupled and early** — Converting now, over a stable sync implementation, isolates a wide-but-mechanical change from the risky driver/hosting swap. Doing both at once (under a cloud deadline) is how migrations go wrong.
- **The boundary already protects the engine** — Because the store never enters scoring logic, the async ripple is app-layer only. This is the payoff of the engine's library boundary, applied in reverse.
- **Restores symmetry** — Both storage interfaces async and domain-owned closes the second leak and leaves the storage layer uniformly abstracted.

---

## Alternatives Considered

| Option | Pros | Cons | Why Not Chosen |
| --- | --- | --- | --- |
| **Defer until the cloud move forces it** | No work now | Pays the wide ripple later, coupled with a risky driver + hosting change, under deadline | Bundles unrelated risk; the change is cheap now and expensive later |
| **Adopt async over sync now (chosen)** | Cheap, mechanical, zero behavioural change, de-risks the biggest future cost | Adds Promise plumbing with no *current* runtime benefit | — |
| **Skip the interface step; swap straight to an async driver (libSQL) now** | One move instead of two | Conflates contract + driver + hosting; wide blast radius; premature (no central-hosting need yet) | Violates one-decision-per-change; hosting is a separate ADR |
| **Make only reads async / partial conversion** | Smaller diff | Inconsistent contract; the sync methods still lie about the driver | Half a boundary is not a boundary |

---

## Consequences

**Positive:**

- The storage contract is driver-agnostic; the interface no longer encodes `better-sqlite3`.
- The largest cloud-migration cost is paid in advance, in isolation, with tests green.
- The future driver swap (libSQL/D1/Firestore) becomes a localized, low-risk change — no contract ripple.
- Symmetry restored: both `LearningStore` and `ContentStore` async and domain-owned.

**Negative / Risks:**

- Wide (if mechanical) diff across server routes and runner call sites.
- Callback type change touches the engine's callback *signatures* (not its core logic) — a boundary the sibling principle otherwise guards carefully.
- **"Async theater"** — the interface *looks* cloud-ready but is never exercised against real network latency or failure until a real driver lands; error-handling/retry semantics remain unvalidated.
- Async-over-sync adds negligible Promise overhead with no present benefit.
- Missed-`await` bugs are easy to introduce; mitigated by `no-floating-promises` lint.

**Neutral:**

- No data-model change; storage stays SQLite.
- The sibling ADR's `ContentStore` folds into this async contract from birth.

---

## Open Questions

| Question | Owner | Target |
| --- | --- | --- |
| Adopt now (async-over-sync) vs defer to the cloud move — confirm timing | Architect | Before implementation |
| Reconcile with sibling ADR: `ContentStore` should be **born async** — the sibling currently states "sync retained." If both accepted, the sibling's sync note is superseded by this contract shape | Architect | On acceptance of both |
| ESLint `no-floating-promises` (and `require-await`?) enforcement to catch conversion gaps | Dev | During implementation |
| Async driver target when hosting is decided (libSQL/Turso favoured) — separate hosting ADR | Architect | Deferred |

---

_Related:_

- Sibling ADR — [ContentStore & deck-document model](20260706T125002Z-engineering-contentstore-deck-document-model.md) — its `ContentStore` inherits this async shape; its "sync retained" note is superseded if both are accepted
- [20260301T161844Z-infra-cloudflare-platform.md](20260301T161844Z-infra-cloudflare-platform.md) — D1 (and any hosted DB) requires this async contract
- [srs-engine-v2 library boundary](../../.agents/memory/EP30--persistent-storage/srs-engine-v2-library-boundary.md)
