# SETUP.md

Development environment setup for the Gamified Language Learning Platform.

---

## Quick Start

```bash
pnpm install
pnpm dev
```

Visit: `http://localhost:3000`

---

## Prerequisites

| Tool         | Version | Notes                                               |
| ------------ | ------- | --------------------------------------------------- |
| Node.js      | ≥ 20.x  | LTS recommended                                     |
| pnpm         | ≥ 9.x   | `npm install -g pnpm`                               |
| Wrangler CLI | ≥ 3.x   | `pnpm add -g wrangler` — Cloudflare Workers tooling |

---

## Environment Variables

Create `.env` in the project root (⚠️ never commit this):

```bash
# Auth
NUXT_SESSION_SECRET=          # 32+ char random string for JWT signing

# Google OAuth
NUXT_OAUTH_GOOGLE_CLIENT_ID=
NUXT_OAUTH_GOOGLE_CLIENT_SECRET=

# Gemini API
GEMINI_API_KEY=

# Cloudflare (for local dev via wrangler)
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_API_TOKEN=

# TTS Rate Limits (defaults match Gemini free tier)
TTS_RPD=10                    # Requests per day
TTS_RPM=3                     # Requests per minute
```

---

## Local Development

### Frontend (Nuxt)

```bash
pnpm dev           # Start Nuxt dev server (hot reload)
pnpm build         # Production build
pnpm preview       # Preview production build locally
```

### Cloudflare Workers (Local)

```bash
pnpm wrangler dev  # Run Workers locally with D1 + R2 simulation
```

### Database (D1)

```bash
# Apply migrations locally
pnpm wrangler d1 migrations apply --local

# Apply migrations to remote (production)
pnpm wrangler d1 migrations apply --remote

# Open D1 shell (local)
pnpm wrangler d1 execute --local --command "SELECT * FROM users LIMIT 10"
```

---

## Project Structure

```
gamified-language-learning/
├── AGENT.md                    # AI agent persona
├── RULES.md                    # Coding rules and constraints
├── WORKFLOW.md                 # Work item definitions
├── PLAYBOOK.md                 # Quick command reference
├── CONTEXT.md                  # Architecture and patterns (this file's sibling)
├── SETUP.md                    # This file
├── CODEMAP.md                  # Project navigation index
├── README.md                   # Project overview
│
├── src/                        # Application source (TBD)
│   ├── server/                 # Cloudflare Workers / Nitro server
│   │   ├── api/                # API route handlers
│   │   ├── db/                 # D1 schema, migrations, queries
│   │   └── services/           # Business logic (TTSService, SRSService, etc.)
│   ├── components/             # Vue SFC components
│   ├── composables/            # Vue composables (useQuizBatch, useWordMastery, etc.)
│   ├── pages/                  # Nuxt pages (file-based routing)
│   ├── layouts/                # Nuxt layouts
│   └── assets/                 # Static assets, PandaCSS tokens
│
├── product-documentation/      # PRDs, architecture decisions, cost models
│   ├── PRODUCT-BRIEF.md
│   ├── prds/                   # Product requirement documents
│   ├── architecture/           # ADRs
│   └── cost-models/            # Cost analysis documents
│
├── sessions/                   # Session state files (AI session saves)
│
└── .agents/                    # AI governance
    ├── workflows/              # How to do things
    ├── skills/                 # Specialized AI personas
    ├── plans/                  # Epics, RFCs, ADRs (plans/rfcs/, plans/adrs/)
    │   └── templates/          # Work item templates
    ├── changelogs/             # Implementation records
    ├── memory/                 # Cross-session context
    ├── tools/                  # Executable scripts
    └── guardrails.yml          # Safety checks
```

---

## Deployment

### Cloudflare Pages (Frontend)

```bash
pnpm build
# Cloudflare Pages automatically deploys on push to main
```

### Cloudflare Workers (Backend)

```bash
pnpm wrangler deploy
```

### D1 Migrations (Production)

```bash
pnpm wrangler d1 migrations apply --remote
```

---

## Related Documentation

| File                         | Purpose                   |
| ---------------------------- | ------------------------- |
| [README.md](./README.md)     | Project overview          |
| [AGENT.md](./AGENT.md)       | AI persona                |
| [RULES.md](./RULES.md)       | Coding rules              |
| [CONTEXT.md](./CONTEXT.md)   | Architecture and patterns |
| [WORKFLOW.md](./WORKFLOW.md) | Work item organization    |
| [PLAYBOOK.md](./PLAYBOOK.md) | Agent command reference   |
| [CODEMAP.md](./CODEMAP.md)   | Project navigation        |
