# ADR: SRS Engine Consolidation — Redefined Product Scope & Package Merge

**Status:** Accepted

<!-- Status: Proposed | Accepted | Superseded | Deprecated -->

**Date:** 2026-07-17

**Deciders:** JC Lee / PO

**Epic:** N/A — pre-epic architecture decision

**RFC:** N/A

**Superseded by:** N/A

**Revises:** [20260708T005635Z — SRS Review Phase Packaging](20260708T005635Z-engineering-srs-review-phase-packaging.md) — its **D1 packaging decision only** (scheduler lives in its own sibling package). D2–D6 of that ADR (async `ReviewStore` shape, app-owns-the-runner, rating-inferred-not-asked behavioural design) are **not** touched by this ADR and still stand.

---

## Context

Today the word lifecycle — learn a word, get temporarily shelved if stuck, graduate, get scheduled for long-term review — is split across three separate packages:

- `@gll/srs-engine-v2` — the learning phase only (introduce words, quiz them, track mastery, decide graduation).
- `@gll/srs-review` — the review phase (FSRS-based long-term scheduling for graduated words). ~124 lines of source.
- `@gll/srs-shelving` — the shelving phase (temporarily pulling stuck words out of rotation). ~65 lines of source.

This split was a deliberate choice (see the Revises ADR above), made because `srs-engine-v2`'s stated purpose was narrowly "the Learning phase" — so anything that wasn't Learning got pushed out into a sibling package to keep the engine "pure." Each sibling now carries a full package's worth of scaffolding (its own `package.json`, two `tsconfig.json` files, a `vitest.config`, a `README`, a `CODEMAP.md`) around a tiny amount of actual logic.

The underlying problem is that **`srs-engine-v2`'s scope was never correctly defined as "the whole word lifecycle."** It was defined as "the Learning phase," which made Review and Shelving look like separate concerns instead of two more phases of the same lifecycle. That wrong scope is what produced the package sprawl, and left uncorrected it will keep happening — every future lifecycle phase will again look like "a new sibling package" instead of "a new phase inside the engine."

A survey of actual usage confirms there is no real coupling problem blocking a merge:
- `srs-shelving` declares a dependency on `srs-engine-v2` in its `package.json` but does not import anything from it.
- `srs-review` has no dependency on either other package at all.
- Neither `srs-review` nor `srs-shelving` is imported by the other.
- The frontend app (`apps/srs-demo`) imports `srs-engine-v2` and `srs-shelving` directly (they run in the browser), but never imports `srs-review` — the review scheduler is only ever called from the server (`apps/server`). This asymmetry matters for how the merged package should be shaped (see D3).
- Persistence is already correctly separated: `packages/db` already has both an `ILearningStore` (learning + shelving methods) and an `IReviewStore` (review methods), matching the "engine holds no persistence" rule this ADR does not change.

## Decision

### D1 — Redefine the product scope of the engine

`@gll/srs-engine`'s job is the **entire word lifecycle**, not just the Learning phase:

> The engine owns introducing a word, drilling it to mastery, temporarily shelving it when a learner is stuck, graduating it, and scheduling when it resurfaces for long-term review. Learning, Shelving, and Review are three phases of one lifecycle, not a core concern plus two bolted-on extras. The engine remains pure logic — no database, no network, no UI — and persistence stays the caller's job via store interfaces the engine does not implement.

This replaces the narrower "standalone SRS quiz engine [for the learning phase]" framing in the current `packages/srs-engine-v2/README.md` and `docs/01-stakeholder.md`.

`docs/01-stakeholder.md` and `README.md` have already been updated to the new scope (2026-07-17, ahead of this ADR's implementation). The remaining docs still describing Learning only — `docs/02-concepts.md` (developer/architecture view) and `docs/03-walkthrough.md` (step-by-step trace) — are **in scope for the consolidation work itself**, done at the same time as the package merge (D2), not a separate later follow-up. They need Shelving and Review sections added alongside the existing Learning content, matching the structure already applied to `docs/01-stakeholder.md`.

### D2 — Merge `srs-review` and `srs-shelving` into the engine package

Fold both sibling packages' source into the engine package as internal modules. Delete the two standalone packages (their `package.json`, tsconfig, vitest config, README, CODEMAP) once the merge is verified — do not leave empty shells behind.

### D3 — One package, per-phase sub-path exports (no single barrel `index.ts`)

Because the browser app only ever needs Learning + Shelving, and only the server needs Review, the merged package must not force every consumer to pull in every phase. Expose each phase as its own import sub-path instead of re-exporting everything from one `index.ts`:

```
@gll/srs-engine/learn      → composeWordBatch, initAdaptiveSession, mastery/session logic
@gll/srs-engine/shelving   → evaluateShelving, unshelveAll, ShelvingConfig
@gll/srs-engine/review     → FsrsScheduler, ReviewScheduler, ReviewCard (pulls in ts-fsrs)
```

`apps/srs-demo` imports only `learn` and `shelving`. `apps/server` imports all three. No consumer's bundle carries a phase it never calls.

### D4 — Package rename: `srs-engine-v2` → `srs-engine`

The `v2` suffix was versioning against a since-removed v1 (per EP32 cleanup). Carrying a "v2" name forward as the definitive, consolidated lifecycle library is confusing baggage with no live v1 to distinguish from. Rename the package to `@gll/srs-engine` as part of this consolidation. (Flagging this explicitly as a call the PO should confirm or veto — it's a mechanical but repo-wide rename.)

### D5 — Persistence boundary is unchanged

`packages/db` keeps owning `ILearningStore` and `IReviewStore` exactly as they exist today, including the shelving-related methods already on `ILearningStore` (`getShelvedWords`, `shelveWord`, `unshelveWord`, `unshelveAllWords`). Nothing about save/load responsibility moves. This ADR is a pure-logic package merge, not a persistence redesign.

## Rationale

- The package split was a symptom of a wrong scope definition, not a real architectural boundary — fixing the scope definition removes the reason for the split.
- No real dependency coupling exists between the three packages today (one declared-but-unused edge, no others), so the merge is low-risk.
- Per-phase sub-paths preserve the one real constraint that mattered (browser bundle shouldn't carry server-only review/FSRS code) without needing three separate packages to get it.
- Keeps the already-correct persistence boundary (`packages/db` owns stores) untouched — this ADR narrows scope to packaging and product definition only.

## Alternatives Considered

| Option | Pros | Cons | Why Not Chosen |
| ------ | ---- | ---- | -------------- |
| Keep three sibling packages (status quo) | No migration work | Perpetuates the scattered-package problem the PO flagged; scaffolding overhead vastly exceeds actual logic in `srs-review`/`srs-shelving` | Doesn't fix the root cause (wrong scope definition) |
| Merge everything into one `index.ts` barrel export | Simplest possible package shape | Browser bundle risks carrying server-only review/FSRS code it never calls | Conflicts with the one real constraint (bundle leanness) |
| Merge scheduler/shelving logic but keep `srs-review`/`srs-shelving` as thin re-export shims | Avoids a big-bang import-path migration | Keeps the scaffolding overhead this ADR exists to remove; two boundaries to maintain instead of one | Doesn't actually solve the sprawl problem, just hides it |

## Consequences

**Positive:**

- One library with a clearly and correctly defined scope: the whole word lifecycle, not "Learning plus two afterthoughts."
- Removes duplicated package scaffolding for ~190 lines of actual logic (`srs-review` + `srs-shelving` combined).
- Future lifecycle phases have an obvious home (a new sub-path inside the engine) instead of defaulting to "spin up another sibling package."
- Browser bundle stays lean via sub-path exports.

**Negative / Risks:**

- Repo-wide import-path updates wherever `@gll/srs-engine-v2`, `@gll/srs-review`, or `@gll/srs-shelving` are currently imported (apps/srs-demo, apps/server, seed scripts, tests).
- The rename (D4) touches every consumer's `package.json` dependency name in addition to import paths — larger mechanical diff than the merge alone.
- `docs/02-concepts.md` and `docs/03-walkthrough.md` need Shelving/Review sections added, matching `docs/01-stakeholder.md` (already done). This is part of the consolidation work (D2), done alongside the package merge, not a separate follow-up.

**Neutral:**

- No change to persistence, store interfaces, FSRS behaviour, or rating-inference logic — this is packaging and product-scope only.

## Related

- ADR: `20260708T005635Z-engineering-srs-review-phase-packaging.md` — D1 (packaging) revised by this ADR; D2–D6 (store shape, runner, rating inference) unaffected.
- ADR: `20260626T000000Z-engineering-shelving-stagnation-policy.md` — established `@gll/srs-shelving`'s current (minimal) scope; unaffected in content, only in package location.
- Memory: `.agents/memory/EP30--persistent-storage/srs-engine-v2-library-boundary.md` — states `LearningStore` interface definition belongs in the engine package. Current code has `ILearningStore` living in `packages/db` instead, which this ADR does not change and does not attempt to reconcile — flagged here as a separate, pre-existing doc/code mismatch worth a follow-up correction.
