# ADR: Seeding & Replay — One Domain-Replay Tool for Scenario-Seeding and Artifact-Replay

**Date**: 20260711T140330Z
**Status**: Accepted

<!-- Status: Accepted | Superseded | Deprecated -->

**Superseded by**: N/A
**Epic**: Recorded independently of implementation timing; the tool may be built across this epic or a later one. The decision stands regardless of when it is actioned.
**RFC**: N/A

---

## Context

Two needs, currently served by separate and diverging code, are the **same operation**:

1. **Scenario-seed** — put the DB into a particular state so a tester can manually verify a screen (e.g. "a word mid-mastery", "a graduated word with a review card due"). Today this is done two independent ways:
   - `apps/cli-demo-db` — `db-tools-cli seed <fixture>` writes **hand-authored `WordState` snapshots** directly via `SqliteLearningStore.upsertWordState` ([db-fixtures.ts](../../apps/cli-demo-db/src/db-fixtures.ts): `baseline` / `mid-session` / `sentence-ready`), plus separate review seeders (`seed-graduated-review-cards.ts`, `seed-mock-reviews.ts`). Target: `.data/learning-state.db`, user `cli-user`.
   - `apps/server` — `pnpm seed <scenario>` + `POST /api/test/seed/scenario` compute FSRS histories via a **scenario builder** ([scenario-builder.ts](../../apps/server/src/seed/scenario-builder.ts)). Target: `.data/srs-demo.db`, user `demo-user`. See [FSRS Seeding — Snapshot Builder](20260710T090706Z-engineering-fsrs-seeding-snapshot-builder.md).

2. **Artifact-replay** — take a captured session and re-run it onto the DB to reproduce a bug ("after this session the word's `WordState` is not what I expected"). The tester can see the bug by eye but cannot **hand it to the engine** to reproduce it. This is the observability gap named in Pillar 4 of the [Learning-Authority ADR](20260708T125551Z-engineering-srs-demo-learning-authority-and-debug-trace.md); *how a session is recorded* is owned there — **this ADR owns only the tool that consumes an artifact.**

The unifying fact — already ratified for the FSRS half — is that **seeding is domain-logic replay, not row insertion**: valid state is produced by running inputs through the real engine/scheduler and writing the result through the `@gll/db` store interface, never by asserting raw rows. Scenario-seed and artifact-replay are the same shape (compose state → write via store); they differ only in **where the state comes from**. Building artifact-replay as yet another standalone stack would create a *third* divergent seeder — the very duplication the (stranded, non-merging) EP39 placement ADR set out to end. This ADR unifies them into one tool and records the consolidation, since the branch that first proposed it will not merge and the need re-derives the same conclusion independently.

Scope: this ADR is about the **tool**. It is not about `srs-demo`'s runtime authority model, and it is not tied to any config epic.

---

## Decision

### D1 — One domain-replay tool, two scenarios, three sources

A single tool composes state and writes it through the `@gll/db` stores. It accepts three **sources**, mapping to the two scenarios:

| Source | Scenario | Nature |
| --- | --- | --- |
| **Authored snapshot** (`mid-session`, `sentence-ready`, …) | scenario-seed | Direct `WordState` write — valid for Learning, where a state is six plain integers |
| **Computed scenario** (FSRS histories) | scenario-seed | Domain-replay via `FsrsScheduler` — required for Review's derived card blob |
| **Replayed artifact** (recorded answer stream) | artifact-replay | Domain-replay via `applyAnswer`, folding recorded inputs into a `WordState` trajectory, with a diff |

There is **one write sink** (the stores) and one shared composition core; the source is the only thing that varies.

### D2 — Artifact-replay is transition-recompute, diffed

Replaying an artifact folds its **recorded answer stream** through the **same pure transition** the server ran live, seeding a fresh in-memory store (`better-sqlite3 ':memory:'`, reusing `SqliteLearningStore` — no new store impl) or an existing DB, and **diffing** each recomputed `WordState` against the recorded `afterState`. The first divergence, with its exact inputs, is the pinpointed bug.

This is **deterministic by construction**: the Learning transition path (`updateRunState` / `processRecheckResult`) reads no clock and no `Math.random` — the engine's only non-determinism is in batch assembly (`shuffle`, `assemble-batch`), i.e. orchestration, never the state transition.

### D3 — Extract one `applyAnswer`; the tool and the live route share it

The transition logic inlined in the `POST /api/answer` handler ([answer.ts](../../apps/server/src/routes/answer.ts)) is lifted into a pure, dependency-injected `applyAnswer(store, event, thresholds) → { before, after, graduated }`. Both the route and the replay source call it, so replay parity with production holds **by construction**, not via a second implementation. This is the golden-master property Pillar 4 assumes, claimed only for the channel where it actually holds.

### D4 — The artifact is self-contained

An artifact replays with **no dependency on the origin database**. It carries: the **resolved thresholds** in force (the transition depends on per-user config the raw `answer_events` row does not record); a **lazy per-word baseline** (each touched word's `WordState`, snapshotted on first appearance — small, seeds a fresh store); the **ordered input log** (`wordId, correct, latencyMs, recheck, recordedAfter`, stitched by `correlationId`); and the **recorded appearance context**. Scope follows `answer_events`: **word transitions only, direction-blind**; sentence answers do not hit this path. A realistic session is ~170 KB raw / ~25 KB gzipped.

Appearance is carried as **recorded context** for reading, **not recomputed**. Recomputing orchestration to auto-reproduce "the wrong word appeared" would require a seeded RNG through `shuffle`/`assemble-batch` plus capturing the full input environment; it is **explicitly deferred** — cheap in bytes, but it changes the pure engine and is version-fragile, and earns its cost only when an orchestration-*selection* bug cannot be diagnosed from the transition trajectory plus the recorded appearance log.

### D5 — Fit with existing seeders: subsume, don't duplicate

`cli-demo-db`'s `db-fixtures` (authored snapshots) and `apps/server`'s `scenario-builder` (computed) become **entries in one shared scenario catalogue** inside the tool, alongside artifact-replay. The **target — db-path + userId — is injected**, which is the seam that lets one core serve both `cli-demo-db`'s `.data/learning-state.db`/`cli-user` and the server's `.data/srs-demo.db`/`demo-user` (today two hardcoded CLIs). `cli-demo-db`'s overlapping seeders are repointed at / deleted in favour of the shared catalogue **when the tool is extracted** (D6), not before.

**Authority caveat:** `cli-demo-db` is out of scope for `srs-demo`'s *runtime* authority (it bypasses the server and runs the engine directly). But **seeding writes below that boundary** — through the `@gll/db` store interface, not through `/api/answer` — so `cli-demo-db` can *consume* this tool despite that. Seed-time write path ≠ runtime authority path. (`cli-demo-db`'s live loop runs its own inline transition; artifact-*replay* parity for it would eventually want the shared `applyAnswer` too — a later consolidation, not a blocker.)

### D6 — Placement: the shared core is `@gll/srs-fixtures`; CLIs are thin per-app wrappers

The **package holds the pure, dependency-injected core**; process shells stay app-side. This follows the layering rule already recorded for boundary packages (`@gll/db` and `@gll/srs-engine-v2` absorb no app glue): a composition tool sits *above* the storage boundary, not inside it.

| Piece | Home |
| --- | --- |
| Scenario catalogue (authored fixtures + computed scenario-builder), `apply-scenario` write glue, `replayArtifact` core, shared `applyAnswer`, artifact-contract types/parse | **`@gll/srs-fixtures`** (deps: `@gll/db` + `@gll/srs-engine-v2` + `@gll/srs-review`) |
| CLIs (`pnpm seed`, `db-tools-cli`) — argv/dispatch; **db-path**; **userId**; the `POST /api/test/seed/scenario` route; browser-side artifact record/download | **App-side**, importing the package and injecting `{ store, dbPath, userId }` |

The existing `db-tools-cli.ts`, `cli.ts`, `db-fixtures.ts`, `scenario-builder.ts` are **split along the pure-core / process-shell seam** — composition moves into the package, argv/path/route stay in the app — not moved wholesale.

**CLI surface = thin per-app wrappers, not one generic flag-driven CLI.** Rationale: only per-app wrappers preserve the snapshot-builder ADR's **zero-config-DB-path hard requirement** (each app defaults to *its own* path/user; a generic `--db-path`/`--user` CLI reintroduces the drift that requirement outlaws); they keep the boundary package process-free; and the wrappers already exist (~30 lines each) so the cost is repointing dispatch, not new surface. Replay is exposed as a mode/subcommand on the same CLI (e.g. `seed --replay <artifact>`), surface detail left to design-spec.

**Extraction is YAGNI-gated.** `@gll/srs-fixtures` is *decided* here but not built on this ADR alone; the trigger is a concrete second consumer of the shared core — artifact-replay is that second consumer. Until extraction, the seeders stay where they are and the duplication is tolerated.

### D7 — Retire the client-snapshot debug hack

Once artifact-replay lands, the batch-boundary client logger (`useQuizDebugLog.ts` → `debug-logs.ts` file-sink, and the snapshot half of `PoolDebugPanel.vue`) is superseded: it captures state without the inputs that caused a transition, is non-durable, and cannot be re-run. The transition-recompute artifact replaces it.

---

## Consequences

**Positive**:

- One tool, one catalogue, one write sink: a scenario/artifact is composed through **one** engine path and cannot drift between "the seeder's engine" and "the replay's engine" — ending the three-way seeder divergence.
- Turns "this word's state is wrong" into a **durable, engine-reproducible fixture**: a ~25 KB self-contained file reproduces the exact `WordState` on any machine, fresh, no database — the "hand the bug to the engine" gap, closed.
- **Golden-master by construction** via the single `applyAnswer`; artifacts double as free regression fixtures.
- Injected target unifies the two apps' seeding without collapsing their identities (paths/users stay app-owned).

**Negative**:

- Requires extracting `applyAnswer` from the Hono route before replay can reuse the live path.
- The recording path must capture resolved thresholds — an input `answer_events` does not carry today.
- Appearance bugs ("wrong word appeared") are diagnosed by eye from recorded context, not auto-reproduced, until/unless the deferred seeded-RNG recompute is undertaken.
- `cli-demo-db`'s inline live-loop transition is not yet the shared `applyAnswer`, so its *replay* parity is a later step.

**Neutral**:

- `@gll/srs-fixtures` is decided but not built; extraction is YAGNI-gated on the artifact-replay consumer.
- The tool runs in Node (reuses `better-sqlite3`), never in the `srs-demo` browser bundle.
- *How* artifacts are recorded (Start/Stop UI, session scoping, the Learning↔Review crossing) is owned by the debug-trace recording side (Pillar 4), not this ADR.
