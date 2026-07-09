# ADR: SRS Review Phase — Packaging, Layer Boundaries & Rating Policy (`@gll/srs-review`)

**Date**: 20260708T005635Z
**Status**: Accepted

<!-- Status: Accepted | Superseded | Deprecated -->

**Superseded by**: N/A
**Amended by**: [Review-Ahead & Due-Gated Advance](20260709T143643Z-engineering-review-ahead-and-due-gated-advance.md) (20260710, Accepted) — **resolves OQ8** ("practice-mode / due-date bypass", previously out of scope) by permitting review-ahead with a server-side due-gate on schedule advance.
**Supersedes (in part)**: [20260321T145300Z Review Phase ADR](20260321T145300Z-engineering-srs-engine-v2-review-phase.md) — packaging/layout and the `reviewCard`-on-`WordState` decision only; its FSRS *behavioural* design still stands
**Revises**: [EP21-DS02 Library Boundary](../../.agents/changelogs/EP21--srs-engine-v2-revision-build/20260510T162559Z-EP21-DS02-srs-engine-v2-library-boundary.md) — the provisional "`ts-fsrs` stays in `srs-engine-v2`" decision
**Epic**: EP21 (SRS Engine v2: Revision Phase)
**RFC**: N/A

---

## Context

EP20 built the Learning phase. When a word graduates (`mastery >= threshold`) it currently
falls out of the loop with nowhere to go. The **Review phase** — day-scale FSRS scheduling that
brings graduated words back at optimal intervals — is the missing half.

The *behavioural* design of the Review phase (FSRS with `enable_short_term: false`, the
`ReviewScheduler` abstraction, opaque `schedulerData`, write-on-answer persistence) is already
settled in the [20260321 Review Phase ADR](20260321T145300Z-engineering-srs-engine-v2-review-phase.md)
and is **not** re-opened here.

What this ADR decides is **where the code lives** and **how the FSRS rating is produced** —
because both were drawn before the current architecture existed, and both now conflict with it.

### The packaging problem: three contradictions with later decisions

The 20260321 ADR (and the EP21 epic) assumed the **entire** Review phase — scheduler +
`SqliteReviewStore` + `main-review.ts` runner + mock-seeder + `better-sqlite3` — would be built
**in-place inside `srs-engine-v2`**. Three subsequent decisions invalidate that:

| # | 20260321 ADR / EP21 epic said | Later decision says | Conflict |
|---|---|---|---|
| 1 | Add `better-sqlite3` to `srs-engine-v2`; build `SqliteReviewStore` there (§9, EP21-ST01) | **DS02**: *remove* `better-sqlite3` — "persistence belongs in the server, not the engine" | Old ADR re-adds the exact dep DS02 deleted |
| 2 | `ReviewStore` + `review_cards` + seeder live under `srs-engine-v2/src/persistence` & `/scripts` | **EP30/EP34**: `packages/db` is the persistence layer (`LearningStore`/`SqliteLearningStore`), and the store contract is **async** (Promise-based) | Persistence would live in two places; old ADR's store is also the wrong (sync) shape |
| 3 | Add `reviewCard?: ReviewCard` onto `WordState` (§8) | **DS02 / library-boundary memory**: engine holds pure Learning-phase logic, no persistence-shaped types | `ReviewCard` is a persisted, scheduler-owned record; hanging it off `WordState` re-couples the engine to persistence |

Additionally, **EP26 (`@gll/srs-shelving`)** established — *after* DS02 — the pattern that pure
domain logic adjacent to the engine (policy functions importing engine types, no I/O) lives in
its **own sibling package**. That precedent did not exist when DS02 provisionally kept `ts-fsrs`
in the engine.

**Already implemented** (do not re-scope): `WordState.lapses` and the `GraduationHook` type are
present in `srs-engine-v2` today. The hook is exported but **not yet wired** into the adaptive
session loop — that wiring is the seam where Review seeding attaches.

---

## Decision

The Review phase is **not one package**. It is a *scheduler* (pure logic), a *store* (I/O), and
a *runner* (orchestration + rating inference) — three concerns mapping onto three existing
layers. Split it accordingly.

### D1. Scheduler → new `@gll/srs-review` package (pure, no I/O)

Create `packages/srs-review`, mirroring `@gll/srs-shelving`:

- **Owns**: the `ReviewScheduler` interface, `FsrsScheduler` implementation, and the review
  domain types `ReviewCard`, `ReviewRating`, `GraduationPerformance`.
- **`ts-fsrs` moves here** and is imported **only** inside `src/fsrs-scheduler.ts`. It is
  **removed** from `srs-engine-v2`'s `package.json`.
- **Depends on** `@gll/srs-engine-v2` for `WordState` (to derive `GraduationPerformance`) — the
  same one-way dependency `srs-shelving` already has.
- **Pure**: no persistence, no `console`, no `process.*`. Unit-testable in isolation like
  `evaluateShelving`.

This **revises EP21-DS02**, which provisionally kept `ts-fsrs` in the engine "behind the
`ReviewScheduler` interface." That call predates the `srs-shelving` precedent; with that pattern
now established, the scheduler belongs in its own package and the core engine stays
dependency-light and Learning-only.

### D2. Persistence → `@gll/db` (extends the existing store layer)

- Add `ReviewStore` interface + `SqliteReviewStore` implementation to `packages/db`, alongside
  `LearningStore` / `SqliteLearningStore`.
- **Async contract** per EP34 — `Promise`-returning methods (`upsert`, `getByWordId`, `getDue`,
  `getDueForDeck`, `getAll`), **not** the synchronous `better-sqlite3` calls the 20260321 ADR
  sketched.
- Table `review_cards (word_id PK, due TEXT, scheduler_data TEXT)`, drizzle schema, ISO-8601
  dates. `scheduler_data` is an **opaque JSON column** the store never inspects. D1-compatible SQL.
- `better-sqlite3` lives here (it already does) — not in the engine, not in `srs-review`.

### D3. Runner, seeding & rating inference → application layer (demo + future server)

- `main-review.ts` (`pnpm reviewv2`), the two review modes (deck-scoped / pool-global), the
  mock-seeder script, and the rating-inference config are **app orchestration**, not library code.
- The graduation → seed handoff is an app-supplied `GraduationHook` that computes
  `GraduationPerformance` from the final `WordState`, calls `srs-review`'s `scheduler.seed(...)`,
  and persists via `db`'s `ReviewStore.upsert(...)`.

### D4. `WordState` does **not** gain a `reviewCard` field

Item #8 of the 20260321 ADR is **dropped**. `WordState` is the ephemeral Learning-phase counter;
whether a word has graduated is a `ReviewStore` query keyed by `wordId`, not a field on the
Learning state. `WordState.lapses` (already present) is retained as an FSRS seeding input.

### D5. FSRS rating is **inferred from performance, never asked** (behavioural constraint)

The user is **never** shown a self-rating prompt. `ReviewRating` (`again/hard/good/easy`) remains
the scheduler's input type — it is FSRS's native currency — but the **runner produces it**:

- **Wrong answer → `Again`** (automatic, unambiguous).
- **Correct answer → `Easy` / `Good` / `Hard`, inferred from response time.** A `shownAt`
  timestamp is set when the question is displayed; the delta to answer time selects the band.
  Thresholds are **configurable constants in the runner** (app layer), calibrated empirically.
  - **The bands are deliberately generous.** A correct answer is a *good* answer; the mapping must
    not punish a user for reading time. `Good` is the default outcome and its window is wide;
    `Easy` requires genuinely fast recall; `Hard` is reserved for a clearly laboured answer, not a
    merely unhurried one. This matters doubly for a foreign-script app — reading a Thai/Japanese
    prompt plus four MC options consumes several seconds *before* recall begins, so tight bands
    would systematically mislabel solid answers as `Hard` and needlessly shorten intervals.
  - **Starting defaults** (to be calibrated against real timing data, and generous by design):

    | Response time (correct) | Rating |
    |---|---|
    | wrong answer | `Again` |
    | ≤ 4 s | `Easy` |
    | 4 – 12 s | `Good` |
    | > 12 s | `Hard` |

    Note the wide `Good` band and the 12 s floor before `Hard` — ordinary correct answers land in
    `Good` or better; only real hesitation reaches `Hard`.
  - **Question-type sensitivity**: sentence word-block questions inherently take far longer than a
    single MC. Thresholds should therefore be **per-question-type** (or normalised by type), biased
    toward the slower type, so a slow-by-nature question isn't misread as struggle. Exact per-type
    values are a calibration task, not fixed by this ADR.
  - Rationale for response-time bands over a flat binary map (`correct → Good` always): a binary
    map never emits `Hard`/`Easy`, collapsing FSRS's per-card difficulty signal and forfeiting
    most of the efficiency advantage FSRS holds over SM-2. Response time recovers that signal
    **without any UI**.
- **Rating inference is app-layer, not in `@gll/srs-review`.** The scheduler stays a pure
  `rating → new card` function; the policy for *choosing* the rating (thresholds, response-time
  bands, and any future override) is runner config. This makes swapping the *algorithm* and
  swapping the *rating policy* independent moves.

### D6. Explicit "mark as hard" override — deferred (not in initial build)

The only manual rating input consistent with the app's no-friction philosophy is an optional
"this was hard" flag the user may *choose* to set. It is **deferred**. When added, it is purely
additive: one more signal into the same app-layer inference (an explicit `hard` overrides the
response-time guess). It touches **neither** the scheduler interface, the store, nor the schema.

---

## Dependency direction

```
        @gll/srs-engine-v2   (pure: Learning, WordState, GraduationHook — NO ts-fsrs)
              ▲        ▲
              │        │
   @gll/srs-review   @gll/srs-shelving   (pure sibling domain packages)
   (ts-fsrs here)
              ▲
              │
            @gll/db      (ReviewStore + SqliteReviewStore, async, better-sqlite3)
              ▲
              │
        app / demo / server   (main-review.ts, reviewv2 modes, rating inference, GraduationHook wiring)
```

One-way, acyclic. The engine knows nothing of FSRS, persistence, runners, or ratings.

---

## Scope

**In scope for EP21 implementation (separate conversation):**

- New `packages/srs-review` — `ReviewScheduler`, `FsrsScheduler`, review domain types; move
  `ts-fsrs` in; remove it from `srs-engine-v2`.
- `ReviewStore` + `SqliteReviewStore` in `packages/db` (async, drizzle, `review_cards` table).
- App-layer `main-review.ts` runner (deck-scoped + pool-global), mock seeder, **response-time →
  rating inference** with configurable thresholds, and the `GraduationHook` wiring that seeds +
  persists on graduation.

**Out of scope (carried forward — see EP21 Open Questions OQ1–OQ8):**

- Explicit "mark as hard" override (D6 — deferred)
- Review → Learning re-entry on lapse threshold (OQ1)
- Per-word-type mastery thresholds (OQ3)
- Shelving semantics for already-graduated words (OQ4/OQ7)
- Practice-mode vs scheduled-review / due-date bypass (OQ8)
- Hono / D1 remote wiring
- Question-type distribution (MC only throughout)

---

## Consequences

**Positive**:

- Every layer keeps its established boundary — engine pure, `db` owns persistence, siblings own
  adjacent domain logic. Consistent with the post-EP30 architecture the codebase actually has.
- `ts-fsrs` is fully isolated from the core engine; swapping schedulers touches one package.
- No forced rating UI — the app's friction-free quiz UX is preserved; FSRS still gets a full
  4-way rating signal via response-time inference.
- Rating policy and scheduling algorithm are independently swappable.
- `srs-review` is unit-testable in isolation exactly like `srs-shelving`.
- Resolves, rather than silently inherits, the contradictions between the 20260321 ADR and DS02.

**Negative**:

- Three touch-points instead of one; a review feature can span `srs-review` + `db` + app.
- Revising DS02 means physically moving `ts-fsrs` and updating `srs-engine-v2`'s manifest and any
  scaffolding that assumed the scheduler would live in the engine.
- Response-time inference is noisier than a self-rating and needs empirical threshold calibration
  (and possibly per-question-type normalisation).

**Neutral**:

- `GraduationPerformance` is derived at the app layer from `WordState`; `srs-review` exposes the
  mapping but never reads persistence itself.
- The 20260321 ADR remains the source of truth for FSRS *behaviour*; this ADR governs *layout* and
  *rating sourcing*.

---

## Alternatives considered

**Packaging**

- **A. Scheduler stays in `srs-engine-v2` (status quo per DS02).** Rejected: pulls `ts-fsrs` into
  the core library and diverges from the `srs-shelving` sibling-package precedent. The engine
  would carry a scheduling dependency it never calls itself.
- **B. One monolithic `@gll/srs-review` owning scheduler *and* persistence *and* runner** (the
  20260321 layout, relocated). Rejected: re-introduces `better-sqlite3` into an `srs-*` domain
  package — exactly what DS02/EP30 moved persistence *out* of — and duplicates the role `db`
  already plays for `LearningStore`.
- **C. Scheduler in `db` next to the store.** Rejected: `db` is the I/O layer; a pure FSRS
  scheduler with no persistence concern doesn't belong there and would be untestable without the
  store.

**Scheduling algorithm** (per [scheduling-libraries research](../research/20260319T000000Z-srs-scheduling-libraries.md))

- **SM-2 (`supermemo`)** — simpler, decades-proven, but ~30% less efficient and no difficulty
  model. Rejected as the initial implementation; still reachable behind the interface.
- **Memrise fixed ladder** — trivial, but weakest efficiency and punishing full-reset-on-wrong.
  Rejected for the algorithm; its *UX* ideas (short sessions, "difficult words") are borrowed
  elsewhere.
- **FSRS (`ts-fsrs`) — chosen** as the initial `ReviewScheduler` implementation. Best-in-class
  retention efficiency and humane lapse handling. Not a lock-in: the `ReviewScheduler` interface
  is the contract, and `schedulerData` is opaque, so swapping algorithms needs one line changed
  and no schema migration.

**Rating sourcing** — see D5. Self-rating UI rejected (friction); flat binary map rejected
(discards FSRS's difficulty signal); response-time inference chosen.
