# MVP — Definition of Done (pre-epic planning)

**Status**: In discussion. Not yet an epic; no roadmap/gap doc authored yet.
**Started**: 2026-07-12
**Context**: Came out of the "what's the next epic" prioritization discussion (post-EP41).

**Framing (PO, 2026-07-12)**: This is the **DoD for the MVP** — the first end-to-end shippable
product — NOT a separate "beta" milestone. "Beta" = Gate 2 (~3 testers) is simply *who the MVP ships
to*. The DoD therefore defines **MVP scope** (which learning loops are in/out), not just access.
NAMING NOTE: avoid "Stage 1" — `roadmap/` already uses Stage 1 (engine EP01–10) / Stage 2 (API layer)
for *engineering* build-sequences. This is a *product* milestone; name it "MVP Definition of Done" to
avoid renumber collision. (Confirm with PO.)

---

## How this surfaced

Ranking the 8 candidate next-epics (SCRATCH.md list) first on *importance × quick-win*, then
re-grounded on the ADR-implementation audit
(`product-documentation/research/20260711T003927Z-adr-implementation-audit.md`). The audit named
**retention metrics (#7)** as its single remaining recommended action.

**PO countered the audit's ranking**: audio (#4) is a **hard beta-release blocker** — pronunciation
is table-stakes for a language app. Its "no ADR" status reflects repeated PO deferral, NOT low value.
The audit only measures what's *decided* (ADRs), not what a *release needs*. This introduced a new,
stronger prioritization axis: **beta-release gating** (not importance × quick-win). Captured also in
Claude auto-memory `audio-beta-release-blocker.md`.

## Key correction — audio is less undocumented than the audit implied

The audit only covers `architecture/` (ADRs). Audio already has:
- PRD: `product-documentation/prds/20260302T000000Z-gemini-tts-generation.md`
- Cost model: `product-documentation/cost-models/20260227T163726Z-gemini-tts-cost-model.md`

What audio LACKS is an **ADR** (the how) + **implementation**. Smaller gap than "from scratch."

## The beta-gating cluster (release-blocker set under the beta lens)

- **#4 Audio** — PO-declared hard gate (pronunciation).
- **#5 Cloudflare / hosted env** — testers can't run local `better-sqlite3`; need a reachable URL.
  Audit §4.3: nothing deployed; driver (libSQL/Turso vs D1) still undecided → needs a hosting ADR.
- **#2/#1 Minimal multi-user identity** — single seeded `demo-user` today; multiple testers collide
  progress. EP41 config-two-tier **D4 "identity now, auth later" resolver is the seam**. Beta may
  need only minimal multi-user, not full OAuth.
- **#7 Retention metrics** — NOT a blocker, but wanted as **day-one instrumentation** so first-cohort
  tester data is captured. `review_answer_events` already exists as its seed data.

## Where the Beta DoD document will live (taxonomy decision)

A "definition of done" is not standalone here — it's the centerpiece of a **roadmap stage doc**
(see `product-documentation/roadmap/…-stage2-build-sequence.md`: Decisions Locked → Now scope →
Definition of Done → What It Proves → Epic List). Beta = the next stage in that lineage.

Two candidate homes by headspace:
- Scope mostly known, lock exit criteria → `roadmap/…-beta-release-stage.md`.
- Still surfacing unknowns → a `beta-readiness-gaps.md` register (mirrors top-level
  `20260304T125757Z-mvp-readiness-gaps.md`), which then feeds the roadmap doc.
Working assumption: **start in gap-register mode**, graduate to the roadmap doc once forks resolve.

## Load-bearing questions the Beta DoD must answer (dependency order)

1. **Purpose — what is beta meant to prove/learn?** (bugs? retention/engagement? "is the loop
   teaching?" pronunciation quality?) Anchors everything; e.g. if retention → #7 becomes part of DoD.
2. **Audience & access** — how many testers, invited/private, how they reach it → decides #5 shape
   (private link + shared data vs. true hosted app).
3. **Data isolation** — separate progress/accounts per tester? → decides how much of #2/#1 is needed
   for beta vs. deferred.
4. **Feature bar** — which loops must work end-to-end (word, sentence, review, audio). Audio is a gate;
   what else is non-negotiable?
5. **Content & stability bar** — how much content for a real session; crash/data-durability floor.
6. **Explicit non-goals** — what beta deliberately excludes.

## PRODUCT-BRIEF reconciliation (brief is 2026-03-02, ~30 epics stale)

The brief helped frame beta but conflicts with current reality on several points:
- **Gate ladder rescaled by PO (2026-07-12)**: Gate 1 solo × 7d (gut-check) → **Gate 2 = 3 users × 30d**
  → **Gate 3 = 10 users × 30d**. (Brief had Gate 2 = 200 users.) **"Beta" = Gate 2 (~3 invited
  testers)** — a gut-check, not statistical validation.
- **Retention**: brief asserts "≥80% retention, validated" as headline metric; reality =
  undefined/uninstrumented. **PO decision: retention is NOT a beta gate — passive data-gathering only,
  not user-facing.** `review_answer_events` already logs raw data; define the metric later. (This
  demotes the audit's "top open item" — that was ADR-hygiene priority, not product priority.)
- **Curation engine unbuilt** → beta content is **admin manual upload to cloud/DB**, no curator UI,
  no admin RBAC. Cheapest path = existing **seed/replay tooling pointed at hosted DB** (Seeding &
  Replay ADR built with injected target db-path + user).
- **Audio "all manual" (PO)** → brief's TTS stack (Gemini API, 10 RPD quota, Queues, R2, lazy per-word
  gen) is **OUT of beta scope**. Beta audio = manually-produced files + **playback only** in srs-demo.
- Stale wording (not beta-blocking): brief says "ANKI algorithm" (reality FSRS + review-ahead/EP39);
  "mastery configurable" (EP41 fixed masteryThreshold as T3); V1 scoped out sentences (they now exist
  as contextual questions); assumes full PWA + Cloudflare (reality: local better-sqlite3 + Vue demo).

## Revised beta-gating cluster (after PO answers 2026-07-12)

Beta spine = **hosting spike + minimal identity + audio-playback + seed-to-cloud content**:
- **#4 Audio → SMALL**: manual files + playback in srs-demo only (no TTS pipeline).
- **#5 Hosting → the real work**: reachable URL + hosted DB for ~3 testers (stability, not load).
- **#2/#1 Identity → MINIMAL**: separate 3 testers' data + an admin upload path. Not full OAuth/RBAC.
- **#7 Retention → DROPPED as a gate**: passive capture of already-logged data.

## RESOLVED — Hosting + storage (Forks A + C), PO 2026-07-12

**Decision: MIXED PLATFORM — GCP compute+DB + Cloudflare R2 for audio.** Keep the entire SQLite/Drizzle
data layer; no migration, no D1, no Workers.

Path the PO walked to get here (record so it isn't re-litigated):
1. PO **rejects D1** outright, and questioned SQLite itself — wanted Postgres or MongoDB on a free
   Google/Amazon service.
2. Surfaced the constraint conflict: *free-forever + first-party Google/Amazon + keep relational/Drizzle*
   can't all hold. Free+first-party ⟹ Firestore/DynamoDB (NoSQL, full persistence rewrite, drop Drizzle);
   real free Postgres ⟹ 3rd-party (Neon/Supabase); real free Mongo ⟹ Atlas M0. **→ Mongo/NoSQL = rewrite
   of ~15 epics; Postgres = bounded port. PO chose to KEEP SQLITE** ("present SQLite options").
3. PO added **co-location + generous bucket** as criteria (Cloudflare originally chosen for R2's bucket).
   Clarified: **R2's zero-egress + 10GB free is the best free bucket**; but Cloudflare's co-located DB is
   D1 (rejected) and compute is Workers (a runtime port).
4. **Co-location premise corrected**: audio (static files) is served **browser → bucket directly** via
   public R2 URL; the DB only stores the object key/URL. So the bucket need NOT be co-located with the
   DB — R2 is **S3-compatible**, a bolt-on to any stack. This dissolves the reason to take D1/Workers.

**Resolved combo (Combo A):**
- **Compute + DB**: GCP **always-free e2-micro VM** running the existing Node/Hono server +
  `better-sqlite3` SQLite file on a persistent disk. Google-branded, free-forever, **zero code change**.
- **Audio (Fork C)**: **Cloudflare R2** via S3-compatible API; app stores object keys, testers fetch
  audio from public R2 URLs (zero egress).
- **Optional**: front the GCP VM with Cloudflare's free proxy/CDN (TLS, DDoS, shaves GCP egress).
- **Cost accepted**: two accounts (GCP + Cloudflare); PO operates the VM (patching, process mgr, DB-file
  backups). SQLite-on-single-VM has a known scaling ceiling — fine for 3 testers; revisit at endgame
  (async-storage contract permits a later DB swap).

**ADR — WRITTEN 2026-07-12**: `architecture/20260712T124801Z-infra-mixed-platform-hosting.md`
(Status: Accepted). Supersedes-in-part the Cloudflare/D1 infra ADR
(`20260301T161844Z-infra-cloudflare-platform.md`, banner added) and closes audit §4.3. Headline
decisions: keep SQLite/Drizzle (no migration) · GCP e2-micro VM compute+DB · R2 standalone audio bucket
· D1 + Workers rejected. Open questions parked in the ADR: backup cadence, content/audio volume,
stability floor, R2 key convention, VM/TLS setup, OAuth-on-Vue+Hono.

## RESOLVED — Tester access (Fork D) + MVP scope bar, PO 2026-07-12

**Fork D → REAL Google OAuth login** (PO chose the heavier path over pre-provisioned tokens).
- Pulls the **auth work INTO the MVP** — no longer deferrable. Only the **learner slice** of the User
  Management PRD (`prds/20260226T150000Z-user-management-auth.md`): Google OAuth auto-creating learner
  accounts + JWT sessions. **NOT** the full 3-role RBAC (admin/curator) — content stays admin-manual
  seed-CLI upload, which doesn't touch OAuth.
- **Design flag**: brief assumed `nuxt-auth-utils`, but srs-demo is **Vue, not Nuxt** → the OAuth impl
  path (Vue SPA + Hono backend) needs its own small design decision in the auth epic.

**MVP scope bar → LEAN.**
- **IN**: core word learning (MC + word-block) · **audio pronunciation playback** (the gate) · **daily
  FSRS spaced-repetition review** (built EP36/39; makes retention capture meaningful).
- **OUT (deferred/hidden)**: **sentence questions** and **foundational deck**. Both are already built &
  wired → "out" = **hide behind a flag**, not remove (small task, not deletion).

## MVP Definition of Done — consolidated (all forks resolved 2026-07-12)

- **Audience**: Gate 2 = ~3 invited testers, 30 days (gut-check, not statistical).
- **Hosting/DB**: GCP always-free e2-micro VM + existing Node/Hono + `better-sqlite3` (zero migration);
  optional Cloudflare free proxy in front. Needs hosting ADR (supersedes Cloudflare/D1 infra ADR).
- **Audio**: manual files → Cloudflare R2 (S3 API, public URLs, zero egress) → playback in srs-demo.
- **Auth**: real Google OAuth learner sign-in + JWT (Vue+Hono impl TBD). No RBAC.
- **Content**: admin manual upload via seed CLI against the GCP-hosted DB (Fork B: reuse seed tooling,
  no admin UI). Needs ≥ enough authored decks (+ their audio) for a meaningful 30-day session.
- **Loops IN**: word MC/word-block, audio playback, daily FSRS review.
- **Loops OUT (flag-hidden)**: sentence questions, foundational deck.
- **Retention**: passive capture only (`review_answer_events`); not user-facing, not a gate.
- **Stability floor**: crash-free core loop, DB-file durable + backed up (TBD: define exact floor).

## Still open / TBD

- **Fork B confirm**: reuse seed CLI vs admin UI (recommended: seed CLI). PO not explicitly confirmed.
- **Content volume — RESOLVED (PO, 2026-07-12)**: PO will generate **≥ 10 content decks + their
  audio** as the MVP content bar (retention-sizing for the 30-day window). PO-supplied; no derivation.
- **Stability floor**: exact crash/durability/backup bar.
- **Auth impl design**: Google OAuth on Vue SPA + Hono (brief assumed Nuxt).

## Next step

All major forks resolved. **Shape the doc**: start as a gap-register (mirrors
`20260304T125757Z-mvp-readiness-gaps.md`) capturing the resolved decisions + the TBDs above, then
graduate to a roadmap stage doc titled **"MVP Definition of Done"** (avoid "Stage 1" — collides with
roadmap engineering-stage numbering). Downstream epics implied: hosting/deploy, auth (learner OAuth),
audio (manual + R2 + playback), flag-hide sentences/foundational, seed-to-cloud content.
