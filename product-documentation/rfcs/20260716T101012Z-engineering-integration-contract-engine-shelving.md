# RFC: Integration Contract (Engine ⟷ Shelving) — data parameter, not behavioural port

**Created**: 2026-07-16 <!-- 20260716T101012Z -->

**Status**: Proposed

<!-- Status: Draft | Proposed | Accepted | Rejected | Withdrawn | Shelved | Superseded -->

**Author**: JC Lee / PO

**Supersedes**: N/A

---

## Problem Statement

The engine (`@gll/srs-engine-v2`) needs to know which words are **shelved** so it can keep them out
of the questions it generates. The originating draft frames this as a coupling question — a hard
dependency from the engine on `@gll/srs-shelving` would create circular-dependency risk and hurt
portability — and proposes Inversion of Control via an `IShelfValidator` **interface** defined in the
engine and injected by the consumer.

The draft's *goal* is right and is already the settled direction for this codebase: the engine is a
library of pure engine types/functions plus the `LearningStore` interface, with **no app-layer glue**
(the established library boundary). It must not physically depend on the shelving domain.

The draft's *diagnosis of the current state is out of date*, and this changes the decision. The
engine **already inverts this dependency** — and it does so with the lightest possible contract:

- `assembleBatch` accepts `excludeIds?: Set<string>` as an option
  ([`assemble-batch.ts:13-14`](../../packages/srs-engine-v2/src/engine/assemble-batch.ts#L13-L14)),
  and filters the active word list against it
  ([`assemble-batch.ts:30-31`](../../packages/srs-engine-v2/src/engine/assemble-batch.ts#L30-L31)).
- `@gll/srs-engine-v2` has **no dependency** on `@gll/srs-shelving`. It never imports it.
- The **consumer** owns the shelving decision: it calls `evaluateShelving(...)` from
  `@gll/srs-shelving`, maintains a `shelvedSet`, and passes that set in as data —
  e.g. `assembleBatch(..., { excludeIds: shelvedSet.value })`
  ([`useLearningSession.ts:242-247`, `459-461`](../../apps/srs-demo/src/composables/useLearningSession.ts#L242-L247);
  [`learning-io.ts:244, 255-263`](../../apps/cli-demo-db/src/learning-io.ts#L244)).

So the two "Alternatives Considered" in the draft — a shared `srs-common` package, or a direct
Engine→Shelving dependency — are both alternatives to a problem that is **already solved**. The real,
still-open question is narrower and different:

> Given that the engine is already decoupled, what **form** should the exclusion contract take —
> the existing **data parameter** (`excludeIds: Set<string>`), or a **behavioural port**
> (`IShelfValidator` the engine calls back into) — and is any change needed at all?

There is exactly one concrete deficiency in the current contract, and it is a **coverage gap, not a
coupling problem**: `excludeIds` is applied only to the top-level word list. It is **not** threaded
into the sentence path, so `resolveEligibleContexts`
([`sentence-scheduling.ts`](../../packages/srs-engine-v2/src/engine/sentence-scheduling.ts)) can still
place a **shelved word as a tile inside a sentence question**. This is the same leak documented in
the companion RFC `20260716T095048Z-engineering-domain-logic-protocol-vs-consumer-strategy.md`
(Problem Statement, point 3). A learner can shelve a word and still be quizzed on it via a sentence.

This RFC exists to answer the *form* question deliberately, because the draft's `IShelfValidator`
proposal would **add** an abstraction (and the wiring boilerplate the draft itself lists as a
Negative) to a boundary that is already clean — and to close the one real gap.

## Proposed Solution

**Keep the existing data-parameter contract. Do not introduce a behavioural `IShelfValidator` port.
Close the sentence-tile leak by threading the same `excludeIds` set into the sentence path.**

Rationale in one line: the engine is **told** the exclusion set once per batch; it never needs to
**ask**. A `Set<string>` is the complete contract. A behavioural port is only warranted when the
engine must query shelving *dynamically during composition* — which it does not, because shelving is
pre-computed by the consumer (`evaluateShelving` runs once per batch to update `shelvedSet`;
[`useLearningSession.ts:459-482`](../../apps/srs-demo/src/composables/useLearningSession.ts#L459-L482)).

Concretely:

1. **Ratify the data contract as the integration boundary.** The engine's dependency on "shelving"
   is, and remains, a plain `excludeIds: Set<string>` value passed in by the consumer. The engine
   knows nothing of *why* an ID is excluded (shelving, manual skip, recheck) — it only honours the
   set. This is the correct altitude: the engine owns a **predicate over IDs it is given**, and the
   consumer owns the **policy that produces them** (`evaluateShelving`, `@gll/srs-shelving`). This
   mirrors the protocol-vs-strategy boundary in the companion RFC: *Engine = safety/well-formedness,
   Consumer = strategy/experience.*

2. **Close the sentence-tile leak (the only functional change).** Give the sentence path the same
   exclusion set the word path already has — either by adding an `excludeIds` parameter to
   `resolveEligibleContexts`, or by filtering tiles against `excludeIds` inside `assembleBatch`
   before the batch is returned. This makes the batch-wide invariant *"no excluded ID appears in any
   question, including as a sentence tile"* actually satisfiable. It is a plumbing change through
   existing data; it introduces **no new interface**.

3. **Let the companion RFC enforce the invariant.** The pure `validateBatch(questions, constraints)`
   predicate proposed in `…protocol-vs-consumer-strategy.md` is the natural enforcement point:
   `constraints` carries `excludeIds` (again, **data**), and the validator asserts no excluded ID
   survives anywhere in the batch. This RFC's job is to establish *what the contract is* (a data
   set); that RFC's job is to *enforce* it. They compose; neither adds a port.

4. **Explicitly reject `IShelfValidator` for now, on the record.** Introducing a behavioural port —
   an engine-defined interface the consumer implements and injects so the engine can call
   `validator.isShelved(id)` — buys nothing over the data set while costing: (a) the wiring
   boilerplate the draft itself lists as a Negative; (b) a second injection seam alongside
   `LearningStore` with no caller that needs lazy/stateful querying; (c) a lifetime/consistency
   hazard (a live callback can answer differently mid-batch, where a captured `Set` is a stable
   snapshot — which is exactly what a "well-formed batch" wants). Reserve the port for the day a
   real requirement appears (see Open Questions); adopting it speculatively contradicts the very
   "keep the engine lightweight" rationale the draft invokes.

## Alternatives Considered

| Alternative | Pros | Cons |
| ----------- | ---- | ---- |
| **Data parameter — `excludeIds: Set<string>` (this RFC; already shipped for the word path)** | Zero engine→shelving coupling (already true); engine stays a pure library; stable per-batch snapshot; consumer owns *why* an ID is excluded; smallest possible surface; already proven in two consumers | Sentence path not yet covered (the leak) — a plumbing fix, not a design flaw; engine cannot *initiate* a shelving query (by design — it never needs to) |
| **Behavioural port — `IShelfValidator` interface injected by consumer (the draft)** | Engine could query shelving lazily; symmetrical with `LearningStore`; "textbook" IoC | Heavier than the data set with **no caller that needs it**; adds the wiring boilerplate the draft lists as its own Negative; live callback can answer inconsistently mid-batch; second injection seam to maintain; contradicts the "lightweight engine" goal it is meant to serve |
| **Shared `srs-common` domain package** | One home for shared shelving types | Solves a coupling problem that no longer exists (engine already has no shelving dep); adds a package and a versioning axis; `Set<string>` needs no shared type |
| **Direct Engine → Shelving dependency** | Simplest to write | Reintroduces exactly the coupling/portability/circular-dependency risk the draft (correctly) wants to avoid; violates the library boundary; **rejected** |

The crux is rows 1 vs 2. Both are IoC. They differ in *what is inverted*: row 1 inverts **data**
(the consumer computes the exclusion set and hands it in), row 2 inverts **behaviour** (the consumer
hands in an object the engine calls). Row 1 is sufficient precisely because shelving is decided
*before* composition, not *during* it. Choosing row 2 would be inverting behaviour the engine never
invokes.

## Impact

- **Affected areas**:
  - `packages/srs-engine-v2`: **no new interface.** Sentence path gains exclusion coverage —
    `resolveEligibleContexts` gains an `excludeIds` parameter *or* `assembleBatch` filters tiles
    post-composition. The `excludeIds: Set<string>` option on `assembleBatch` is ratified as the
    integration contract (documented, not changed).
  - `apps/srs-demo/src/composables/useLearningSession.ts`,
    `apps/cli-demo-db/src/learning-io.ts`: already pass `excludeIds`/`shelvedSet` into
    `assembleBatch`; they gain nothing new to wire — the same set now also reaches the sentence
    path. No consumer implements or injects any new interface.
  - `@gll/srs-shelving`: unchanged. Remains the consumer-side policy that *produces* the set.
- **Migration effort**: **low.** One engine-internal signature change plus test coverage for the
  sentence-tile invariant. No new package, no new interface, no consumer wiring.
- **Breaking changes**: engine-internal only (`resolveEligibleContexts` gains a parameter, if that
  path is taken). No change to the `@gll/api-contract`, no schema change. Consumer batches may
  *change shape* once the sentence leak is closed (a previously-leaking shelved word stops appearing
  as a tile) — a behaviour fix, not a contract break.

## Open Questions

- **When, if ever, does `IShelfValidator` become justified?** Only if a future consumer needs the
  engine to evaluate shelving *lazily or statefully mid-composition* — e.g. a very large deck where
  the exclusion set can't be materialised up front, or a rule that depends on choices made earlier
  *within the same batch*. None of today's consumers do (`shelvedSet` is small, bounded by
  `maxShelved`, and computed once per batch). Revisit the port **only** when such a caller exists;
  until then it is speculative.
- **Where does the sentence-path fix live — `resolveEligibleContexts(excludeIds)` or a tile filter
  in `assembleBatch`?** The former is more honest (the scheduler never proposes an excluded tile);
  the latter is a smaller diff (one filter before return). Recommend the parameter form so the
  invariant is enforced at the point of eligibility, not patched after. Decide with whoever
  implements the companion RFC's `validateBatch`, since both touch this path.
- **Should `excludeIds` be renamed to reflect that it is exclusion-cause-agnostic?** The engine
  treats shelving, manual skip, and recheck-holds identically — all are "IDs not to quiz right now."
  A name like `excludeIds` (current) already reads generically; `shelvedSet` on the consumer side is
  fine as the *source*. No rename proposed; noted so the contract's generality is not mistaken for a
  shelving-specific hook.
- **Is this a beta gate?** No. Beta blockers are audio, hosting, and multi-user. This is
  correctness/boundary hardening. Sequence it with the companion RFC's engineering epic, before a
  **third** batch consumer exists — after which any contract ambiguity compounds.

## Related ADRs

- Companion RFC — `20260716T095048Z-engineering-domain-logic-protocol-vs-consumer-strategy.md`
  (Proposed). This RFC fixes the **form of the exclusion contract** (data, not port); that RFC
  **enforces** it via a pure `validateBatch` predicate. Read together: same boundary, two halves —
  *what the contract is* vs *how it is guaranteed*. Both identify the same sentence-tile leak.
- `20260626T000000Z-engineering-shelving-stagnation-policy.md` — origin of the shelving exclusion
  invariant and of `evaluateShelving`, the consumer-side policy that produces `excludeIds`.
- `20260313T000000Z-engineering-quiz-contract-answer-authority.md` — precedent for the engine owning
  a correctness contract expressed as data/predicate the consumer honours.
- `20260513T000000Z-engineering-batch-execution-mechanics.md` — defines the `assembleBatch` /
  composer / registry mechanics into which `excludeIds` is threaded.
- The established **library boundary** for `srs-engine-v2` (pure engine types/functions +
  `LearningStore` only; no app glue) — the constraint that makes the data-parameter form correct and
  the behavioural-port form suspect.

## Decision

<!-- Filled in when status changes to Accepted/Rejected -->

**Recommendation (pending PO decision)**: Accept the **data-parameter** form (Alternatives row 1).
The engine is already correctly decoupled from `srs-shelving`; the draft's `IShelfValidator` port and
`srs-common` package both solve a coupling problem that no longer exists, while the port additionally
imports the wiring cost the draft itself flags. The one real defect — shelved words leaking into
sentence tiles — is a coverage gap closed by threading the existing `excludeIds` set into the
sentence path, with enforcement delegated to the companion RFC's `validateBatch`. Reserve
`IShelfValidator` for a concrete future caller that must query shelving mid-composition; none exists
today.

**Decision**: {Accepted / Rejected}
**Rationale**: {Why}
**Next step**: {Epic EP## / ADR## / N/A}
