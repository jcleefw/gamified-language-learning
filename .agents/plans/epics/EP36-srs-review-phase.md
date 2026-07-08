# EP36 - SRS Review Phase (`@gll/srs-review`)

**Created**: 20260708T010629Z
**Status**: Impl-Complete (PH01–PH03) — **PH04 spun out to a new epic** (see "Phase 4 → new epic" below)

<!-- Status: Draft | Accepted | In Progress | Impl-Complete | BDD Pending | Completed | Shelved | Withdrawn -->

**Type**: Epic Plan
**Depends on**: EP20 (Learning phase), EP34 (async storage contract), EP30 (`@gll/db` persistence layer)
**Parallel with**: N/A
**Predecessor**: EP21 (re-scoped) — EP21's Draft assumed an in-engine build that now conflicts with the DS02 library boundary, EP34's async store, and the `srs-shelving` sibling-package precedent. EP36 supersedes it. **EP21 should be marked Withdrawn** once EP36 is accepted.

**Architecture**: [SRS Review Phase — Packaging, Layer Boundaries & Rating Policy](../../../product-documentation/architecture/20260708T005635Z-engineering-srs-review-phase-packaging.md) (this epic implements that ADR). FSRS *behaviour* remains governed by the [20260321 Review Phase ADR](../../../product-documentation/architecture/20260321T145300Z-engineering-srs-engine-v2-review-phase.md).

---

## Problem Statement

EP20 built and verified the **Learning** phase of `srs-engine-v2`. When a word graduates
(`mastery >= threshold`) it currently disappears — there is no **Review** phase, so learned words
are never revisited and long-term retention is never cemented.

EP36 builds the Review phase: a day-scale scheduling loop, powered by FSRS (`ts-fsrs`) behind a
swappable `ReviewScheduler` interface, that brings graduated words back at optimal intervals.
Ratings are **inferred from quiz performance** (generous response-time bands) — the user is never
asked to self-rate.

Per the packaging ADR, the phase is split across three layers rather than built inside the engine:
a pure **scheduler** package, a **store** in `@gll/db`, and an app-layer **runner** that wires them
together and owns rating inference.

---

## Scope

**In scope**:

- New `@gll/srs-review` package — `ReviewScheduler` interface, `FsrsScheduler`, review domain types
  (`ReviewCard`, `ReviewRating`, `GraduationPerformance`); `ts-fsrs` moves here and is removed from
  `srs-engine-v2`.
- `ReviewStore` interface + `SqliteReviewStore` in `@gll/db` (async per EP34, drizzle
  `review_cards` table, opaque `scheduler_data` column).
- App-layer review runner (`pnpm reviewv2`) — deck-scoped and pool-global modes, write-on-answer.
- Graduation → seed handoff via the existing `GraduationHook` seam in the engine.
- Response-time → rating inference in the runner: wrong → `Again`; correct → `Easy`/`Good`/`Hard`
  with **generous, per-question-type** thresholds (defaults ≤4s `Easy`, 4–12s `Good`, >12s `Hard`).
- Mock-seeder script to generate due cards for testing the runner in isolation.
- **Server-authority review path for `@gll/srs-demo`**: review DTOs in `@gll/api-contract`, a
  Hono review route in `@gll/server` (due cards → questions, answer → reschedule, graduation
  seeding), and a Review mode in the `srs-demo` Vue frontend.

**Out of scope** (deferred — see Open Questions):

- Explicit "mark as hard" manual override (additive later; touches only runner inference)
- Review → Learning re-entry on lapse threshold (OQ1)
- Per-word-type mastery thresholds (OQ3)
- Shelving semantics for already-graduated words (OQ4/OQ7)
- Practice-mode / due-date bypass for eager learners (OQ8)
- Cloudflare **D1** remote persistence (schema is D1-compatible; the Hono review route ships in this epic)
- Question-type distribution / percentages (MC + word-block only, as today)
- `reviewCard` field on `WordState` — explicitly dropped by the packaging ADR (D4)

---

## Stories

### Phase 1: Review Scheduler Package (EP36-PH01) — `@gll/srs-review`

### EP36-ST01: Scaffold `@gll/srs-review` and relocate `ts-fsrs`

**Scope**: Create `packages/srs-review` (mirroring `@gll/srs-shelving`); add `ts-fsrs` dependency here and remove it from `srs-engine-v2`'s `package.json`.

### EP36-ST02: Review domain types + `ReviewScheduler` interface

**Scope**: Define `ReviewCard`, `ReviewRating`, `GraduationPerformance`, and the `ReviewScheduler` interface (`seed`/`schedule`/`isDue`) — pure types, no `ts-fsrs` import; export from the package barrel.

### EP36-ST03: `FsrsScheduler` implementation

**Scope**: Implement `FsrsScheduler` (the only place `ts-fsrs` is imported) with `enable_short_term: false`, mapping `GraduationPerformance` → initial card on `seed` and `ReviewRating` → updated card on `schedule`; unit tests for interval growth, lapse handling, and `isDue`.

### Phase 2: Review Persistence (EP36-PH02) — `@gll/db`

### EP36-ST04: Verify `review_cards` schema + wire `@gll/srs-review` dep

**Scope**: The `review_cards` table (PK `(user_id, word_id)`, `due` TEXT, `scheduler_data` TEXT) **already exists** in `schema.ts` + migration `0001_initial_schema.sql` — verify it matches and add `@gll/srs-review` as a `@gll/db` dependency. No new table/migration. (See DS02.)

### EP36-ST05: `ReviewStore` interface + `SqliteReviewStore`

**Scope**: Implement the async `ReviewStore` (`upsert`, `getByWordId`, `getDue`, `getDueForDeck`, `getAll`) and its `SqliteReviewStore` backing, following the `LearningStore` pattern; unit tests including write-on-answer round-trip.

### Phase 3: Review Runner & Integration (EP36-PH03) — app / demo

### EP36-ST06: Graduation seeding hook

**Scope**: Wire the engine's `GraduationHook` seam so that at Learning-run completion each graduated word's `GraduationPerformance` is computed from final `WordState`, seeded via `scheduler.seed`, and persisted through `ReviewStore.upsert`.

### EP36-ST07: Review runner — deck-scoped & pool-global modes

**Scope**: Implement the CLI review runner `review-runner-db.ts` (`engine:review`, in `apps/cli-demo-db`) with mode selection; load due cards via `getDueReviewCardsForDeck` / `getDueReviewCards`, quiz loop, immediate write-on-answer persistence, safe early exit.

### EP36-ST08: Response-time → rating inference (generous, per-type)

**Scope**: Runner-layer rating inference — set `shownAt` on display, map wrong → `Again` and correct → `Easy`/`Good`/`Hard` via generous, per-question-type configurable thresholds; feed the rating to `scheduler.schedule`.

### EP36-ST09: Mock-seeder script

**Scope**: `seed-mock-reviews` script that seeds fixed `wordId`s as due-now `ReviewCard`s in the review DB, so the runner can be exercised without a full Learning run.

### Phase 4 → new epic (was EP36-PH04) — Review in the interactive `srs-demo`

> **Moved out of EP36.** ST10–ST12 below are **not** implemented here. Investigation before
> starting Track B found that DS03's "server-authority" premise conflicts with the app's actual
> architecture: `srs-demo` is **client-authority** (imports `@gll/srs-engine-v2`, runs the engine
> in the browser via `App.vue`/`DeckOverview.vue`), and the Hono server (`routes/state.ts`) is
> **persistence-only** (`POST /api/state/word` saves a client-computed `WordState`; the server
> never runs the engine or computes mastery). So ST11's "seed a ReviewCard on the server's
> learning-answer path" has no hook — graduation happens client-side.
>
> This is an **ADR-level decision** (server-authority Review vs. client-authority parity with
> Learning; whether `ts-fsrs` may enter the browser bundle), not an implementation detail. The new
> epic's **first step is that ADR**; ST10–ST12 are re-scoped under its outcome. Stories retained
> below for reference/hand-off.

### EP36-ST10: Review DTOs in `@gll/api-contract`

**Scope**: Add review contract types to `src/srs.ts` — `ReviewCardPayload`, `GetDueReviewsResponse` (due word questions), `SubmitReviewAnswerRequest` (`wordId`, `correct`, `latencyMs`), `SubmitReviewAnswerResponse` (next `due`). Wrapped in the existing `ApiResponse<T>`.

### EP36-ST11: Server review route + graduation seeding

**Scope**: `apps/server/src/routes/review.ts` — `GET /api/review/due` (pool + `?deckId=`) building word-MC questions for due cards, `POST /api/review/answer` (server infers rating from `correct`+`latencyMs`, `scheduler.schedule`, `upsertReviewCard`). Seed a `ReviewCard` server-side when a word graduates on the learning-answer path. Mount under `/api`.

### EP36-ST12: `srs-demo` Review mode (Vue frontend)

**Scope**: Frontend Review session — a `useReview` composable (fetch due, submit answer with client-measured `latencyMs`) and a Review view/entry point reusing `QuizCard`. Server is the authority; the frontend never sees FSRS.

---

## Overall Acceptance Criteria

- [x] `@gll/srs-review` exists as a pure package; `ts-fsrs` is imported **only** in its scheduler file and **no longer** appears in `srs-engine-v2`.
- [x] A word that graduates from Learning has a `ReviewCard` seeded and persisted via `ReviewStore`. *(CLI, ST06)*
- [x] The CLI runner (`engine:review`) presents only words with `due <= now` for the chosen deck or global pool. *(ST07)*
- [ ] ~~`srs-demo` has a working Review mode…~~ **Moved to new epic** (PH04) — depends on the authority ADR; premise re-examined (see "Phase 4 → new epic").
- [x] Each answered card is persisted immediately — early exit / crash never loses answered progress. *(ST07, write-on-answer)*
- [x] The user is **never** shown a self-rating prompt; ratings are inferred (wrong → `Again`, correct → `Easy`/`Good`/`Hard` by response time). *(ST08)*
- [x] Rating thresholds are generous and configurable — an ordinary correct answer maps to `Good`, not `Hard`. *(ST08; per-question-type normalisation still deferred — review is word-MC only today)*
- [x] A graduated word **never** re-enters the Learning active pool: a lapse in Review maps to `Again` → FSRS Relearning (stays in Review), not a return to Learning. *(FsrsScheduler; Review → Learning re-entry is OQ1 — deferred)*
- [x] Swapping FSRS for another `ReviewScheduler` requires changing one line in the runner; store and schema are untouched.
- [x] `review_cards` uses standard, D1-compatible SQL; `scheduler_data` is never inspected outside the scheduler.
- [x] All existing EP20 Learning tests pass unchanged. *(cli-demo-db 59/59 green)*
- [x] Edge/limit case: a review session with **zero** due words exits cleanly with a clear message. *(ST07)*

---

## Open Questions

Carried forward from EP21 (not in EP36 scope, except OQ6 which the existing schema resolves):

| # | Question |
|---|---|
| OQ1 | Review → Learning re-entry: after N `Again` ratings, does a word fall back to Learning? What is N, and what resets? |
| OQ3 | Per-word-type mastery thresholds (foundational vs curated) — EP36 or later? |
| OQ4/OQ7 | Shelving semantics for an already-graduated word — separate mechanic, or N/A in Review? |
| OQ5 | `GraduationPerformance` → initial FSRS rating breakpoints — needs empirical calibration. |
| ~~OQ6~~ | **Resolved**: the existing `review_cards` schema keys on `(user_id, word_id)` → one card per word **per user, global across decks**. Deck-scoped review is a JOIN filter, not a separate card. |
| OQ8 | Eager-learner / practice mode: allow on-demand review bypassing the due check without corrupting FSRS stability? |
| — | Response-time band values (and per-question-type normalisation) — calibrate against real timing data. |

---

## Dependencies

- EP20 complete (Learning phase, `WordState`, `GraduationHook`, `lapses`)
- EP34 (async storage contract) — `ReviewStore` follows the Promise-based store shape
- EP30 (`@gll/db`) — persistence layer host for `ReviewStore`
- `ts-fsrs` (relocated into `@gll/srs-review`)

## Next Steps

1. ~~Review and approve this plan~~ ✅
2. ~~Mark EP21 as **Withdrawn**~~ ✅
3. ~~Create Design Spec(s)~~ ✅ (DS01 scheduler / DS02 store / DS03 runner)
4. ~~Begin EP36-ST01~~ ✅ — **PH01–PH03 (ST01–ST09) complete** (commits through `6dd6e04`)
5. **New epic for PH04** (`srs-demo` Review mode): first deliverable an ADR resolving
   server-authority vs. client-authority parity with Learning (see "Phase 4 → new epic").
   Concern flagged for a deeper design discussion before implementation begins.
