# EP39-DS03: FSRS Review Seeding — Snapshot Builder & Seed CLI Specification

**Date**: 20260710T090952Z
**Status**: Draft
**Epic**: [EP39 - Review Mode Redesign](../../plans/epics/EP39-review-mode-redesign.md)

**ADR**: [FSRS Review Seeding — Snapshot Builder over an Injectable Clock](../../../product-documentation/architecture/20260710T090706Z-engineering-fsrs-seeding-snapshot-builder.md)

---

## 1. Feature Overview

Testing/verification infrastructure for EP39. Manual verification of review scenarios today requires
hand-authored JSON fixtures and multi-step `curl` chains (see [apps/srs-demo/README.md](../../../apps/srs-demo/README.md)),
including hand-backdating `due`. This DS replaces that with a **shared scenario builder** that produces
every review state — including **multi-day FSRS histories** — as **snapshots**, plus a zero-config
`pnpm seed` **CLI** so a manual tester can drive state from a second terminal without booting anything
or writing JSON.

**HOW**, in one line: because `FsrsScheduler.seed/schedule` already take `now` as a parameter
([packages/srs-review/src/types.ts](../../../packages/srs-review/src/types.ts)), a multi-day card is
built by composing those calls with **chronologically-increasing backdated `Date`s**, then inserting
the engine-computed endpoint card. No injectable clock; the 5 boundary `new Date()` sites (reviews.ts ×3,
answer.ts ×1, test-seed.ts ×1) are untouched; runtime seeding stays a pure insert.

This is **additive test infrastructure** — no production route logic, no schema, no scheduler change.

## 2. Core Requirements

| Requirement | Decision | Rationale |
| --- | --- | --- |
| Stay on Drizzle | Keep `@gll/db` as-is | Seeding is domain-logic replay, not a query-builder feature — no library helps (ADR Alternatives) |
| Multi-day states | Builder-computed **snapshots** via backdated timestamps | Snapshots are cleaner; fidelity is engine-grade because the card is scheduler-computed, not hand-authored |
| No injectable clock | 5 boundary `new Date()` sites untouched | Snapshots satisfy the need without touching production time paths (ADR §Decision.2) |
| Single source of truth | One shared builder; HTTP + CLI both call it | No divergence between wire-seeding (e2e/browser) and terminal-seeding |
| HTTP seed stays | Keep `POST /api/test/seed/scenario` | It owns in-memory config overrides (`shelvingConfigOverride`/`sentenceConfigOverride`) an out-of-process CLI cannot set |
| CLI owns DB state | New `pnpm seed <scenario>` | The 2-terminal manual loop the tester chose |
| Zero-config DB path | CLI defaults to server's resolution: `GLL_DB_PATH` → else `.data/srs-demo.db` | Path drift = seeding a DB nobody reads (hard requirement, ADR §Decision.5) |
| Chronological steps | Builder enforces increasing `now` per step | Out-of-order steps make FSRS see negative elapsed time |

## 3. Data Structures

```typescript
// A single backdated review action, composed into a real FSRS history.
interface ScenarioStep {
  /** Offset from `now` in ms; must be negative and strictly increasing across steps (older → newer). */
  offsetMs: number;
  /** 'graduate' seeds the initial card; 'review' advances an existing one. */
  kind: 'graduate' | 'review';
  /** Rating applied for 'review' steps (server-authoritative model uses correctness→rating). */
  rating?: ReviewRating;
  /** Graduation performance for the 'graduate' step; defaults to a 'good' seed. */
  performance?: GraduationPerformance;
}

// A named, deterministic scenario. Word states + a per-word FSRS history.
interface ReviewScenarioSpec {
  name: string;                 // 'mastered-fresh' | 'mastered-due' | 'review-only' | 'relapsed-due' | 'mature-interval' | …
  description: string;
  seedWordState: boolean;       // true → also upsert a mastered WordState (review-only = false, BUG01 repro)
  steps: ScenarioStep[];        // [] → no card; single graduate → fresh; multi → multi-day snapshot
  expected: ExpectedOutcome;    // asserted by CLI --dry-run and e2e
}

interface ExpectedOutcome { dueNow: number; anytime: number; reviewUnlocked: boolean }

// The shared builder — pure w.r.t. wiring; caller supplies the stores, deck words, and anchor `now`.
// Composes FsrsScheduler.seed/schedule with (now + step.offsetMs) and returns the endpoint card(s).
function buildScenario(
  spec: ReviewScenarioSpec,
  ctx: { wordIds: string[]; deckId: string; now: Date; scheduler: FsrsScheduler },
): { wordStates: WordStateInput[]; reviewCards: ReviewCard[]; expected: ExpectedOutcome };

// CLI surface
// pnpm seed <scenario> [--count N] [--deck <deckId>] [--dry-run] [--list]
interface SeedCliArgs {
  scenario?: string;   // omitted with --list
  count: number;       // default 3
  deck?: string;       // default: first deck
  dryRun: boolean;     // print history + expected, write nothing
  list: boolean;       // print scenario catalogue
}
```

## 4. User Workflows

```
Manual tester (2 terminals):
  T1: pnpm --filter @gll/srs-demo dev:all      (app + server, holds .data/srs-demo.db)
  T2: pnpm seed relapsed-due --count 1
        → resolve DB path (GLL_DB_PATH → .data/srs-demo.db)
        → resolve deck + N words (SqliteContentStore)
        → buildScenario(): compose seed/schedule at now-21d … now-1d → endpoint card
        → clearUserState → upsert word states → insert cards (pure insert)
        → print wordIds + expected {dueNow, anytime, reviewUnlocked}
      → reload browser → GET /api/reviews re-fetches → state visible (no restart)

Dry run (inspect, no write):
  pnpm seed relapsed-due --dry-run → prints step-by-step FSRS history + expected; DB untouched

HTTP path (unchanged surface, shared builder, e2e/browser + config overrides):
  POST /api/test/seed/scenario { name, count } → buildScenario → applyFixture → { wordIds, expected }
```

## 5. Stories

### Phase 4: Seeding infrastructure (EP39-PH04)

### EP39-ST08: Extract shared scenario builder from route-private `applyFixture`

**Scope**: One module. Lift the scenario-construction + fixture-application logic out of the
route-private closure so both HTTP and CLI import it. No behavioural change to existing scenarios.
**Read List**: [apps/server/src/routes/test-seed.ts](../../../apps/server/src/routes/test-seed.ts) (`applyFixture`, `REVIEW_SCENARIOS`, `masteredWordState`, scenario switch), [packages/db/src/sqlite-review-store.ts](../../../packages/db/src/sqlite-review-store.ts), [packages/srs-review/src/types.ts](../../../packages/srs-review/src/types.ts)
**Tasks**:

- [ ] Introduce `buildScenario(spec, ctx)` (pure: takes stores/words/now, returns wordStates + cards + expected) and a thin `applyScenario` that clears state and writes, in a shared module (server-side, e.g. `apps/server/src/seed/`).
- [ ] Re-point `POST /api/test/seed/scenario` at the shared builder; existing presets (`mastered-fresh`, `mastered-due`, `review-only`) produce byte-identical results.
      **Acceptance Criteria**:
- [ ] Existing `/test/seed/scenario` responses (`wordIds`, `expected`) unchanged for all three presets.
- [ ] `applyFixture`'s raw-SQL escape hatches (stagnation insert, `review_cards` delete) preserved.
- [ ] No change to the 5 boundary `new Date()` sites.

### EP39-ST09: Multi-day snapshot presets via backdated FSRS composition

**Scope**: Extend the builder to compose `FsrsScheduler.seed` + N× `schedule` at increasing backdated
offsets, and register span-days presets (`relapsed-due`, `mature-interval`).
**Read List**: [packages/srs-review/src/FsrsScheduler.ts](../../../packages/srs-review/src/FsrsScheduler.ts) (`seed`, `schedule`, `RATING_TO_GRADE`), ST08 builder module
**Tasks**:

- [ ] Implement `ScenarioStep` composition: fold steps oldest→newest, each calling the scheduler with `new Date(now.getTime() + offsetMs)`.
- [ ] Guard: assert offsets are negative and strictly increasing; throw a typed error otherwise.
- [ ] Register `relapsed-due` (graduate → good → again(lapse) → good, ending due ~now) and `mature-interval` (several goods, long interval, not-due).
      **Acceptance Criteria**:
- [ ] `relapsed-due` produces a card with `state=Review`, `lapses≥1`, `due ≤ now`; `expected.dueNow` matches.
- [ ] `mature-interval` produces `due > now` and `expected.dueNow = 0`, `anytime = N`.
- [ ] Out-of-order steps raise the typed guard error (unit test).
- [ ] Card `scheduler_data` is engine-produced (no hand-set stability/difficulty).

### EP39-ST10: `pnpm seed` CLI over the shared builder

**Scope**: In-process CLI entry point; zero-config DB path; `--list`, `--dry-run`, `--count`, `--deck`.
**Read List**: [apps/server/src/index.ts](../../../apps/server/src/index.ts) (`GLL_DB_PATH` resolution, `getDb`, `seedContent`), [apps/server/package.json](../../../apps/server/package.json) (script wiring), ST08/ST09 builder
**Tasks**:

- [ ] Add a `seed` script that resolves the DB path **identically to the server** (`GLL_DB_PATH` → else `.data/srs-demo.db`), opens `getDb(path)`, resolves deck+words, runs `buildScenario`/`applyScenario`.
- [ ] `--list` prints the scenario catalogue; `--dry-run` prints the step history + `expected` and writes nothing; default `--count 3`.
- [ ] Print resolved `deckId`, `wordIds`, and `expected` on success.
      **Acceptance Criteria**:
- [ ] `pnpm seed mastered-due --count 3` against a running `dev:all` makes 3 cards visible on browser reload with **no server restart**.
- [ ] CLI default path matches the server's for identical env — verified by seeding then `GET /api/reviews` returning the seeded words.
- [ ] `--dry-run` leaves the DB byte-unchanged (row counts identical before/after).
- [ ] Unknown scenario name exits non-zero with the catalogue.

### EP39-ST11: README + docs — replace curl chains with `pnpm seed`

**Scope**: Docs only. Update the srs-demo README seeding section to lead with `pnpm seed`, keep the
HTTP path documented for config-override + e2e cases, and document the 2-terminal loop + 3 caveats.
**Read List**: [apps/srs-demo/README.md](../../../apps/srs-demo/README.md) (existing seeding section)
**Tasks**:

- [ ] Replace the multi-step curl walkthrough with `pnpm seed` examples (incl. span-days + `--dry-run`).
- [ ] Document: same-DB-path requirement, browser-reload-to-refresh, config-overrides-are-HTTP-only.
      **Acceptance Criteria**:
- [ ] README shows the 2-terminal loop as the primary manual-test path; HTTP retained as the secondary/config path.

## 6. Success Criteria

1. A manual tester reaches any EP39 review state — including a multi-day lapsed/mature card — with **one** `pnpm seed` command from a second terminal, no server restart, no hand-written JSON.
2. Multi-day cards carry **engine-computed** FSRS state (validated: `state`, `lapses`, `due` consistent with the replayed history), not hand-authored blobs.
3. HTTP `/api/test/seed/scenario` behaviour for the three existing presets is **unchanged**.
4. The 5 production `new Date()` boundary sites and all route/scheduler logic are **untouched**.
5. CLI DB-path default provably matches the server's for identical env.
6. No type errors.
