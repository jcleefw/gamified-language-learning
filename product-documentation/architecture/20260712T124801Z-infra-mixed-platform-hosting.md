# ADR: Infrastructure Revision — Mixed-Platform Hosting (GCP SQLite + Cloudflare R2)

**Status:** Accepted

**Date:** 2026-07-12

**Deciders:** PO (solo founder)

**Supersedes (in part):** [20260301T161844Z-infra-cloudflare-platform.md](20260301T161844Z-infra-cloudflare-platform.md) — the **platform topology, database, and compute-runtime** decisions. Reaffirms that ADR's **R2-for-audio** choice. Sections not in scope here (CI/CD, local-dev emulation, RBAC) are addressed elsewhere or deferred; see below.

**Closes:** ADR-implementation audit §4.3 ("async storage driver undecided"). **Relates:** [20260706T125834Z-engineering-async-storage-contract.md](20260706T125834Z-engineering-async-storage-contract.md).

---

## Context

The original infra ADR (03-01) committed the whole stack to Cloudflare — Pages (Nuxt SSR), Workers, **D1** (SQLite), R2, Queues — on the constraint "stay within one ecosystem." Four months and ~40 epics later, reality and priorities have diverged:

- The app as built is **Vue `srs-demo` + Hono on `@hono/node-server` + `better-sqlite3`** (local SQLite via Drizzle), not Nuxt-SSR-on-Pages with D1. Nothing is deployed; the D1/Workers/Pages topology was never realized.
- The immediate goal is a small **MVP for ~3 invited testers, 30 days** (Gate 2), on **free** infrastructure. Load is negligible; the requirement is *reachable and stable*, not scalable.
- **PO rejects D1 outright**, and reopened the deeper question of whether SQLite is the right store at all (Postgres or MongoDB preferred, on a familiar Google/Amazon service).
- Content for the MVP is **admin-manual-upload** (no curation engine, no TTS pipeline); audio is **manually produced** and only needs to be **played back** in `srs-demo`.

The store question was worked to a constraint conflict: *free-forever + a first-party Google/Amazon managed service + keeping the relational/Drizzle code* cannot all hold at once (free first-party managed SQL does not exist on GCP/AWS beyond trials; free first-party ⟹ Firestore/DynamoDB NoSQL). Weighed against the cost of abandoning ~15 epics of relational modeling (Drizzle is SQL-only), the PO chose to **keep SQLite**.

A separate realization removed the reason to stay all-Cloudflare: **audio does not need to be co-located with the database.** Static audio is served **browser → bucket directly** via a public URL; the DB only stores the object key. R2 is S3-compatible, so it attaches to any stack as a standalone bucket.

---

## Decision

A **mixed-platform** topology: keep the SQLite/Drizzle data layer as-is, self-host it on a free Google VM, and use Cloudflare R2 purely as a bolt-on audio bucket.

### 1. Data layer — keep SQLite + Drizzle, no migration

No port to Postgres, MongoDB, or a NoSQL store. The relational schema, all `sqlite-*-store.ts` implementations, the seed/replay tooling, and Drizzle are retained unchanged. `better-sqlite3` remains the driver for the MVP.

### 2. Compute + Database — GCP always-free e2-micro VM

| Concern | Choice |
| ------- | ------ |
| Compute | Existing **Node/Hono** server (`@hono/node-server`), unchanged |
| Host | **GCP always-free e2-micro** VM (us-west1/central1/east1) |
| Database | `better-sqlite3` **SQLite file on a persistent disk** |
| Runtime port | **None** — no Workers, no D1, no code migration |

### 3. Audio storage — Cloudflare R2 (standalone bucket)

- Manually-produced audio files stored in **R2** via its **S3-compatible API** (AWS S3 SDK from the Node server for uploads).
- Served to testers over **public R2 URLs** (or a custom domain) with **zero egress fees**.
- The app persists only the R2 **object key** in SQLite; the browser fetches audio directly from R2. DB and bucket never talk.

### 4. Reject D1 + Workers

D1 is reachable only from inside a Worker, so adopting it forces a Workers runtime port for no MVP benefit — the co-location it would buy is dissolved by direct browser→bucket audio serving. Both are rejected.

### 5. (Optional) Cloudflare free proxy in front of the VM

The GCP VM may sit behind Cloudflare's free proxy/CDN for TLS termination, DDoS protection, and reduced GCP egress. Optional; not required for the MVP.

### Out of scope of this ADR

- **Auth**: the MVP uses real **Google OAuth (learner accounts only) + JWT** — impl (Vue SPA + Hono; the 03-01 ADR assumed `nuxt-auth-utils`, but `srs-demo` is Vue, not Nuxt) is **folded into the auth epic**, not decided here. The 03-01 three-role RBAC is out of MVP scope.
- **TTS Queues / audio generation pipeline**: out — audio is manual for the MVP.
- **CI/CD and local-dev emulation** (MinIO, Docker, Wrangler, Makefile from 03-01): unaddressed here; the local loop is already `better-sqlite3` on disk.

---

## Rationale

**Keep SQLite over Postgres/Mongo.** A relational schema and Drizzle underpin ~15 epics. Postgres would be a *bounded* port (Drizzle has a pg dialect); Mongo/NoSQL would be a *rewrite* (drop Drizzle, redesign every store as documents) for no MVP benefit. Neither is justified when SQLite already works and the MVP serves 3 testers.

**The Cloudflare-lock that once killed MongoDB is now relaxed — but SQLite still wins.** The 03-01 ADR overrode the PO's MongoDB preference specifically to "stay within Cloudflare." This ADR relaxes that constraint (mixed platform is now allowed), yet the store stays SQLite — this time on the merits of the existing relational investment, not the ecosystem constraint.

**GCP e2-micro over managed SQLite (Turso) or D1.** The always-free e2-micro is Google-branded (PO familiarity), free-forever, and requires **zero code change** — the Node server and `better-sqlite3` file run as-is. Turso would mean a driver swap and a third-party vendor; D1 would mean a Workers port and the store the PO rejected.

**R2 for audio, cross-platform.** R2 remains the most generous free object store (10 GB, zero egress) — the original reason Cloudflare was chosen. Because audio is served browser→bucket, R2 works perfectly as a standalone bucket attached to a GCP-hosted app; co-location is unnecessary.

---

## Alternatives Considered

| Option | Pros | Cons | Why not chosen |
| ------ | ---- | ---- | -------------- |
| **All-Cloudflare (Workers + D1 + R2)** | Native co-location, best bucket economics, one account | Requires Workers port + D1 (PO-rejected); front-loads cost the MVP doesn't need | D1 rejected; co-location benefit dissolved by direct bucket serving |
| **Port to Postgres (Neon/Supabase) + R2** | Real Postgres, free, Drizzle-native | Bounded but real migration; 3rd-party DB; no MVP benefit | SQLite already suffices for 3 testers |
| **Port to MongoDB (Atlas) / NoSQL (Firestore/DynamoDB)** | PO's document-model preference; Firestore/DynamoDB free first-party | Full persistence-layer rewrite; drop Drizzle; discard ~15 epics of relational work | Highest cost, least MVP value |
| **Managed SQLite (Turso/libSQL) + R2** | Managed, minimal driver swap, exercises async contract | 3rd-party brand; small code change; adds a vendor | GCP VM keeps code *and* stays on a familiar first-party platform |
| **AWS (EC2 + S3)** | Familiar; single ecosystem | S3 storage free 12 months only; not free-forever | Fails the free-forever constraint |

---

## Consequences

**Positive:**

- **Zero data-layer migration** — the entire SQLite/Drizzle stack ships unchanged.
- Free-forever on **Google-branded** compute the PO is familiar with; **R2 zero-egress** for audio.
- Avoids D1 and the Workers runtime port entirely.
- Audio serving is trivial: app stores an object key, browser fetches from a public R2 URL.

**Negative / Risks:**

- **Two accounts** (GCP + Cloudflare) instead of one ecosystem.
- **VM operations are the PO's responsibility**: OS patching, a process manager (e.g. systemd/pm2), TLS, and **DB-file backups** (copy the SQLite file on a schedule).
- **SQLite on a single VM has a hard scaling ceiling** — no horizontal scale, single point of failure, no managed HA. Acceptable for 3 testers; a known wall for the larger vision.
- **"Async theatre" persists**: `better-sqlite3` is a synchronous driver, so the async storage contract (07-06) still is not exercised against real network latency/failure. Accepted for the MVP; revisited if/when the DB moves off the VM.

**Neutral:**

- The async-storage contract keeps a later DB swap (Turso/libSQL/Postgres/D1) cheap — this decision is not a one-way door.
- R2 key naming / folder convention still to be defined (as the 03-01 ADR also deferred).

---

## Open Questions

| Question | Owner | Target |
| -------- | ----- | ------ |
| DB-file **backup cadence & restore drill** on the VM | PO/Dev | Before first tester onboard |
| ~~Content & audio volume for the 30-day window~~ **Resolved**: PO provides **≥ 10 decks + audio** | PO | ✅ 2026-07-12 |
| **Stability floor** — crash-free bar, durability, uptime expectation for 3 testers | PO | MVP scope-lock |
| R2 **object-key convention** (per-deck / per-word folder structure) | Dev | During audio epic |
| GCP VM **process/TLS setup** — bare Node + systemd vs container; Cloudflare proxy in front? | Dev | During hosting/deploy epic |
| Auth impl — **Google OAuth on Vue SPA + Hono** (03-01 assumed Nuxt) | Dev | During auth epic |

---

_Related ADRs:_

- [20260301T161844Z-infra-cloudflare-platform.md](20260301T161844Z-infra-cloudflare-platform.md) — superseded in part (platform/DB/compute)
- [20260706T125834Z-engineering-async-storage-contract.md](20260706T125834Z-engineering-async-storage-contract.md) — the forward bridge that keeps a later driver swap cheap
