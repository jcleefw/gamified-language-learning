# ADR: Infrastructure — Cloudflare Platform & Local Development

**Status:** Accepted

**Date:** 2026-03-01

**Deciders:** Solo founder

---

## Context

The gamified language learning app requires a cloud platform for hosting, data persistence, object storage, and background job processing. Key constraints established prior to this ADR:

- Cloudflare free tier is the target platform (decided)
- Monorepo with pnpm + Turborepo (decided — see [engineering-monorepo-tooling ADR](20260227T022513Z-engineering-monorepo-tooling.md))
- Frontend: Nuxt (Vue 3) with SSR (decided — see [fe-framework-toolchain ADR](20260226T133833Z-fe-framework-toolchain.md))
- Backend: Hono on Cloudflare Workers (if needed)
- Audio files generated via Gemini TTS during content curation, stored permanently
- Three user types (admin, curator, learner) with Google OAuth + email/password credentials auth
- Local development must work offline with service emulation
- Audio generation storage strategy to be defined in a separate ADR

---

## Decision

### Cloud Platform: Cloudflare Free Tier

All cloud services stay within the Cloudflare ecosystem:

| Service | Cloudflare Product | Purpose |
|---|---|---|
| Web app (SSR) | Cloudflare Pages | Nuxt SSR hosting with branch preview deployments |
| Backend API | Cloudflare Workers | Hono-based API (if/when needed) |
| Database | Cloudflare D1 | SQLite-based persistence for all app data |
| Object storage | Cloudflare R2 | Audio file storage (TTS-generated content) |
| Background jobs | Cloudflare Queues | Audio generation queue management |

### Cloudflare D1 — Data Modeling

**Single D1 database** shared across environments, scoped by environment prefix or tenant column.

**Hybrid relational + JSON approach:**

- Relational tables for core entities that require indexing and querying — users, SRS cards, review schedules, quiz results
- JSON columns for flexible/nested data — conversation metadata, per-language configuration, quiz result details
- SQLite JSON functions (`json_extract`, `json_each`) for querying into JSON columns
- Generated columns from JSON fields where indexed access is needed

This avoids the rigidity of pure relational for multilingual content while preserving queryable structure for SRS scheduling (e.g., `SELECT * FROM cards WHERE next_review_at < datetime('now')`).

**Data domains stored in D1:**

| Domain | Structure | Notes |
|---|---|---|
| User management | Relational | Roles, auth provider, `lastLoginAt`, `isActive` |
| SRS progress | Relational | Per-word mastery count, next review timestamp, mistake history |
| Audio metadata | Relational + JSON | File path (R2 key), generation status; conversation context as JSON |
| Content curation | Relational + JSON | Conversations, word breakdowns; language-specific config as JSON |
| Quiz decks | Relational | Deck type, word associations, batch assignments |
| Audio generation count | Relational | Rate tracking per curator/environment |

### Cloudflare R2 — Audio Storage

R2 free tier: 10GB storage, 10M Class B reads/month, 1M Class A writes/month.

Audio files are generated during content curation and stored permanently. Each conversation produces fewer than 8 audio sections. Detailed storage strategy (key naming, folder structure, lifecycle) will be defined in a separate audio generation ADR.

R2 is S3-compatible — existing tooling and SDKs work without modification.

### Cloudflare Queues — Audio Generation

Queues manage the asynchronous audio generation workflow:

- Curator submits a conversation for TTS generation
- Queue message triggers a Worker that calls Gemini TTS API
- Worker stores the resulting audio in R2 and updates D1 with the file path
- Failed jobs are retried with backoff

Detailed queue design (retry policy, dead letter handling, batch size) scoped to the audio generation ADR.

### Authentication

**Single auth system for all user types** using `nuxt-auth-utils` (Nuxt's official auth module):

| Method | Flow |
|---|---|
| Google OAuth | OAuth 2.0 flow → find or create user → embed role in session |
| Email/password | Credentials flow → bcrypt verification → session |

Role-based access control (RBAC) enforced in the application layer:

| Role | Access |
|---|---|
| Admin | All routes including user management |
| Curator | Content curation routes |
| Learner | Learning path routes only |

No Cloudflare Access. Keeping auth in the application layer avoids split authentication across two systems and maintains a consistent login UX for all user types. Email/password credentials are retained for simpler development and testing workflows.

### Environment Strategy

| Environment | Purpose | Config source | Deployment trigger |
|---|---|---|---|
| Local | Development | `.env.local` | Manual (`make dev`) |
| Test | Automated testing | `.env.test` | CI pipeline |
| Staging | Pre-production validation | `.env.staging` | Push to `staging` branch |
| Branch preview | PR review | `.env.staging` (inherited) | Push to any PR branch |
| Production | Live | `.env.production` | Push to `main` branch |

Branch preview deployments inherit staging configuration (Option A). No separate `.env.preview` — branch previews are staging clones.

**Environment files committed vs gitignored:**

| File | Committed? | Contains |
|---|---|---|
| `.env.example` | Yes | Variable names, port offsets, documentation |
| `.env.local` | No | Local dev secrets, `PORT_OFFSET` |
| `.env.test` | Yes | Test-specific config (no real secrets) |
| `.env.staging` | No | Staging secrets |
| `.env.production` | No | Production secrets (CI-only) |

### CI/CD — GitHub Actions

GitHub Actions handles the full pipeline. Cloudflare is the deployment target only — no Cloudflare native git integration.

| Stage | Trigger | What runs |
|---|---|---|
| Lint & type-check | Every PR | ESLint (read-only), TypeScript `tsc --noEmit` |
| Test | Every PR | Unit tests, BDD tests |
| Commitlint | Every PR | Conventional Commits validation |
| Deploy staging | Push to `staging` | `wrangler pages deploy --branch staging` |
| Deploy production | Push to `main` | `wrangler pages deploy --branch main` |
| Preview deploy | PR opened/updated | Cloudflare Pages automatic preview |
| D1 migrations | Staging/production deploy | `wrangler d1 migrations apply --env <env>` |

Secrets (Gemini API keys, OAuth credentials) stored in GitHub Actions secrets and injected at deploy time via `wrangler secret put`.

### Local Development — Docker Compose

Local dev is **Cloudflare-agnostic**. Docker Compose provides service emulation. Wrangler is a deployment tool only — not part of the local dev loop.

**Docker Compose services:**

| Service | Image | Emulates | Port |
|---|---|---|---|
| MinIO | `minio/minio` | Cloudflare R2 | 9000 (console: 9001) |
| SQLite | `kesilent/sqlite-web` or volume-mounted SQLite | Cloudflare D1 | 8080 |

SQLite runs in Docker (not Wrangler's built-in D1 emulator) for direct DB access, easier seeding, and inspection with standard SQLite tools.

**Local-to-remote data seeding:** Manual process via Makefile command (`make db-seed-remote`) that pushes local curated data to the remote D1 instance using `wrangler d1 execute`.

Cloudflare Access is bypassed entirely in local development — no edge auth emulation needed.

### Makefile — Single Command Interface

The Makefile is the single entry point for all operations — local dev, testing, deployment, and remote management. Developers never need to remember Docker Compose, pnpm, or Wrangler syntax directly.

```makefile
# Local development
make dev               # docker compose up -d && pnpm dev
make dev-down          # docker compose down
make dev-reset         # docker compose down -v && docker compose up -d

# Database
make db-migrate        # Run D1 migrations locally
make db-seed           # Seed local SQLite with test data
make db-seed-remote    # wrangler d1 execute --file seed.sql --env staging
make db-migrate-staging # wrangler d1 migrations apply --env staging
make db-migrate-prod   # wrangler d1 migrations apply --env production

# Testing
make test              # pnpm turbo run test
make test-bdd          # Start BDD services + run BDD tests
make lint              # pnpm turbo run lint

# Deployment
make deploy-staging    # wrangler pages deploy --branch staging
make deploy-prod       # wrangler pages deploy --branch main

# Secrets
make secret-set        # wrangler secret put <name> --env production
```

### Wrangler — Deployment Tool Only

Wrangler is used exclusively for remote operations:

- Deploying Pages and Workers to Cloudflare
- Running D1 migrations against staging/production
- Managing R2 buckets in remote environments
- Setting secrets in Cloudflare environments

All Wrangler commands are wrapped in Makefile targets. Wrangler is **not** part of the local development loop.

---

## Rationale

**Cloudflare free tier over AWS/GCP/Vercel:** The free tier covers all required services (Pages, Workers, D1, R2, Queues) with generous limits. R2's 10GB storage and zero egress fees are well-suited for audio file serving. Staying in one ecosystem simplifies billing, configuration, and deployment.

**D1 (SQLite) over MongoDB:** The user's preference for MongoDB was reconsidered against the constraint of staying within Cloudflare. D1 is Cloudflare-native, requires no external service, and SQLite's JSON support provides sufficient document-style flexibility for variable multilingual content. MongoDB Atlas would introduce an external dependency and network latency from Workers.

**Hybrid data modeling over pure relational or pure document:** SRS scheduling requires indexed datetime queries — pure document storage can't serve this efficiently. Multilingual content metadata varies by language — pure relational fights this with excessive nullable columns or complex joins. The hybrid approach uses each paradigm where it fits.

**Single auth system over split (Cloudflare Access + app auth):** Cloudflare Access doesn't support email/password credentials and shows a Cloudflare-branded login page. Splitting auth across two systems creates confusion and maintenance burden. `nuxt-auth-utils` handles both OAuth and credentials in one flow with a consistent branded UX.

**Docker Compose + SQLite over Wrangler D1 emulator:** The Wrangler D1 emulator works but doesn't allow direct SQLite inspection or easy seeding. A Docker-hosted SQLite gives developers standard SQLite tooling access and a consistent container-based local environment alongside MinIO.

**Makefile over raw commands:** With three underlying tools (Docker Compose, pnpm/Turborepo, Wrangler), a Makefile provides a single discoverable interface. `make dev` is easier to remember and document than the underlying multi-step commands.

**GitHub Actions over Cloudflare native git integration:** The engineering ADR already establishes commitlint and ESLint on CI. GitHub Actions provides a single pipeline for lint, test, and deploy — Cloudflare's native integration only handles deployment, requiring a second CI system for quality gates.

---

## Alternatives Considered

| Option | Pros | Cons | Why Not Chosen |
|---|---|---|---|
| MongoDB Atlas (free tier) | Document model, familiar query syntax | External to Cloudflare, network latency from Workers, 512MB limit | Breaks "stay in Cloudflare" constraint |
| Cloudflare Access for admin auth | Zero-trust edge auth, no app code needed | No credentials auth support, Cloudflare-branded UX, splits auth into two systems | Creates split auth confusion |
| Wrangler D1 emulator for local dev | Closer Cloudflare parity, no Docker needed | No direct SQLite access, harder to seed and inspect | Docker SQLite is more developer-friendly |
| Vercel for hosting + Cloudflare for storage | Vercel has better Nuxt/SSR DX | Splits infrastructure across two platforms, complicates deployment | Single ecosystem preference |
| Separate D1 databases per environment | Full isolation | Unnecessary complexity at this scale; environment scoping in a single DB is sufficient | Free tier allows it, but adds management overhead |
| `.env.preview` for branch deployments | Per-branch config flexibility | No current need for different config between staging and previews | Staging config is sufficient |

---

## Consequences

**Positive:**

- All cloud services under one Cloudflare account — single billing, single CLI (Wrangler), single dashboard
- R2 zero egress fees — audio file serving cost is storage-only
- Local dev is fully offline-capable (Docker Compose + SQLite + MinIO)
- Makefile provides a discoverable, self-documenting command interface
- Branch preview deployments come free with Cloudflare Pages
- Single auth system — one login flow to build, test, and maintain

**Negative / Risks:**

- D1 is still in open beta — API surface may change, performance characteristics not yet battle-tested at scale
- SQLite in Docker diverges from D1's actual runtime behavior in edge cases (D1 has specific transaction and replication semantics)
- Cloudflare Queues free tier has limits (100K messages/day) — may constrain high-volume audio generation
- Single D1 database with environment scoping requires disciplined query patterns to avoid cross-environment data leaks

**Neutral:**

- Audio storage strategy (R2 key naming, folder structure) deferred to a separate ADR
- Queue design (retry policy, dead letter, batch size) deferred to audio generation ADR
- Backend (Hono on Workers) remains optional — may not be needed if Nuxt server routes suffice

---

## Open Questions

| Question | Owner | Target |
|---|---|---|
| D1 environment scoping strategy — column-based prefix or separate tables? | Architect | Before first D1 migration |
| Cloudflare Queues free tier limits vs expected audio generation volume | Architect | During audio generation ADR |
| SQLite-to-D1 migration testing — how to validate local SQLite schema works on D1? | Dev | Before first staging deploy |
| `nuxt-auth-utils` vs `sidebase/nuxt-auth` — which module best fits the dual auth flow? | Dev | Before auth implementation |
| R2 bucket naming convention (one bucket per env or one bucket with prefixed keys?) | Architect | During audio storage ADR |

---

*Related ADRs:*

- [20260227T022513Z-engineering-monorepo-tooling.md](20260227T022513Z-engineering-monorepo-tooling.md)
- [20260227T000000Z-fe-pwa-platform-strategy.md](20260227T000000Z-fe-pwa-platform-strategy.md)
- [20260226T133833Z-fe-framework-toolchain.md](20260226T133833Z-fe-framework-toolchain.md)
