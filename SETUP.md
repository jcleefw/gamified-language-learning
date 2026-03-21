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
