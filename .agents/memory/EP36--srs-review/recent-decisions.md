# Recent Decisions — EP36 SRS Review Phase

> Keep the last 3 entries; archive older ones per `.agents/memory/README.md`.

---

## FINDING: `srs-demo` Learning authority was never decided — it's emergent — 20260708T020000Z

Doc archaeology (prompted by the user asking whether "Learning is client-authority" is a decision
or an assumption). **It is an assumption / emergent outcome, not a recorded decision — and it
contradicts the last written authority decision.**

Paper trail:
- **Headless Hono ADR (2026-03-03)**: server "calls the extracted engines and maps output to JSON" → server-authority intent.
- **Quiz Contract & Answer Authority ADR (2026-03-13, EP15, Impl-Complete)**: explicit decision — "the server owns the quiz from question generation through answer verification" (client sends `selectedKey`, server runs `processAnswers`). **server-authority, shipped.**
- **srs-engine-v2 Learning ADR (2026-03-19)**: new *pure library*; "persistence is the calling layer's concern," "RunState ephemeral — persistence deferred," "Hono server remains untouched until engine is solid." → **deferred** the authority question; did NOT decide client-authority.
- **EP24 (2026-05-11)**: Vue demo to make the engine "observable in a browser"; backend explicitly OUT OF SCOPE; engine ran client-side with localStorage — a demo choice, not an authority decision.
- **EP32**: v1 cleanup deleted the old `/api/srs/*` server-authority endpoints.
- **EP31 (2026-06-23, Impl-Complete)**: replaced localStorage by "retrofitting `apps/server` as an HTTP bridge" *because `better-sqlite3` can't run in a Vite browser bundle*. Server became a **thin persistence bridge**; engine stayed client-side.

**So**: today's `srs-demo` Learning = client-authority is a *consequence of a persistence constraint*
(better-sqlite3 not browser-safe), never a ratified architecture. EP15's server-authority ADR is
still Impl-Complete on paper, silently superseded. The v2 ADR's "calling layer's concern" line
**sanctions** cli-demo-db and srs-demo behaving differently — they are different consumers, not
replicas (user's point).

**Consequence for the new epic's ADR**: it must FIRST ratify what Learning's authority is for
`srs-demo` (currently undocumented + contradicting EP15), THEN decide Review authority on that
baseline. The real gap is not "Learning client vs Review server" — it's that Learning's authority
has no standing decision to be consistent with. See [[blocked-items]].

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
