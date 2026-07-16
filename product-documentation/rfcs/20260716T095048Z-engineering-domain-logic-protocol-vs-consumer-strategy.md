# RFC: Domain Logic Protocol vs. Consumer Strategy — Engine owns integrity, consumers own experience

**Created**: 2026-07-16 <!-- 20260716T095048Z -->

**Status**: Proposed

<!-- Status: Draft | Proposed | Accepted | Rejected | Withdrawn | Shelved | Superseded -->

**Author**: JC Lee / PO

**Supersedes**: N/A

---

## Problem Statement

Batch **orchestration** — how a batch of questions is actually assembled from words,
foundationals, and sentences — is authored independently in each consumer. The engine
(`srs-engine-v2`) exposes both a mid-level orchestrator (`assembleBatch`) and the low-level
primitives beneath it (`createComposerRegistry`, `assembleBatchQuestions`, `composeSentenceBatch`,
`resolveEligibleContexts`). Both consumers reach **past** `assembleBatch` to hand-build sentence
thunks, and they have drifted.

This is not hypothetical. The two consumers of the batch API today produce **materially different
batches from the same deck and the same learner state**:

- **CLI** — `apps/cli-demo-db/src/learning-io.ts` (`runBatch`, ll. 249–265): builds **one thunk per
  eligible sentence context**, and each thunk emits **every direction** `composeSentenceBatch`
  produces (no per-direction filter). It passes a real `foundationalPool` and drives sentence
  scheduling from `LEARNING_CONFIG`.
- **Demo** — `apps/srs-demo/src/composables/useLearningSession.ts` (`startBatch`, ll. 222–248):
  builds **one thunk per (eligible context × `CONFIG.sentenceDirections`)**, each filtering
  `composeSentenceBatch(...)` down to a single direction. It passes an **empty** foundational pool
  and drives sentence scheduling from `CONFIG.sentenceScheduling`.

Consequences of the drift:

1. **"Valid batch" is defined twice, differently.** The demo honours a configured *subset* of
   sentence directions; the CLI emits all directions the composer generates. The number and shape
   of sentence questions per batch therefore differ structurally between apps.
2. **A batch-size decision lives in the consumer, not the contract.** `assembleBatch`'s
   `wordsPerBatch` split governs **only** the word/foundational composers
   (`assemble-batch.ts` ll. 39–68). `extraThunks` (sentences) are appended via
   `assembleBatchQuestions`'s `flatMap` (`compose-registry.ts`) with **no quota**. Total batch size
   is thus whatever each consumer's thunk-construction loop yields — a strategy decision that has
   quietly become an integrity outcome.
3. **A safety invariant is enforced nowhere.** `excludeIds` (the shelving exclusion set) is applied
   only to the `active` word list inside `assembleBatch` (`assemble-batch.ts` ll. 30–32).
   `resolveEligibleContexts` (`sentence-scheduling.ts` l. 9) takes **no** exclusion argument, so a
   **shelved word still appears as a tile inside a sentence question** — in both consumers. Nothing
   in the engine or either consumer asserts the batch-wide invariant "no shelved/excluded word
   appears in any question." A learner can shelve a word and still be quizzed on it via a sentence.

The root cause is a boundary that was never drawn: the engine offers primitives *and* an
orchestrator, and nothing states which rules are **the engine's to guarantee** versus which are
**the consumer's to choose**. Each new consumer re-derives the answer, and they diverge.

## Proposed Solution

Draw the boundary explicitly and enforce it in code:

> **Engine = Protocol / Safety. Consumer = Strategy / Experience.**
> Every rule that determines whether a batch is *well-formed and safe* is a **pure function
> exported from `srs-engine-v2`**. Every rule about *what makes a good learning batch* stays in the
> consumer.

Concretely:

1. **Introduce a pure batch-integrity validator in the engine** — e.g.
   `validateBatch(questions, constraints): BatchValidation`, a pure function (no I/O, no state) that
   checks the invariants any batch must satisfy regardless of consumer:
   - no `excludeIds` member appears in any question — **including as a sentence tile** (closes the
     shelving leak above);
   - no duplicate question identity within the batch;
   - batch size respects the agreed bound derived from `wordsPerBatch` (sentences included or
     explicitly exempted — see Open Questions);
   - every question's `direction` is one the language/deck config permits.
   The function returns structured violations; it does not throw and does not mutate.

2. **Make integrity enforcement unavoidable, not advisory.** The cleanest enforcement point is to
   have `assembleBatch` (and the sentence path it currently ignores) run `validateBatch` before
   returning, so a malformed batch cannot leave the engine. Consumers keep their freedom to *choose*
   composers and directions, but the *result* is checked by one canonical function.

3. **Give sentences a first-class, exclusion-aware path.** `resolveEligibleContexts` gains an
   `excludeIds` parameter (or `assembleBatch` filters tiles post-hoc) so the shelving invariant is
   satisfiable at all. This is the smallest change that makes the safety rule enforceable rather
   than merely assertable.

4. **Leave strategy where it belongs.** Which directions to teach, how many sentences to interleave,
   foundational vs. vocabulary emphasis, shuffle-or-not — these remain consumer config
   (`CONFIG.sentenceDirections`, `LEARNING_CONFIG`, etc.). The engine never dictates them; it only
   guarantees the output is safe and well-formed.

This preserves the established library boundary (the engine is a library of pure engine
types/functions and a `LearningStore` interface — no app glue) while giving that library one more
pure responsibility: *defining what a valid batch is*.

## Alternatives Considered

| Alternative | Pros | Cons |
| ----------- | ---- | ---- |
| **Status quo — each consumer orchestrates freely** | No engine change; maximum consumer flexibility | The drift documented above is the steady state; every new consumer re-derives "valid batch" and diverges; the shelving leak persists unnoticed |
| **Pure batch-integrity validator in the engine (this RFC)** | Integrity guaranteed at the package boundary by one pure function; consumers keep full strategy freedom; aligns with the existing library boundary; small, testable surface | Consumers must satisfy (and, if enforced early, call through) the validation path; requires an exclusion-aware sentence path |
| **"God package" — move whole orchestration (thunk building, direction selection, quota) into a single engine `composeBatch`** | One canonical batch everywhere; zero drift by construction | Bakes UI/learning strategy into the engine → the engine becomes the bottleneck for consumer innovation; contradicts the library-boundary decision; every strategy tweak becomes an engine release |
| **Server-side orchestration — backend composes and returns the canonical batch** | Single source of truth; thin clients | Reverses the headless/offline-capable posture (D-headless-hono-backend); the CLI is a local tool with no server in that role; large surface; not a beta gate |

The distinction between rows 2 and 3 is the crux and is easy to conflate. "Integrity as pure
functions" means the engine owns a **predicate over the output** (is this batch safe/well-formed?),
*not* the **procedure that produced it** (how were thunks built and directions chosen?). Moving the
procedure into the engine is the God-package trap and is explicitly *not* proposed.

## Impact

- **Affected areas**:
  - `packages/srs-engine-v2`: new `validateBatch` (pure) + `BatchValidation` type; `assembleBatch`
    gains an integrity check on its full output (words **and** sentences); `resolveEligibleContexts`
    gains an `excludeIds` parameter; new public exports in `index.ts`.
  - `apps/srs-demo/src/composables/useLearningSession.ts` and
    `apps/cli-demo-db/src/learning-io.ts`: pass `excludeIds`/`shelvedSet` into the sentence path;
    both converge on the validated `assembleBatch` output.
  - No change crosses the library/app boundary in the wrong direction — the engine gains a pure
    function; the apps lose a hand-rolled invariant.
- **Migration effort**: **medium**. The validator and the `excludeIds` plumbing are small; the real
  work is reconciling the two consumers' *existing* divergent sentence behaviour to a single agreed
  definition (see Open Questions) and adding coverage.
- **Breaking changes**: engine-internal signature change (`resolveEligibleContexts` gains a
  parameter). No change to the API contract or persisted schema. Consumer batches may *change shape*
  once the shelving invariant is enforced (a currently-leaking shelved word will stop appearing) —
  a behaviour fix, not a contract break.

## Open Questions

- **Does `wordsPerBatch` bound sentences or not?** Today it does not — sentence volume is unbounded
  by the split. Before `validateBatch` can check a size invariant, the PO must decide whether the
  bound is words-only (status quo, sentences exempt) or total-batch. The two consumers currently
  imply different answers.
- **What is the canonical set of sentence directions per batch?** The demo teaches a configured
  subset; the CLI teaches all. Convergence requires picking one policy (most likely: consumer config
  decides *which* directions, engine only validates they are *permitted* — strategy vs. protocol).
- **Enforce eagerly or offer as a check?** Should `assembleBatch` reject a malformed batch (fail
  fast, strongest guarantee) or should `validateBatch` be a separate function consumers are trusted
  to call (looser, but avoids surprising throws in the render path)? Eager enforcement is the only
  option that actually *closes* drift; a callable-but-optional check re-opens it.
- **Is this a beta gate?** No. The beta blockers are audio, hosting, and multi-user. This is
  correctness/maintainability hardening of the batch contract. It should be sequenced as an
  engineering epic when convenient, ahead of adding a *third* consumer — after which the drift cost
  compounds.
- **Relationship to the rejected Orchestrated Composer RFC?** That RFC
  (`20260715T234829Z-orchestrated-composer-pattern.md`, Rejected) concerned *within-batch, cross-composer
  negotiation at compose time* and was rejected because within-batch dynamics live in the queue
  layer. This RFC is orthogonal: it does not add shared composer context; it adds a pure predicate
  over the finished batch. The two do not conflict.

## Corrections to the source draft

The originating draft proposed to **supersede**
`architecture/20260303T195134Z-engineering-headless-hono-backend.md` and to relate to
`engineering-integration-contract-shelving.md`. Both are struck here:

- The headless-backend ADR governs **backend topology/hosting**, an unrelated concern; a
  batch-composition boundary does not supersede it. Carrying that supersede would misrepresent the
  decision graph. If anything, "server-side orchestration" (Alternatives) is the option this RFC
  *declines*, which reinforces rather than supersedes the headless posture.
- `engineering-integration-contract-shelving.md` does not exist. The relevant ADR is
  `20260626T000000Z-engineering-shelving-stagnation-policy.md`, which is the source of the
  `excludeIds` shelving invariant this RFC proposes to enforce end-to-end (see the sentence-tile
  leak in Problem Statement).

## Related ADRs

- `20260513T000000Z-engineering-batch-execution-mechanics.md` — defines the composer/registry/assemble
  mechanics this RFC scopes; the boundary here sits directly on top of it.
- `20260512T230000Z-engineering-compose-word-batch-boundary.md`,
  `20260512T235900Z-engineering-compose-sentence-batch-boundary.md` — the per-composer boundaries;
  this RFC adds the *batch-wide* boundary they do not cover.
- `20260626T000000Z-engineering-shelving-stagnation-policy.md` — origin of the shelving exclusion
  invariant currently leaking into sentence tiles.
- `20260313T000000Z-engineering-quiz-contract-answer-authority.md` — precedent for the engine owning
  a correctness contract that consumers must honour.

## Decision

<!-- Filled in when status changes to Accepted/Rejected -->

**Recommendation (pending PO decision)**: Accept the **validator / pure-predicate** form (Alternatives
row 2), *not* the God-package or server-side forms. The drift and the shelving-tile leak are
concrete and already shipped; a single pure `validateBatch` plus an exclusion-aware sentence path
closes both without moving strategy into the engine or reversing the headless posture. Sequence as
an engineering epic before a third batch consumer exists. Resolve the "wordsPerBatch bounds
sentences?" and "canonical directions" open questions with the PO first — they change what the
validator asserts.

**Decision**: {Accepted / Rejected}
**Rationale**: {Why}
**Next step**: {Epic EP## / ADR## / N/A}
