# EP39-DS03: FSRS Review Seeding — Snapshot Builder & Seed CLI Specification

**Date**: 20260710T090952Z
**Status**: Impl-Complete
**Epic**: [EP39 - Review Mode: Eager Practice & Feedback](../../plans/epics/EP39-review-mode-redesign.md)

**ADR**: [FSRS Review Seeding — Snapshot Builder over an Injectable Clock](../../../product-documentation/architecture/20260710T090706Z-engineering-fsrs-seeding-snapshot-builder.md)

---

## 1. Feature Overview

Testing/verification infrastructure for review mode. Reaching a given review state by hand requires
authored JSON fixtures and multi-step `curl` chains (see [apps/srs-demo/README.md](../../../apps/srs-demo/README.md)),
including hand-backdating `due`. This DS replaces that with a **shared scenario builder** that produces
every review state — including **multi-day FSRS histories** — as **snapshots**, plus a zero-config
`pnpm seed` **CLI** so a manual tester can drive state from a second terminal without booting anything
or writing JSON.

**HOW**, in one line: because `FsrsScheduler.seed/schedule` already take `now` as a parameter
([packages/srs-review/src/types.ts](../../../packages/srs-review/src/types.ts)), a multi-day card is
built by composing those calls with **chronologically-increasing backdated `Date`s**, then inserting
the engine-computed endpoint card. No injectable clock; the 5 boundary `new Date()` sites (reviews.ts
×3, answer.ts ×1, test-seed.ts ×1) are untouched; runtime seeding stays a pure insert.

This is **additive test infrastructure** — no production route logic, no schema, no scheduler change.
It unblocks the review BDD/e2e EP38 deferred (a due card was unreachable without backdating the DB).

## 2. Core Requirements

| Requirement | Decision | Rationale |
| --- | --- | --- |
| Stay on Drizzle | Keep `@gll/db` as-is | Seeding is domain-logic replay, not a query-builder feature (ADR Alternatives) |
| Multi-day states | Builder-computed **snapshots** via backdated timestamps | Snapshots are cleaner; fidelity is engine-grade because the card is scheduler-computed, not hand-authored |
| No injectable clock | 5 boundary `new Date()` sites untouched | Snapshots satisfy the need without touching production time paths (ADR §Decision.2) |
| Single source of truth | One shared builder; HTTP + CLI both call it | No divergence between wire-seeding (e2e/browser) and terminal-seeding |
| HTTP seed stays | Keep `POST /api/test/seed/scenario` | It owns in-memory config overrides (`shelvingConfigOverride`/`sentenceConfigOverride`) an out-of-process CLI cannot set |
| CLI owns DB state | New `pnpm seed <scenario>` | The 2-terminal manual loop |
| Zero-config DB path | CLI defaults to the server's resolution: `GLL_DB_PATH` → else `.data/srs-demo.db` (shared `defaultDbPath`) | Path drift = seeding a DB nobody reads (hard requirement, ADR §Decision.5) |
| Chronological steps | Builder asserts each step's offset is ≤ 0 and strictly increasing | Out-of-order steps make FSRS see negative elapsed time |
| Deterministic due placement | Optional `dueOverrideMs` places the final `due` deterministically while keeping the engine-computed internal state | "Already due" / "due now" scenarios need a stable `due` without depending on FSRS's natural interval landing exactly |
| Expected derived, not trusted | `expected` (`dueNow`/`anytime`/`reviewUnlocked`) is computed from the built cards, not read from the spec | It can never drift from what was actually built |

## 3. Data Structures

```typescript
// apps/server/src/seed/scenario-builder.ts

/** Word-state row shape seeded by a scenario (mirrors WordState fields). */
export interface WordStateInput { wordId: string; seen: number; correct: number;
  mastery: number; correctStreak: number; wrongStreak: number; lapses: number; }

/** Observable outcome a seeded scenario should produce — asserted by CLI/e2e. */
export interface ExpectedOutcome { dueNow: number; anytime: number; reviewUnlocked: boolean }

/** A single backdated review action. Steps compose oldest→newest into a real FSRS
 *  history: `offsetMs` must be ≤ 0 and strictly increasing across a spec's steps. */
export interface ScenarioStep {
  offsetMs: number;
  kind: 'graduate' | 'review';
  rating?: ReviewRating;                 // for 'review' steps (correctness→rating model)
  performance?: GraduationPerformance;   // for the 'graduate' step; defaults to a 'good' seed
}

/** A named, deterministic scenario. */
export interface ReviewScenarioSpec {
  name: string;
  description: string;
  seedWordState: boolean;   // also upsert a mastered WordState per word (false = review-only / BUG-repro)
  steps: ScenarioStep[];    // [] → no card; single graduate → fresh; multi → multi-day snapshot
  expected: ExpectedOutcome;
  dueOverrideMs?: number;   // deterministic final `due` (e.g. -1 day = already due); omit = FSRS-natural
}

export interface BuildContext { wordIds: string[]; deckId: string; now: Date; scheduler: FsrsScheduler }
export interface BuiltScenario { wordStates: WordStateInput[]; reviewCards: ReviewCard[]; expected: ExpectedOutcome }

/** Compose the scheduler over each word's step history (replay oldest→newest at now+offset)
 *  so the resulting card carries a real, engine-computed FSRS state. `expected` is derived
 *  from the built cards, never trusted from the spec. */
export function buildScenario(spec: ReviewScenarioSpec, ctx: BuildContext): BuiltScenario {
  assertChronological(spec);                 // offsets ≤ 0 and strictly increasing, else typed throw
  const wordStates = spec.seedWordState ? ctx.wordIds.map(masteredWordState) : [];
  const reviewCards: ReviewCard[] = [];
  for (const wordId of ctx.wordIds) {
    let card: ReviewCard | null = null;
    for (const step of spec.steps) {
      const stepNow = new Date(ctx.now.getTime() + step.offsetMs);
      card = step.kind === 'graduate'
        ? ctx.scheduler.seed(wordId, step.performance ?? DEFAULT_PERFORMANCE, stepNow)
        : ctx.scheduler.schedule(card!, step.rating ?? 'good', stepNow);
    }
    if (!card) continue;
    if (spec.dueOverrideMs !== undefined) card = { ...card, due: new Date(ctx.now.getTime() + spec.dueOverrideMs) };
    reviewCards.push(card);
  }
  const t = ctx.now.getTime();
  const expected: ExpectedOutcome = {
    dueNow: reviewCards.filter((c) => c.due.getTime() <= t).length,
    anytime: reviewCards.length,
    reviewUnlocked: reviewCards.length > 0,
  };
  return { wordStates, reviewCards, expected };
}
```

### Scenario catalogue (`REVIEW_SCENARIOS`)

| Name | Shape | Purpose |
| --- | --- | --- |
| `mastered-fresh` | graduate now; card at natural (future) due | mastered word, nothing due yet |
| `mastered-due` | graduate now; `dueOverrideMs: -1d` | mastered word, due now |
| `review-only` | graduate now, **no** WordState; `dueOverrideMs: -1d` | card due but not mastered (unlock-gate BUG repro) |
| `relapsed-due` | graduate −21d → good −18d → **again** −8d (lapse) → good −1d; `dueOverrideMs: -1d` | multi-day lapsed/relearned history, due now |
| `mature-interval` | graduate −40d → good ×3; natural future due | long stability, **not** due (anytime-only) |

### Apply + run + CLI (`apps/server/src/seed/`)

```typescript
// apply-scenario.ts — write a built scenario; shared by HTTP route and CLI.
export async function applyBuiltScenario(built: BuiltScenario, deps: { db; userId: string }) {
  const store = new SqliteLearningStore(deps.db); const reviewStore = new SqliteReviewStore(deps.db);
  await store.clearUserState(deps.userId);                                   // word states, shelving, stagnation
  deps.db.$client.prepare('DELETE FROM review_cards WHERE user_id = ?').run(deps.userId); // clearUserState doesn't own this table
  for (const ws of built.wordStates) await store.upsertWordState(deps.userId, { ...ws });
  for (const card of built.reviewCards) await reviewStore.upsertReviewCard(deps.userId, card);
}

// run-seed.ts — resolve a named scenario against a deck and (unless dry-run) write it.
export async function runSeed(args: { scenario; count?; deck?; dryRun? }, deps: { db; userId }) {
  const spec = REVIEW_SCENARIOS[args.scenario];
  if (!spec) throw new Error(`unknown scenario "${args.scenario}" — one of: ${Object.keys(REVIEW_SCENARIOS).join(', ')}`);
  const content = new SqliteContentStore(deps.db);
  const deck = args.deck ? await content.getDeck(args.deck) : (await content.getDecks())[0];
  const wordIds = deck.words.slice(0, Math.max(1, args.count ?? 3)).map((w) => w.id);
  const built = buildScenario(spec, { wordIds, deckId: deck.id, now: new Date(), scheduler });
  if (!args.dryRun) await applyBuiltScenario(built, deps);
  return { scenario: spec.name, deckId: deck.id, wordIds, expected: built.expected, wrote: !args.dryRun };
}

// cli.ts — pnpm seed <scenario> [--count N] [--deck id] [--dry-run] [--list]
//   DB path resolved IDENTICALLY to the server: defaultDbPath(process.env) (GLL_DB_PATH → .data/srs-demo.db)
```

## 4. User Workflows

```
Manual tester (2 terminals):
  T1: pnpm --filter @gll/srs-demo dev:all      (app + server, holds .data/srs-demo.db)
  T2: pnpm seed relapsed-due --count 1
        → resolve DB path (GLL_DB_PATH → .data/srs-demo.db)  [same as server]
        → resolve deck + N words (SqliteContentStore)
        → buildScenario(): compose seed/schedule at now-21d … now-1d → endpoint card
        → clearUserState → upsert word states → insert cards (pure insert)
        → print wordIds + expected {dueNow, anytime, reviewUnlocked}
      → reload browser → GET /api/reviews re-fetches → state visible (no restart)

Dry run:  pnpm seed relapsed-due --dry-run   → prints step history + expected; DB untouched
List:     pnpm seed --list                   → prints the scenario catalogue
HTTP:     POST /api/test/seed/scenario { name, count } → buildScenario → applyBuiltScenario  (e2e/browser + config overrides)
```

## 5. Stories

### EP39-ST08: Extract shared scenario builder from route-private `applyFixture`

**Scope**: Lift scenario construction + fixture application out of the route-private closure into a shared module (`apps/server/src/seed/`) so HTTP and CLI both import it. No behavioural change to existing scenarios.
**Acceptance Criteria**:
- [x] Existing `/test/seed/scenario` responses (`wordIds`, `expected`) unchanged for the base presets
- [x] `applyBuiltScenario` preserves the raw-SQL escape hatch (`review_cards` delete) alongside `clearUserState`
- [x] No change to the 5 boundary `new Date()` sites

### EP39-ST09: Multi-day snapshot presets via backdated FSRS composition

**Scope**: Compose `FsrsScheduler.seed` + N× `schedule` at increasing backdated offsets; register span-days presets (`relapsed-due`, `mature-interval`); guard out-of-order steps.
**Acceptance Criteria**:
- [x] `relapsed-due` produces a card with `state=Review`, `lapses≥1`, placed due now; `expected.dueNow` matches
- [x] `mature-interval` produces a natural future `due` (`dueNow=0`, `anytime=N`)
- [x] Out-of-order / positive offsets raise the typed guard error (unit test)
- [x] Card `scheduler_data` is engine-produced (no hand-set stability/difficulty)

### EP39-ST10: `pnpm seed` CLI over the shared builder

**Scope**: In-process CLI; DB path resolved identically to the server via `defaultDbPath`; `--list`, `--dry-run`, `--count`, `--deck`.
**Acceptance Criteria**:
- [x] `pnpm seed mastered-due --count 3` against a running `dev:all` makes 3 cards visible on browser reload with **no server restart**
- [x] CLI default path matches the server's for identical env — verified by seeding then `GET /api/reviews` returning the seeded words
- [x] `--dry-run` leaves the DB byte-unchanged; `--list` prints the catalogue
- [x] Unknown scenario name exits non-zero with the catalogue

### EP39-ST11: README + docs — replace curl chains with `pnpm seed`

**Scope**: Docs only. Lead the srs-demo README seeding section with `pnpm seed`; keep HTTP documented for config-override + e2e; document the 2-terminal loop + caveats.
**Acceptance Criteria**:
- [x] README shows the 2-terminal loop as the primary manual-test path; HTTP retained as the secondary/config path

## 6. Success Criteria

1. A manual tester reaches any review state — including a multi-day lapsed/mature card — with **one** `pnpm seed` command from a second terminal, no server restart, no hand-written JSON.
2. Multi-day cards carry **engine-computed** FSRS state (validated: `state`, `lapses`, `due` consistent with the replayed history), not hand-authored blobs.
3. HTTP `/api/test/seed/scenario` behaviour for the base presets is **unchanged** (one shared builder).
4. The 5 production `new Date()` boundary sites and all route/scheduler logic are **untouched**.
5. CLI DB-path default provably matches the server's for identical env.
6. No type errors.

## 7. Implementation Notes

Built as specified under [`apps/server/src/seed/`](../../../apps/server/src/seed/):
`scenario-builder.ts` (the pure `buildScenario` + `REVIEW_SCENARIOS` catalogue + chronological guard),
`apply-scenario.ts` (`applyBuiltScenario`), `run-seed.ts` (`runSeed`), `cli.ts` (`pnpm seed`). The DB
path is resolved via the shared `defaultDbPath(process.env)` so CLI and server agree. HTTP
`POST /api/test/seed/scenario` re-points at the shared builder. Covered by
`apps/server/src/seed/__tests__/scenario-builder.test.ts` (composition, guard, engine-computed state)
and `run-seed.test.ts`, plus `test-seed.test.ts` for the HTTP parity. This resolves the EP38 e2e
blocker (a due / multi-day card is now reachable without touching the DB file).
