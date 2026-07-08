# EP36-PH03: Review Runner, Rating Inference & Graduation Seeding — Implementation

**Date**: 20260708T014500Z
**Status**: Implemented
**Epic**: [EP36 - SRS Review Phase](../../plans/epics/EP36-srs-review-phase.md)
**Spec**: [EP36-DS03](20260708T013123Z-EP36-DS03-review-runner-and-rating.md) (Track A only)
**Commit**: `6dd6e04` on `EP36--srs-review`

---

## Summary

Delivered **Track A** of DS03 (EP36-PH03, stories ST06–ST09): the application-layer CLI Review
loop that wires the DS01 scheduler (`FsrsScheduler`) and the DS02 store (`SqliteReviewStore`) into
a working graduate → seed → due → review → reschedule → persist cycle in `apps/cli-demo-db`.

**Track B (PH04, ST10–ST12) was NOT implemented** and is being spun out to a new epic — see
"Scope change" below.

## What shipped (ST06–ST09)

| Story | Delivery |
| --- | --- |
| ST06 | `toGraduationPerformance` (`WordState → GraduationPerformance`) + `seedGraduatedReviewCards` (seed & persist on graduation); learning runner `onGraduation` now seeds review cards via `FsrsScheduler` + `SqliteReviewStore` using the existing `GraduationHook` `runState` arg (no engine change needed). |
| ST07 | `review-runner-db.ts` (`engine:review`): testable `runReviewSession` core (write-on-answer, skip-no-question, zero-due clean exit), `loadDueCards` deck/pool dispatcher, `Auto`/`Interactive` answer providers, thin top-level script (`REVIEW_MODE=deck\|pool`). |
| ST08 | `review-rating.ts`: `inferReviewRating` + `DEFAULT_RATING_THRESHOLDS` (generous, configurable: ≤4s easy, ≤12s good, else hard; wrong → again). User is never prompted (ADR D5). |
| ST09 | `seed-mock-reviews.ts` (`engine:review:seed`): seeds real curriculum word ids as due-now cards to exercise the runner in isolation. |

**Tests**: 14 new (cli-demo-db suite 45 → 59, all green). Typecheck clean. End-to-end loop
verified against real word rows (seed → `composeWordBatch` → auto-review → all rescheduled ~2 days
out → 0 still due).

## Deviations from DS03 (flagged, not silent)

1. **Extracted testable helpers** (`seedGraduatedReviewCards`, `runReviewSession`, `loadDueCards`)
   instead of inlining logic in the top-level scripts — the runners are `import.meta.url` scripts
   that can't be unit-tested directly. The scripts are now thin wrappers.
2. **Mock seeder uses real curriculum word ids** (`buildQuizItems(db).slice(0, 3)`), not fabricated
   `word:mock-*` ids. Caught during verification: fake ids have no vocab entry, so the runner's
   `questionFor` would silently skip them and the ST09 acceptance criterion would fail.

## Build note

`@gll/db` and `@gll/srs-review` are consumed as built `dist/`; the DS02 dist was stale (missing
`SqliteReviewStore`). Rebuilt both. **Any future consumer (incl. the EP37 server work) must rebuild
these after DS01/DS02 source changes.**

## Scope change — PH04 spun out to a new epic

DS03 §2 framed Track B as **server-authority** (server owns scheduler + store + rating inference;
frontend never sees FSRS). Investigation before starting Track B revealed this **conflicts with the
app's actual architecture**: `srs-demo` is **client-authority** — it imports `@gll/srs-engine-v2`
and runs the engine in the browser (`App.vue`, `DeckOverview.vue`); the Hono server
(`routes/state.ts`) is **persistence-only** (`POST /api/state/word` just saves a client-computed
`WordState`; the server never runs the engine or computes mastery). DS03-ST11's "seed a ReviewCard
on the server's learning-answer path when a word crosses the mastery threshold" therefore has **no
hook to attach to** — graduation happens client-side.

This is an ADR-level decision (server-authority Review vs. client-authority parity with Learning;
plus whether `ts-fsrs` may enter the browser bundle), not an implementation detail. Track A is a
complete, shippable vertical, so EP36 closes at PH01–PH03 and **PH04 (ST10–ST12) moves to a new
epic** whose first step is that ADR. See the epic plan's "Phase 4 → new epic" note.
