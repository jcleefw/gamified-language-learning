# ADR ↔ Implementation Audit (full history, June-2026 precedence)

**Created**: 20260711T003927Z
**Updated**: 20260712 — the six ADRs flagged in §4.5/§6-item-1 have been flipped to Accepted (commit `231a9ba`); §2/§3 tables and §4.5 below reflect the current state. Also added the previously-uncited Domain-Replay Tool ADR (20260711T140330Z) to §2.
**Author**: BA/PO-assisted audit (Claude)
**Scope**: All ADRs in `product-documentation/architecture/`. Conflicts resolved in favour of the **later (post-June-2026)** ADR where they overlap, per PO instruction.
**Purpose**: (1) verify what is built vs. decided, (2) highlight where a post-June ADR overrides a pre-June one, (3) surface documentation drift for discussion, (4) consolidate deferred/future work.

---

## 1. Method & strength of evidence

This audit is **static + historical**, not behavioural:

- **Static**: read each ADR's Decision section, then `grep`/read the source for the named symbols, tables, endpoints, and traced the actual logic (not just symbol presence) for the high-stakes rules.
- **Historical**: cross-referenced `.agents/changelogs/EP*` to confirm a decision was _actually shipped_, not just coded speculatively. Changelog EP-numbers are cited as evidence below.
- **NOT done**: no tests run, no typecheck, no app driven. A "Built ✅" here means _code exists and matches the decision's shape, and a changelog records the work_ — it does **not** certify the code passes its tests or behaves correctly at runtime. Rows needing behavioural proof are flagged.

Confidence tiers used: **High** = read the logic + changelog; **Med** = symbol/table present + changelog; **Doc-diff** = ADR-vs-file comparison I read directly (highest certainty of the _discrepancy_).

---

## 2. Post-June 2026 ADRs — status recap

| ADR (date)                                        | Doc status     | Built?                      | Evidence                                                                                 | Confidence |
| ------------------------------------------------- | -------------- | --------------------------- | ---------------------------------------------------------------------------------------- | ---------- |
| Database schema (06-20)                           | Accepted       | **Partly stale** (see §4.1) | `schema.ts`                                                                              | Doc-diff   |
| Shelving & stagnation (06-26)                     | Accepted       | ✅                          | `user_shelved_words`, `user_deck_word_tracking`; EP26                                    | High       |
| ContentStore & deck-document (07-06)              | Accepted (flipped 07-12) | ✅ shipped    | `SqliteContentStore`, `decks.doc`, `DeckDocSchema`; **EP35**                             | High       |
| Async storage contract (07-06)                    | Accepted (flipped 07-12) | ✅ shipped    | both stores `Promise<…>`, `no-floating-promises` lint; **EP34**                          | High       |
| SRS review packaging & rating (07-08)             | Accepted       | ✅                          | `review_answer_events`; EP36                                                             | Med        |
| srs-demo learning authority + debug trace (07-08) | Accepted       | ✅                          | server-authoritative `/api/answer`; trace composables; EP37/EP40 (+post-hoc dump, 07-12) | Med        |
| Seeding & Replay — one domain-replay tool (07-11) | Accepted       | ✅                          | `pnpm seed replay`; `applyAnswer` shared fold; post-hoc `/api/debug/transitions-recent` extension (07-12) | Med |
| Injected logger (07-08)                           | Accepted       | ✅                          | `@gll/logger` port + Noop default                                                        | Med        |
| Config ownership & layering (07-09)               | Superseded     | n/a                         | correctly points to two-tier                                                             | High       |
| Review-ahead / due-gated advance (07-09, EP39)    | Accepted       | ✅                          | due-gate `reviews.ts:145`; `/anytime`; eager `rating=null`; `ReviewHub.vue`; **EP39**    | High       |
| FSRS seeding snapshot builder (07-10)             | Accepted       | ✅                          | `seed/scenario-builder.ts` backdated replay                                              | Med        |
| Seed scenario placement (07-10)                   | Accepted       | ✅                          | `apps/server/src/seed/*` consolidated                                                    | Med        |
| Config two-tier (07-11, EP41)                     | Accepted       | ✅                          | presets, per-user store, `pedagogy` dropped, `masteryThreshold` fixed; **EP41** (merged main, #38, 07-12) | High       |
| Question-direction recording (07-11)              | Accepted       | ⏸ **deferred by design**    | no impl expected; see §5                                                                 | High       |

---

## 3. Pre-June 2026 ADRs — status & supersession

| ADR (date)                                           | Doc status                         | Reality                          | Note                                                                                                 |
| ---------------------------------------------------- | ---------------------------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------- |
| FE framework & toolchain (02-26)                     | Accepted                           | Stable                           | Vue/Nuxt/PandaCSS. `srs-demo` is Vue (not full Nuxt yet) — consistent with PWA staging.              |
| FE PWA strategy (02-27)                              | Accepted                           | Future                           | PWA delivery not yet built; roadmap item.                                                            |
| Monorepo tooling (02-27)                             | Accepted                           | ✅ Built                         | pnpm + turbo workspace present.                                                                      |
| Infra — Cloudflare platform (03-01)                  | Accepted                           | **Future / partially overtaken** | See §4.3 — local `better-sqlite3` only; D1/Workers not deployed; async ADR is the forward bridge.    |
| SRS engine as package (03-02)                        | **Superseded**                     | n/a                              | → SRS engine v2 learning-phase (03-19). Correctly linked.                                            |
| Headless Hono backend (03-03)                        | Accepted                           | ✅ Built                         | `apps/server` is Hono.                                                                               |
| Curation engine as package (03-03)                   | Accepted                           | ❌ Not built                     | No `curation` package/app exists. Future (Stage 7).                                                  |
| Agentic memory hook (03-04)                          | Accepted (flipped 07-12)           | Partially                        | `.agents/memory/` used; hook mechanics governance-side, out of product scope.                        |
| Archived src structure (03-05)                       | Archived                           | n/a                              | Superseded by CODEMAP.                                                                               |
| **API surface design (03-05)**                       | Accepted                           | **Diverged** ⚠                   | See §4.2 — envelope, namespace, and types-only all diverge.                                          |
| Quiz contract & answer authority (03-13)             | Accepted (flipped 07-12)           | ✅ Built                         | EP15 shipped server-authoritative answers.                                                            |
| SRS engine v2 — learning phase (03-19)               | Accepted                           | ✅ Built                         | `@gll/srs-engine-v2`; EP20.                                                                          |
| **SRS engine v2 — review phase (03-21)**             | Accepted, **Amended**              | ✅ Built + amended               | **Amended by** review-ahead ADR (07-09) — due-only reversed. Correctly linked. See §4.4.             |
| Mastery is global (05-12)                            | Accepted                           | ✅ Built + load-bearing          | Reaffirmed by config two-tier D6.                                                                    |
| composeWordBatch boundary (05-12)                    | Accepted (flipped 07-12)           | ✅ Built                         | EP23/EP25 composer registry.                                                                          |
| composeSentenceBatch boundary (05-12, amended 05-14) | Accepted                           | ✅ Built                         | EP23.                                                                                                |
| Batch execution mechanics (05-13)                    | Accepted, **partially superseded** | ✅ Built                         | Business rules current; `runBatch` architecture superseded by orchestrator (05-16). Correctly noted. |
| Sentence corpus ingestion (05-14)                    | Accepted (flipped 07-12)           | ✅ Built (as document import)    | Now flows through ContentStore `importCurriculum`; see §4.1.                                          |
| Adaptive session orchestrator (05-16)                | Accepted                           | ✅ Built                         | `BatchQueueManager` / orchestrator.                                                                  |
| BatchQueueManager pattern (05-16)                    | **Superseded** (05-17, self)       | n/a                              | Internal supersession noted in-file.                                                                 |

---

## 4. ⚠ Conflicts & drift to resolve — **later ADR / reality takes precedence**

### 4.1 Database Schema ADR (06-20) is stale vs. the document model (post-June wins)

The 06-20 schema ADR bills itself _"the complete schema for all domains in a single authoritative document."_ It is now out of date:

- It defines **`sentences` + `sentence_components`** as relational tables. The **ContentStore ADR (07-06)** collapsed these into the `decks.doc` JSON column — which is what actually ships (`schema.ts`, EP35). The 06-20 doc was never amended.
- It is **missing three tables that now exist**: `answer_events`, `review_answer_events`, `review_transition_events` (from the packaging / debug-trace / EP40-ST05 work).

**Precedence**: ContentStore (07-06) + later event-log work win. **Action**: add an "Amended by ContentStore ADR (07-06); event-log tables added post-hoc" banner to the 06-20 ADR, or explicitly demote it and name `schema.ts` the source of truth. _(Evidence: `schema.ts` read in full; EP35 changelog.)_

### 4.2 API Surface ADR (03-05) diverged from the shipped contract — no reconciling ADR

Three of its five decisions do not match the code, and **no later ADR records the change**:

| ADR §           | ADR says                                                        | Reality                                                                    | Evidence                        |
| --------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------- |
| §1 Namespace    | SRS under `/api/srs/`                                           | Flat `/api/` (`/api/reviews`, `/api/answer`, `/api/config`, …)             | `app.ts:30-36`                  |
| §2/§3 Envelope  | `{ data, meta? }` success / `{ error }` error (no discriminant) | Discriminated union `{ success: true, data } \| { success: false, error }` | `api-contract/src/errors.ts:16` |
| §5 api-contract | _"No runtime dependencies — types only"_                        | Ships **`zod`** as a runtime dependency                                    | `api-contract/package.json:23`  |

- Envelope: `ApiResponse<T>` has been `{ success, … }` since **EP13**, and **EP32** explicitly "kept as-is." So the ADR and code diverged early and were never reconciled — this predates June but the ADR is still "Accepted" as written.
- `zod` dependency: this one **is** a conscious post-June override — the **ContentStore ADR (07-06) §4** deliberately adds `zod` to `@gll/api-contract` for `DeckDocSchema`. Post-June wins; the 03-05 "types-only" rule is superseded but not annotated as such.

**Action**: reconcile the 03-05 ADR to the shipped envelope/namespace (or record an "amended by" note), and mark the "types-only" rule superseded by ContentStore ADR. _Note also a latent tension_: config two-tier D2 says _"no config type… in `@gll/api-contract`"_ while `DeckDocSchema` (content, not config) now lives there — not a contradiction, but the "api-contract is pure" mental model no longer holds and should be restated precisely.

### 4.3 Cloudflare/D1 infra (03-01) — overtaken by the async-storage bridge (not a conflict, a gap)

The infra ADR assumes D1 (async). Current storage is **local `better-sqlite3` only**; nothing is deployed to Workers/D1. The **async-storage ADR (07-06)** is the deliberate forward bridge (async contract now, sync driver today) so this is _planned debt_, not drift. **Flag**: the async ADR's own risk — _"async theatre"_ (the interface is never exercised against real network latency/failure until a real driver lands) — remains open. The actual async **driver** (libSQL/Turso vs D1) is still undecided (belongs to a future hosting ADR).

### 4.4 Review phase (03-21) due-only → review-ahead (post-June wins) — **already correctly tracked**

The 03-21 ADR's due-only model is reversed by the **review-ahead ADR (07-09)** and its OQ8 resolved by the packaging ADR. The 03-21 file already carries the "Amended by" banner and the code implements the due-gate. **No action** — cited as the model example of how the other stale ADRs should be annotated.

### 4.5 Recurring hygiene issue: "Proposed" ADRs that shipped — ✅ RESOLVED 07-12

Six ADRs were still **"Proposed"** despite being built and changelog-recorded: ContentStore (07-06, EP35), Async storage (07-06, EP34), Quiz contract (03-13, EP15), composeWordBatch (05-12, EP23/25), Sentence corpus ingestion (05-14), plus the governance-side memory hook (03-04). **Action taken**: batch-flipped to Accepted (commit `231a9ba`). No further action.

---

## 5. Deferred / future possible work (consolidated backlog)

Sourced from ADR Open Questions, the review-mode idea brief's Non-Goals/Known-Unknowns, and research gap docs. **None of these are bugs** — they are recorded, intentional deferrals.

**Review-mode & retention (EP39 lineage)**

- **Retention metric — "% of learned words retained"** — the _stated success metric_ of the review redesign, but no definition or instrumentation exists yet. Biggest open item. `review_answer_events` was built as the seed data for it. (Idea brief Known-Unknowns; review-ahead OQ-C.)
- **Retry-until-correct-today** with repeat-count influencing rating (original review gap #2) — strong candidate, session-layer only, no engine cost. (Idea brief Non-Goals.)
- **Difficult Words mode** (isolate frequently-missed items) — plus the open tension: if eager practice never advances FSRS, does a missed eager answer still feed this list? (Idea brief; review-ahead OQ-D.)
- **Speed Review mode** (timed, hearts/streak shell) — future hub mode; `ReviewHub` already framed for additional modes.
- **Typing / listening question types.**
- **Feedback dwell interaction** — explicit "Next" vs auto-advance timing.

**Direction-awareness (ratified, impl deferred — question-direction ADR 07-11)**

- Add `direction` to the answer wire fact + nullable `answer_events.direction` column (word side; cheap).
- New **sentence recording channel** — sentences don't hit `answer_events` today (structural).
- **`wordDirections` T1 user preference** (parallel to `sentenceDirections`) — deferred by config two-tier ADR to a later epic.
- The **adaptive-selection algorithm** that consumes direction data (serve weaker directions more often) — separate future design.
- Possible **direction-aware (stricter) mastery** — explicitly out of scope of current scoring (would fragment the comparable bar); flagged as a future built on the direction ADR.

**Content & schema**

- **Sense-level mastery** (`word_senses` table + `sense_id` FK) — schema ADR OQ1; forward path deliberately left open. Post-Gate-2.
- **`foundational_words` import flow** — table defined, import unbuilt; schema ADR OQ2.
- ContentStore layer-3 **`CHECK(json_valid(doc))`** backstop — flagged optional in the ADR; not built (layers 1/2/4 are). Low priority.
- Richer `AppDeckPayload` (expose component-level annotations) — additive, deferred.

**Platform / infra**

- **Async storage driver swap** to libSQL/Turso/D1 + real hosting ADR (async ADR open question).
- **Auth** — Google OAuth + JWT issuance (API-surface §4, Stage 5); config two-tier D4 "identity now, auth later" resolver is the seam.
- **Curation engine** (03-03 ADR) and **admin** surfaces — later stages, unbuilt.
- **PWA delivery** (02-27) — unbuilt.
- **Write batching at scale** (schema ADR §8) — per-answer writes fine at Gate 1; batch at batch-end only if >1000 concurrent users.
- **API path versioning strategy** — deferred to a future ADR (API-surface §1).
- **Per-deck curator config tier** — reintroduce only if genuine per-deck course-design config appears (config two-tier Neutral note).

**Research gap docs on file** (not yet closed): wordId homograph scheme (`20260514…-gap-wordid-homograph-scheme.md`), seed/seeder consolidation test strategy (`20260710…`), SRS engine v2 vs FSRS gap (`202603211351000Z…`).

---

## 6. Recommended actions (priority order)

1. ~~**Flip the six "Proposed"→built ADRs to Accepted** (§4.5). Cheapest restore of doc trust. _(Doc-only.)_~~ **Done 07-12** (commit `231a9ba`).
2. **Reconcile the Database Schema ADR (06-20)** with the document model + event tables, or demote it (§4.1). _(Doc-only.)_
3. **Reconcile the API Surface ADR (03-05)** to the shipped envelope/namespace and mark "types-only" superseded by the ContentStore zod decision (§4.2). _(Doc-only.)_
4. **Behavioural verification** (not done here) for the two active, invariant-bearing areas before merge: EP39 due-gate (NFR-005: a not-due card's schedule is provably unchanged after an eager answer) and EP41 config resolver (system-default ← user-override, forward-only). Run their package tests / drive the flow.
5. **Define the retention metric** (§5) — it is the success metric of shipped review-redesign work and is still undefined.

---

_Evidence base: `schema.ts`, `apps/server/src/{app.ts,routes/*,config/*,identity/*,seed/*,replay/*}`, `packages/{db,api-contract,logger,srs-*}/src`, `apps/srs-demo/src`, and `.agents/changelogs/EP13,EP15,EP23,EP25,EP26,EP32,EP34,EP35,EP36,EP37,EP38,EP39,EP40,EP41`. No runtime/tests executed — see §1. Post-hoc `/api/debug/transitions-recent` (07-12) verified with passing tests as part of the update pass._
