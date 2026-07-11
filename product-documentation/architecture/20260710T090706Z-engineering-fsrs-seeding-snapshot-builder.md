# ADR: FSRS Review Seeding — Snapshot Builder over an Injectable Clock

**Date**: 20260710T090706Z
**Status**: Accepted

<!-- Status: Accepted | Superseded | Deprecated -->

**Superseded by**: N/A
**Epic**: EP39 — review-mode redesign
**RFC**: N/A

---

## Context

Manual verification of review scenarios is currently painful. To reach a given review state a tester
hand-writes JSON fixtures and fires multi-step `curl` chains against `/api/test/seed`
(see [apps/srs-demo/README.md](../../apps/srs-demo/README.md)) — extracting word IDs, backdating
`due`, restarting the server when routes change. This is slow and error-prone, and it is the main
friction in manually testing the EP39 review redesign.

Two questions were raised and resolved during design:

**1. Is this a database-library problem?** The pain looked like "Drizzle has no built-in seeding
(unlike Knex.js)." Investigation showed otherwise. Seeding here is **domain-logic replay**, not row
insertion: `applyFixture` in [test-seed.ts](../../apps/server/src/routes/test-seed.ts) drives
`FsrsScheduler.seed()`, `SqliteLearningStore.upsertWordState()`, and `SqliteReviewStore.upsertReviewCard()`
— it computes a real FSRS `Card`, it does not write raw rows. Knex's `seed:run` (and Kysely's
`kysely-ctl`) only do raw inserts; neither can produce a valid FSRS `scheduler_data` blob without
calling our scheduler anyway. **No query library fixes this.** Drizzle stays; migrations/setup are fine.

**2. Do we need an injectable clock to replay multi-day scenarios?** FSRS schedules reviews across
many days, so testing lapse/relearn/interval-growth behaviour appears to need time control. The stack
is already almost entirely time-pure: `FsrsScheduler.seed/schedule/isDue`
([types.ts](../../packages/srs-review/src/types.ts)) and `SqliteReviewStore.getDueReviewCards(userId, now)`
all take `now` as an explicit parameter. Only **5 boundary `new Date()` sites** (reviews.ts ×3,
answer.ts ×1, test-seed.ts ×1) inject real time. An injectable clock threaded through those sites
would enable live progression replay — but it touches production code paths.

The tester's stated preference: **snapshots are cleaner**; accept them for everything provided
multi-day span scenarios can also be expressed as snapshots.

---

## Decision

**Seed all scenarios — including multi-day ones — as snapshots produced by a shared scenario builder,
with no injectable clock and no changes to production time handling.**

1. **Stay on Drizzle.** The seeding problem is domain-logic replay, not a query-builder feature.

2. **Multi-day states are builder-computed snapshots via backdated timestamps.** Because
   `FsrsScheduler.seed/schedule` already accept `now` as an argument, the scenario builder reconstructs
   a real review history by composing them with **explicit, chronologically-increasing backdated
   `Date`s** (e.g. graduate at `now − 21d`, review at `now − 18d`, lapse at `now − 8d`, relearn at
   `now − 1d`), then inserts the resulting card. The card's internal FSRS state (stability, difficulty,
   reps, lapses, state, `due`) is engine-computed and internally consistent — not hand-authored. The
   5 boundary `new Date()` sites are **untouched**; runtime seeding stays a pure insert.

3. **One shared builder, two entry points.** Lift the scenario builder out of the route-private
   `applyFixture`. The existing HTTP endpoint `POST /api/test/seed/scenario` stays (it also owns the
   in-memory config overrides — `shelvingConfigOverride`/`sentenceConfigOverride` live in the running
   server's process memory and can only be set over HTTP). A new in-process `pnpm seed <scenario>` CLI
   owns DB state seeding.

4. **Two-terminal manual-test loop.** Terminal 1: `pnpm --filter @gll/srs-demo dev:all` (app + server,
   holds the DB). Terminal 2: `pnpm seed <scenario>`, then reload the browser. This works because the
   server persists to a **file** DB (`.data/srs-demo.db`) and every route reads fresh per request (no
   in-memory learner-state cache), so a committed write from the CLI is visible on the next API call —
   **no server restart**.

5. **Hard requirement — zero-config DB path.** The seed CLI must default to the **same path the server
   resolves** (`GLL_DB_PATH` → else `.data/srs-demo.db`). Path drift means seeding a DB nobody reads.

---

## Consequences

**Positive**:

- Manual testing collapses from `curl` chains to one command per scenario; the two-terminal loop needs
  no server restart.
- Multi-day scenarios gain **engine-grade fidelity** — the intermediate FSRS state is derived by the
  real scheduler, so it cannot be subtly wrong the way hand-authored `scheduler_data` would be.
- **Zero production surface change** — the 5 boundary `new Date()` sites and all route logic are
  untouched; strictly additive to the test/seed layer.
- Drizzle is retained; no second query layer, no schema drift, no migration.
- HTTP and CLI share one builder — no divergence between wire-seeding (e2e/browser) and terminal-seeding.

**Negative**:

- The progression is not skipped, only relocated: the builder must **replay** each step, and steps must
  be emitted in chronological order (increasing `now`) or FSRS sees negative elapsed time.
- Two entry points (HTTP + CLI) over the shared builder is marginally more surface to maintain than one.
- Config-override scenarios remain HTTP-only (in-memory server state); the CLI cannot set them. Testers
  must know which door a scenario needs (state → CLI, config → HTTP).

**Neutral**:

- Snapshot seeding cannot reproduce a *live* answer→advance→answer progression against a moving clock;
  if a future need arises (e.g. testing the answer route's own time-gating across days) the injectable
  clock remains an open, separable option over the same 5 sites.
- The DB opens without WAL (`new Database(path)`); a rare `SQLITE_BUSY` is possible if seeding coincides
  with answering. Enabling WAL would remove it — deferred as a nice-to-have.

---

## Alternatives Considered

| Option | Why Not Chosen |
|---|---|
| Switch to **Knex.js** for its built-in seed CLI | Too heavy; doesn't run on Workers/D1; a second query layer over the Drizzle schema (drift risk); and its seeders still can't produce FSRS state without calling our scheduler — the "built-in seeding" advantage is only a runner convention |
| Switch to **Kysely** (`kysely-ctl` seed convention) | Same convention-only benefit as Knex without the edge/drift problems, but still no FSRS-aware seeding; not worth swapping the runtime query layer for a convention we can build in ~30 lines |
| **`drizzle-seed`** package | Generates random/fake bulk data (faker-style); our scenarios are deterministic named states — wrong tool |
| **Injectable clock** threaded through the 5 boundary sites | Enables live multi-day *progression* replay, but touches production code paths for a need that snapshots already satisfy; heavier surface for equal fidelity. Kept as a separable future option, not adopted now |
| **Hand-author** the FSRS `scheduler_data` for multi-day cards | Stability/difficulty are non-intuitive; hand-picked values are internally inconsistent with any real history, so `isDue` and the next `schedule()` misbehave — the exact "subtly wrong" trap the builder avoids |
| **CLI only** (drop HTTP seed) | HTTP seed owns in-memory config overrides and serves e2e/browser flows; removing it loses those. Both doors kept over one builder |

---

_Related ADRs:_

- [20260706T125834Z-engineering-async-storage-contract.md](20260706T125834Z-engineering-async-storage-contract.md) — async, driver-agnostic storage boundary; why Drizzle stays behind it
- [20260708T005635Z-engineering-srs-review-phase-packaging.md](20260708T005635Z-engineering-srs-review-phase-packaging.md) — `@gll/srs-review` boundaries; `FsrsScheduler` and the `now`-parameterised interface this ADR relies on
- [20260709T143643Z-engineering-review-ahead-and-due-gated-advance.md](20260709T143643Z-engineering-review-ahead-and-due-gated-advance.md) — the due-gated advance rule and the 5 boundary `new Date()` sites left untouched
- [20260620T000000Z-engineering-database-schema.md](20260620T000000Z-engineering-database-schema.md) — `review_cards.scheduler_data` opaque JSON that the builder produces
