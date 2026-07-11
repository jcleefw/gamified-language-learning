# ADR: Seed-Scenario Placement — Composition Layer, not `@gll/db`; Consolidate the Two Demo Seeders

**Date**: 20260710T112300Z
**Status**: Accepted

<!-- Status: Accepted | Superseded | Deprecated -->

**Superseded by**: N/A
**Epic**: EP39 — review-mode redesign
**RFC**: N/A

---

## Context

EP39-DS03 added a named-scenario seeder to `apps/server`
([scenario-builder.ts](../../apps/server/src/seed/scenario-builder.ts),
[apply-scenario.ts](../../apps/server/src/seed/apply-scenario.ts),
[run-seed.ts](../../apps/server/src/seed/run-seed.ts),
[cli.ts](../../apps/server/src/seed/cli.ts)), exposed both as a `pnpm --filter @gll/server seed` CLI
and a `POST /api/test/seed/scenario` HTTP endpoint. See the companion ADR
[FSRS Review Seeding — Snapshot Builder](20260710T090706Z-engineering-fsrs-seeding-snapshot-builder.md)
for why seeding is domain-replay rather than raw inserts.

Two questions were then raised about **where this code belongs**:

**1. Is this "generally dealing with DB" — should the CLI live in `@gll/db` as a shared util?**
No. The DB is only the write sink at the tail. The weight of the logic sits above the storage layer:

| Unit | Real dependency | Nature |
| --- | --- | --- |
| [scenario-builder.ts](../../apps/server/src/seed/scenario-builder.ts) | `@gll/srs-review` (`FsrsScheduler`) + `LEARNING_CONFIG` | **pure** — touches no DB |
| [apply-scenario.ts](../../apps/server/src/seed/apply-scenario.ts) | `@gll/db` stores | thin write glue |
| [run-seed.ts](../../apps/server/src/seed/run-seed.ts) | `@gll/db` + `@gll/srs-review` | orchestration |
| [cli.ts](../../apps/server/src/seed/cli.ts) + [db-path.ts](../../apps/server/src/config/db-path.ts) | server process / env | server-specific |

The core (`scenario-builder.ts`) composes `FsrsScheduler.seed`/`schedule` and reads `LEARNING_CONFIG`;
it never writes a row. Moving this into `@gll/db` would force that boundary package to depend **up**
onto `@gll/srs-review`, `@gll/srs-engine-v2`, and the server's `LEARNING_CONFIG` — inverting the
layering. This is the same principle already recorded for `srs-engine-v2` ("a library, not an app —
no DB runners or app glue"): boundary packages do not absorb composition logic. Scenario-building sits
*above* `@gll/db`, not inside it.

**2. Are the two demos duplicating the same seeding?** Yes. `apps/cli-demo-db` already ships a parallel
seeding stack over the same SQLite DB — `db-tools-cli.ts` (`seed baseline|mid-session|sentence-ready`),
`seed-graduated-review-cards.ts`, `seed-mock-reviews.ts`, `db-fixtures.ts` — built independently of the
new `apps/server` seeder. Both demos now replay FSRS histories and write review cards to the same store
through two separate, diverging code paths. The consolidation is valid: this is the same thing
implemented twice.

## Decision

1. **Do not place seed-scenario logic in `@gll/db`.** It stays in the composition layer (currently
   `apps/server/src/seed`). `@gll/db` remains a pure storage boundary that no domain/scheduler code
   depends on it from within.

2. **Consolidate the two demo seeders into one shared composition package** — a new
   `@gll/srs-fixtures` (name provisional) that depends on `@gll/db` + `@gll/srs-review` and owns the
   pure `scenario-builder` + `apply-scenario` core. App-specific concerns (`LEARNING_CONFIG`,
   `db-path`, argv/CLI, HTTP route) stay app-side and are **injected** — the code is already shaped for
   this (`buildScenario` and `runSeed` take their deps as arguments).

3. **Sequence it lazily (YAGNI-gated).** Leave the `apps/server` seeder where it is today. The concrete
   trigger to extract `@gll/srs-fixtures` is: **the first time `cli-demo-db` needs the named span-days
   scenarios** (`relapsed-due`, `mature-interval`) that its current fixtures cannot produce. At that
   point, extract the pure core into the package and **delete `cli-demo-db`'s overlapping seeders**
   (`seed-graduated-review-cards.ts`, `seed-mock-reviews.ts`, and the fixture-building half of
   `db-tools.ts`), repointing its `db-tools-cli` scenarios at the shared catalogue.

## Consequences

**Positive**:

- Dependency direction stays correct: `@gll/db` has no upward dependency on schedulers, engine types,
  or app config.
- A single scenario catalogue eventually serves all three consumers (server CLI, server HTTP route,
  `cli-demo-db`), so a scenario is authored once and its FSRS composition can't drift between demos.
- The extraction is cheap when it comes: the shareable core is already the pure, dependency-injected
  half; only its import path changes.

**Negative**:

- Until the trigger fires, the duplication between `apps/server/src/seed` and `apps/cli-demo-db`'s
  seeders persists — two places to touch if the underlying store contracts change.
- A new package adds one more workspace boundary and build target to maintain.

**Neutral**:

- No code moves as a result of this ADR; it records the placement rule and the consolidation trigger.
- Package name `@gll/srs-fixtures` is provisional; final name decided at extraction time.
