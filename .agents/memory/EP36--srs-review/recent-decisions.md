# Recent Decisions — EP36 SRS Review Phase

> Keep the last 3 entries; archive older ones per `.agents/memory/README.md`.

---

## Spin PH04 (`srs-demo` Review mode) out to a new epic — 20260708T014500Z

**Context**: DS03 §2 framed Track B as *server-authority* (server owns `FsrsScheduler` + store +
rating inference; frontend never imports `ts-fsrs`). Investigation before starting Track B found
this conflicts with the app's actual architecture.

**Finding (verified in code)**: the app is **client-authority for Learning**:
- `srs-demo` imports `@gll/srs-engine-v2` and runs the engine in the browser (`App.vue`,
  `DeckOverview.vue`: `nextQuestion`, advance `WordState`, batch composition).
- The Hono server (`apps/server/src/routes/state.ts`) is **persistence-only**: `POST
  /api/state/word` saves a client-computed `WordState`; the server never runs the engine or
  computes mastery.
- Therefore DS03-ST11's "seed a ReviewCard on the server's learning-answer path when a word
  crosses the mastery threshold" has **no hook** — graduation happens client-side.

**Decision**: Close EP36 at PH01–PH03 (a complete, shippable CLI vertical). Move PH04 (ST10–ST12)
to a **new epic** whose first deliverable is an ADR.

**The fork the ADR must resolve**:
- (A) Review = server-authority (new `/api/review/*` owns FSRS + inference). Clean `ts-fsrs`
  isolation; but asymmetric with Learning and the server must learn the mastery-threshold rule.
- (B) Review = client-authority, mirroring Learning (`srs-demo` runs `FsrsScheduler`, thin persist
  endpoint). Symmetric; but violates "frontend never imports `ts-fsrs`" and ships FSRS in the bundle.

**Impact**: package boundaries, server responsibilities, browser bundle. User has additional
concerns to raise in that discussion (not yet captured — ask, don't assume). Related ADR:
`product-documentation/architecture/20260708T005635Z-engineering-srs-review-phase-packaging.md`.

---

## Extract testable helpers from runner scripts — 20260708T013000Z

**Context**: DS03 specified inlining seed/loop logic in the `import.meta.url` runner scripts, which
are not unit-testable.

**Decision**: Extract `seedGraduatedReviewCards`, `runReviewSession`, `loadDueCards` as pure/injectable
functions; the top-level scripts are thin wrappers. Gives real behavioral tests with live scheduler
+ store. Also: mock seeder uses **real curriculum word ids** (not fabricated `word:mock-*`), else the
runner's `questionFor` silently skips them.
