# Gap Analysis: Test Strategy for Consolidating the Two Seed-Scenario Seeders

**Date:** 2026-07-10
**Author:** JC Lee
**Trigger:** ADR — `product-documentation/architecture/20260710T112300Z-engineering-seed-scenario-placement-and-consolidation.md` (Decision #2/#3: consolidate the two demo seeders into `@gll/srs-fixtures`, YAGNI-gated)

---

## Context

**Business driver:** The ADR resolves *where* seed-scenario logic belongs and records a
consolidation of two divergent seeders (`apps/server/src/seed` and `apps/cli-demo-db`) into a
future `@gll/srs-fixtures` package. The extraction is deferred behind a concrete trigger, but
whenever it fires it will move FSRS-history-replay code that writes learner state to a shared
SQLite store used by demos and manual verification. This analysis answers the question raised
before committing an epic: **is a testing strategy that guarantees the migration "works smoothly
across both platforms" actually possible, and what shape must it take?**

**Scope:** The pure builder + write-glue seam that would move into `@gll/srs-fixtures`
([scenario-builder.ts](../../apps/server/src/seed/scenario-builder.ts),
[apply-scenario.ts](../../apps/server/src/seed/apply-scenario.ts)) and the `cli-demo-db` seeders
the ADR marks for deletion
([seed-graduated-review-cards.ts](../../apps/cli-demo-db/src/seed-graduated-review-cards.ts),
[seed-mock-reviews.ts](../../apps/cli-demo-db/src/seed-mock-reviews.ts),
[db-fixtures.ts](../../apps/cli-demo-db/src/db-fixtures.ts)). Out of scope: the package name, the
HTTP route contract, and the ADR's placement decision itself (settled — the core does not move
into `@gll/db`).

**Terminology:** "The two platforms" in the request = the two consumer code paths that seed the
same store — the **server seeder** (`apps/server`, CLI + `POST /api/test/seed/scenario`) and the
**cli-demo-db seeder** (the terminal demo). They are not two runtime environments; they are two
implementations.

---

## Research Findings

### Finding 1 — The two platforms do not produce the same output, so "run both, diff the DB" is not a valid test

A migration-equivalence test presumes a single golden output both sides must match. That premise
is false here. The seeders overlap only in that both call `scheduler.seed(...)` and write
`ReviewCard`s to one store; their inputs, outputs, and determinism differ by design:

| Path | Input | Output | Deterministic |
|---|---|---|---|
| server `buildScenario` + `applyBuiltScenario` | named specs; backdated multi-step FSRS histories | word states + review cards + derived `expected` outcome | **Yes** — pure; injected `now` + scheduler; deterministic `dueOverrideMs` |
| cli `seedMockReviews` | word ids pulled from the live DB at runtime | 1 card/word, `due` forced to `now` | No — depends on curriculum import |
| cli `seedGraduatedReviewCards` | `GraduationPerformance` derived from live `RunState` | cards from real gameplay | No — depends on gameplay |
| cli `db-fixtures` | Thai-text → id lookup | word states only, **no review cards** | Depends on DB contents |

There is no shared "golden DB state" the two consumers must both reproduce. The testable seam is
the **pure builder**, not a cross-consumer DB diff.

### Finding 2 — The migratable core is pure and deterministic, which makes characterization tests feasible

[buildScenario](../../apps/server/src/seed/scenario-builder.ts#L97) takes `now` and the scheduler
as injected dependencies and derives `expected` from the built cards (never trusting the spec), so
for a fixed `now` its output is fully reproducible. This is exactly the property a
refactor-safety net needs: snapshot each seeder's current output *before* extraction, re-run the
snapshot against `@gll/srs-fixtures` *after*, assert byte-identical. Determinism is a property of
the core, not of the app-side data pull.

### Finding 3 — `seedGraduatedReviewCards` is a PRODUCTION path, not a demo seeder

The ADR lists `seed-graduated-review-cards.ts` among the "overlapping seeders" to delete at
extraction. But it is imported by the live learning loop —
[learning-runner-db.ts:62](../../apps/cli-demo-db/src/learning-runner-db.ts#L62) calls it as the
**write-on-graduation** persistence step, idempotently seeding a card the first time a word
graduates during real play. Deleting it, or folding it into a fixtures package, would remove
production graduation persistence from the CLI demo. This is the single highest risk in the
migration and the ADR does not distinguish it from the throwaway demo seeders.

### Finding 4 — Non-deterministic seams can only be tested at the pure-core level

`seedMockReviews` derives its word ids from `buildQuizItems(db)` at runtime and `db-fixtures`
resolves ids by Thai-text lookup. Their DB output depends on which curriculum was imported, so a
DB-level golden test is environment-fragile. The stable test seam is the pure function
(scheduler + explicit ids in, cards out); the app-side data pull is stubbed.

### Finding 5 — A shared catalogue creates a new, testable invariant

Post-consolidation both consumers author from one `REVIEW_SCENARIOS` catalogue. Because `expected`
is derived from the built cards, a single test that asserts every catalogue scenario builds its
declared `dueNow`/`anytime`/`reviewUnlocked` outcome guarantees the ADR's headline benefit — "a
scenario is authored once and its FSRS composition can't drift between demos." This invariant does
not exist today (two hand-written code paths) and is the thing the migration is *for*.

---

## Current State

- Two seeding stacks write review cards to the same SQLite store through independent code paths.
- The server stack has tests under `apps/server/src/seed/__tests__`; the cli stack has tests under
  `apps/cli-demo-db/src/__tests__` (including `seed-graduated-review-cards.test.ts`,
  `seed-mock-reviews.test.ts`). No test asserts equivalence or a shared catalogue across the two.
- `@gll/srs-fixtures` does not exist; no code has moved (per the ADR's "no code moves" consequence).
- `seedGraduatedReviewCards` is wired into the production learning runner, not gated as a fixture.

---

## Desired State

- Before any extraction, a **characterization (golden) suite per consumer** pins each seeder's
  current deterministic output, so the extraction is a provable no-op for that consumer.
- After extraction, a **shared-catalogue invariant test** asserts each scenario builds its declared
  `expected` outcome from the single catalogue.
- The production graduation path is explicitly carved out of the "delete these seeders" scope and
  covered by a test proving the runner still persists on graduation.
- Non-deterministic seams are tested at the pure-core level; DB-level assertions are reserved for
  the deterministic `buildScenario` path.

---

## Gap Register

| ID | Dimension | Current State | Desired State | Gap | Type | Impact |
|---|---|---|---|---|---|---|
| G-001 | Test — equivalence premise | "2 platforms" assumed to produce matching output | Recognise they diverge by design; test the pure seam, not a cross-consumer DB diff | A naive equivalence/diff test would be built on a false premise and give false confidence | Missing | High — wrong strategy is worse than none |
| G-002 | Test — refactor safety net | No golden snapshot of current seeder output | Per-consumer characterization tests pin deterministic output pre-extraction | No proof the extraction preserves behaviour | Missing | High — this is the deliverable that makes extraction safe |
| G-003 | Scope — production path mislabelled | `seedGraduatedReviewCards` grouped with demo seeders to delete | Carved out + covered by a runner-persistence test | ADR would delete a live write-on-graduation path | Missing | High — data-loss / regression risk in the demo |
| G-004 | Test — shared-catalogue invariant | Two hand-written code paths, no drift guard | One test asserts each catalogue scenario → declared `expected` | No mechanism enforces the ADR's "authored once" benefit | Missing | Med — the invariant is the point of consolidating |
| G-005 | Test — non-deterministic seams | `seedMockReviews`/`db-fixtures` output depends on imported curriculum | Test the pure core with explicit ids; stub the DB pull | DB-level golden tests here are environment-fragile | Partial | Med — flaky tests if mis-scoped |
| G-006 | Process — trigger gate | ADR defers extraction (YAGNI); no test scaffold staged | Test harness authored now so extraction is cheap when the trigger fires | Harness built under time pressure at trigger time, or skipped | Partial | Med — determines whether the epic is "now" or "parked" |

---

## Prioritized Gaps

| Priority | Gap ID | Rationale |
|---|---|---|
| 1 | G-003 | A correctness/scope error in the ADR itself — cheapest to fix now (re-scope one file); ignoring it risks deleting production persistence |
| 2 | G-002 | The core safety net; everything else assumes it. Feasible today because `buildScenario` is pure + deterministic |
| 3 | G-001 | Reframes the whole test strategy — must be settled before writing any test, or effort goes into an invalid diff |
| 4 | G-004 | Delivers the ADR's stated benefit; only meaningful once the catalogue is shared |
| 5 | G-005 | Prevents flaky tests; scope decision, low cost |
| 6 | G-006 | Governance — decides epic shape (gated vs. execute-now) |

---

## Recommendations

1. **Reject the cross-platform equivalence test; adopt per-consumer characterization tests.** The
   two seeders are not interchangeable implementations. Snapshot each seeder's current deterministic
   output (fix `now`, use the existing `dueOverrideMs` placements) and re-run those snapshots against
   `@gll/srs-fixtures` after extraction. This is the real "migration works smoothly" guarantee and it
   is feasible because the core is pure. **This test harness is the correct headline deliverable of any
   epic drawn from this ADR** — it is what makes the deferred extraction cheap and safe.

2. **Re-scope the ADR before extracting: `seedGraduatedReviewCards` is not a demo seeder.** It is the
   live write-on-graduation path in [learning-runner-db.ts:62](../../apps/cli-demo-db/src/learning-runner-db.ts#L62).
   Either exclude it from the "delete overlapping seeders" list, or if it is re-homed, cover the runner
   with a test proving graduation still persists a card. Do not delete it as duplication.

3. **Add a shared-catalogue invariant test post-extraction** — for every scenario in the catalogue,
   assert the built cards yield the declared `dueNow`/`anytime`/`reviewUnlocked`. This is what enforces
   "authored once, can't drift," which is the reason to consolidate at all.

4. **Test non-deterministic seams at the pure-core level only.** For `seedMockReviews`/`db-fixtures`,
   pass explicit ids and assert the returned cards; stub `buildQuizItems`/the text-lookup. Reserve
   DB-level golden assertions for the deterministic `buildScenario` path.

5. **Author the test harness now, gate the code move.** The characterization suite and the runner
   carve-out can be written against today's code without moving anything — honoring the ADR's YAGNI
   gate while ensuring the eventual extraction (when `cli-demo-db` needs `relapsed-due`/`mature-interval`)
   is a provable no-op. This favours a **trigger-gated extraction epic whose deliverable is the test
   harness**, over a "migrate and prove equivalence now" epic (whose equivalence premise is invalid).

---

## Out of Scope

- **The ADR's placement decision** (core stays out of `@gll/db`) — settled; not re-litigated here.
- **Final package name** `@gll/srs-fixtures` — decided at extraction time per the ADR.
- **HTTP route / CLI argv contracts** — app-side, injected; unaffected by the pure-core test seam.
- **Performance of seeding** — not a migration-correctness concern.

---

## Related

- ADR: `product-documentation/architecture/20260710T112300Z-engineering-seed-scenario-placement-and-consolidation.md`
- Companion ADR: `product-documentation/architecture/20260710T090706Z-engineering-fsrs-seeding-snapshot-builder.md` (why seeding is domain-replay, not raw inserts)
- Server seam: [scenario-builder.ts](../../apps/server/src/seed/scenario-builder.ts), [apply-scenario.ts](../../apps/server/src/seed/apply-scenario.ts)
- cli-demo-db seeders: [seed-graduated-review-cards.ts](../../apps/cli-demo-db/src/seed-graduated-review-cards.ts), [seed-mock-reviews.ts](../../apps/cli-demo-db/src/seed-mock-reviews.ts), [db-fixtures.ts](../../apps/cli-demo-db/src/db-fixtures.ts)
- Production path at risk: [learning-runner-db.ts:62](../../apps/cli-demo-db/src/learning-runner-db.ts#L62)
