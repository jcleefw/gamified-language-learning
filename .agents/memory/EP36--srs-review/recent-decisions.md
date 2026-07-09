# Recent Decisions — EP36 SRS Review Phase

> Keep the last 3 entries; archive older ones per `.agents/memory/README.md`.

---

## Spin PH04 (`srs-demo` Review mode) out to a new epic (EP37) — 20260708T014500Z

**Context**: DS03 §2 framed Track B as *server-authority* (server owns `FsrsScheduler` + store +
rating inference; frontend never imports `ts-fsrs`). Investigation before starting Track B found this
conflicts with the app's actual (emergent) **client-authority** for Learning: `srs-demo` runs the
engine in the browser; the Hono server (`routes/state.ts`) is a thin persistence bridge. So DS03-ST11's
"seed a ReviewCard on the server's learning-answer path" has no hook — graduation happens client-side.

**Decision**: Close EP36 at PH01–PH03 (a complete, shippable CLI vertical). Move PH04 (ST10–ST12) to a
new epic — **`EP37--srs-review-in-srs-demo`** — whose first deliverable is an ADR (authority +
integrity). Full finding, the authority archaeology, and the ADR checklist now live in **EP37's
branch memory** (`.agents/memory/EP37--srs-review-in-srs-demo/`).

---

## Extract testable helpers from runner scripts — 20260708T013000Z

**Context**: DS03 specified inlining seed/loop logic in the `import.meta.url` runner scripts, which
are not unit-testable.

**Decision**: Extract `seedGraduatedReviewCards`, `runReviewSession`, `loadDueCards` as pure/injectable
functions; the top-level scripts are thin wrappers. Gives real behavioral tests with live scheduler
+ store. Also: mock seeder uses **real curriculum word ids** (not fabricated `word:mock-*`), else the
runner's `questionFor` silently skips them.
