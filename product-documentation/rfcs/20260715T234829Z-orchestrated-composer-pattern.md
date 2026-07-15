# RFC: Orchestrated Composer Pattern — Shared Context for Batch Composition

**Created**: 2026-07-15

**Status**: Draft

<!-- Status: Draft | Proposed | Accepted | Rejected | Withdrawn | Shelved | Superseded -->

**Author**: JC Lee / PO

**Supersedes**: N/A

---

## Problem Statement

Can batch composition support **dynamic, cross-composer adjustment** within a single batch —
e.g. re-prioritising overdue reviews when a learner is struggling, or reallocating quota
between composers based on what has already been placed?

The design in force (ADR D5, `20260513T000000Z-engineering-batch-execution-mechanics.md`,
implemented in EP25) deliberately says no:

- `createComposerRegistry()` (`packages/srs-engine-v2/src/engine/compose-registry.ts`) exposes
  only `add(thunk: () => QuizQuestion[])`. Composers are stateless and blind to one another
  (D5/OQ1).
- `assembleBatch()` (`packages/srs-engine-v2/src/engine/assemble-batch.ts`) fixes each
  composer's quota **before** composition via a proportional-by-count split, applies
  `excludeIds` up front, then calls `assembleBatchQuestions`.
- `assembleBatchQuestions` is the whole runner: `registry.thunks.flatMap(t => t())` — pure
  concatenation, no coordination.

Note the registry is **not** a static array — thunks are built per call and `extraThunks`
already lets the host inject composers. The real constraint is the absence of **shared,
mutable context** during composition, and a quota that is frozen before any composer runs.

## Proposed Solution

Introduce an **Orchestrated Composer Pattern**: composers receive a shared `ComposerContext`
that the runner threads through them in sequence, so each can read what has been decided so
far and adjust its output.

- `assembleBatch` seeds one `ComposerContext` (remaining quota, priority flags, placed-item
  set).
- Composer thunks change from `() => QuizQuestion[]` to `(ctx: ComposerContext) => QuizQuestion[]`;
  each reads the context, emits questions, and updates it before the next composer runs.
- `assembleBatchQuestions` changes from a stateless `flatMap` to an ordered fold that passes
  the evolving context along the chain.
- Registration order becomes contractual (it currently is not) — higher-priority composers
  register first.

**Author's recommendation: do not adopt as stated, and do not build on spec.** The analysis
below is why. This RFC exists to record the option and the reasoning, not to green-light it.

## Alternatives Considered

| Alternative | Pros | Cons |
| ----------- | ---- | ---- |
| **Keep D5 as-is** (stateless thunks, central pre-split) | Simplest; composers stay pure and independently testable; no ordering contract | Cannot express mid-batch re-prioritisation or cross-composer quota hand-off |
| **Post-composition filter** (drop questions after composing) | No composer changes; adjustment isolated | Can only subtract already-composed questions — cannot *grow* a starved composer or reallocate quota |
| **State-aware central allocator** (composers stay blind; a pure `allocateQuota(items, signals, total)` computes the split from learner state) | Handles the roadmap examples (overdue-first, struggling → bigger review share); no shared mutable state; no ordering contract; keeps D5 intact; composers stay independently testable | Cannot react to a composer's *actual* output — but SRS output is predictable from inputs, so this rarely bites |
| **Orchestrated Composer Pattern** (this RFC) | Enables true cross-composer negotiation at compose time | Reverses D5's deliberate "composers are blind" decision; shared mutable state; ordering becomes significant; larger surface for state bugs; aims at a layer where nothing dynamic actually happens (see Impact) |

## Impact

- **Affected areas**: `ComposerRegistry` interface, `assembleBatchQuestions` runner,
  `assembleBatch`, and every thunk call site including `demo/learning-io.ts`. If adopted, ADR
  D5 must be amended (its "no composer knows about the others" stance and OQ1 no-argument
  thunk contract).
- **Migration effort**: medium — signature change ripples to all composers and call sites.
- **Breaking changes**: yes — the composer contract changes engine-internally (does not cross
  the library/app boundary).

## Open Questions

- **Is within-batch adjustment even a composition concern?** Composition runs **once** per
  batch, up front. All within-batch dynamics today live in the *queue* layer, not composition:
  wrong-answer re-serve is `state.questionCache.get(id)` pushed back onto the queue in
  `batch-queue.ts` (`submitBatchResult`, per D11) — **no composer re-runs**. A shared
  `ComposerContext` would do nothing for re-serve because re-serve never calls a composer.
- **What layer would future adaptivity actually touch?** "Learner is struggling → pull in an
  easier related word mid-batch" is the session/queue loop re-invoking a composer with fresh
  state — still not composers negotiating among themselves. The initial-split adaptivity is
  the allocator. Neither needs this pattern.
- **Is there any requirement that needs reaction to a composer's *actual output*?** That is the
  only thing this pattern uniquely enables. None is currently scoped. Until one exists,
  building the mechanism is premature.
- **Is this a beta gate?** No. Beta blockers are audio, hosting, multi-user. Adaptive
  re-prioritisation is not on that axis.

## Decision

**Status**: Rejected

**Decision**: Rejected

**Rationale**: Within-batch adjustment is a queue/session concern, not a composition
concern. All current and plausible within-batch adaptivity (re-serve, dynamic recomposition,
quota reallocation) lives in `batch-queue.ts` or the session loop, never calling composers.
Composition is one-shot. A `ComposerContext` threads through the wrong layer. The "state-aware
central allocator" (alternative 3) solves the roadmap examples (overdue-first, struggling →
bigger review share) with no shared state, no ordering contract, and no reversal of D5. Build
that only if an adaptivity epic is scoped and proves the allocator insufficient.

**Next step**: N/A — RFC archived as rejected reasoning. When adaptivity work emerges, revisit
the allocator alternative.
