# SETUP.md

Development environment setup for the Gamified Language Learning Platform.

---

## Quick Start

```bash
pnpm install
pnpm dev:all
```

`dev:all` starts Docker Compose, the `@gll/server` backend, and the `@gll/srs-demo` frontend together — check the terminal output for the URL and port each one is listening on.

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
├── AGENTS.md                    # AI agent persona
├── RULES.md                    # Coding rules and constraints
├── WORKFLOW.md                 # Work item definitions
├── PLAYBOOK.md                 # Quick command reference
├── CONTEXT.md                  # Architecture and patterns (this file's sibling)
├── SETUP.md                    # This file
├── CODEMAP.md                  # Project navigation index
├── README.md                   # Project overview
│
├── apps/                        # Deployable applications (pnpm workspace)
│   ├── srs-demo/                # Vue 3 + Nuxt frontend
│   ├── server/                  # Headless Hono backend
│   └── cli-demo-db/             # CLI demo against persistent storage
│
├── packages/                    # Internal packages (pnpm workspace)
│   ├── srs-engine/               # SRS scheduling engine
│   ├── curation/                 # Curation engine
│   ├── graph-rag/                # Graph-RAG read model (in progress)
│   ├── api-contract/             # Shared HTTP wire-format types
│   ├── db/                        # Persistent storage layer
│   ├── logger/                    # Shared logging utility
│   └── shared-utils/              # Shared utilities
│
├── docs/                        # Human + agent reference (not mandatory reading)
│   ├── code-standards-examples.md
│   └── historical-archive.md
│
├── product-documentation/      # PRDs, architecture decisions, cost models
│   ├── PRODUCT-BRIEF.md
│   ├── prds/                   # Product requirement documents
│   ├── architecture/           # ADRs
│   └── cost-models/            # Cost analysis documents
│
└── .agents/                    # AI governance
    ├── skills/                 # Specialized AI personas (architect/ba/dev/product/historical/workflows/)
    ├── plans/                  # Epics, RFCs, ADRs (plans/rfcs/, plans/adrs/)
    │   └── templates/          # Work item templates
    ├── changelogs/             # Implementation records
    │   ├── EP##--slug/          # Per-epic story/DS/UX/TP records (deleted once archived)
    │   ├── agentic/             # AGN## agentic/governance work records
    │   ├── standalone/          # Standalone TA/BUG/CH not attached to an epic
    │   ├── _loose/              # Transient staging for post-freeze fixes (empty at rest)
    │   ├── roadmap/             # Pre-AGN05 stage-level reports (legacy, inactive)
    │   └── archive/             # Permanent record of archived work
    │       ├── index.json       # Flat story records + per-epic rollup
    │       └── schema.json      # Shape of index.json
    ├── memory/                 # Cross-session context
    ├── reference/              # Reference data for tools/skills (ryoiki maps, etc.)
    ├── reports/                # One-off audits and reports
    ├── tools/                  # Executable scripts
    └── guardrails.yml          # Safety checks
```

---

## Related Documentation

| File                         | Purpose                   |
| ---------------------------- | ------------------------- |
| [README.md](./README.md)     | Project overview          |
| [AGENTS.md](./AGENTS.md)       | AI persona                |
| [RULES.md](./RULES.md)       | Coding rules              |
| [CONTEXT.md](./CONTEXT.md)   | Architecture and patterns |
| [WORKFLOW.md](./WORKFLOW.md) | Work item organization    |
| [PLAYBOOK.md](./PLAYBOOK.md) | Agent command reference   |
| [CODEMAP.md](./CODEMAP.md)   | Project navigation        |
