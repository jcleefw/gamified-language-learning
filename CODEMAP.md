# CODEMAP.md

Project navigation index. Use this to orient before reading files.

**Update this file whenever**: files are added, renamed, moved, or their purpose changes.

---

## Root Directory

| File | Purpose |
|------|---------|
| `AGENT.md` | AI agent persona, tech stack, bootstrap reading order |
| `RULES.md` | Mandatory behaviors, code standards, testing protocol |
| `WORKFLOW.md` | Work item naming, hierarchy, lifecycle |
| `PLAYBOOK.md` | Quick command reference |
| `CONTEXT.md` | Architecture, domain model, key patterns |
| `SETUP.md` | Development environment setup |
| `CODEMAP.md` | This file — navigation index |
| `README.md` | Project overview for humans |
| `THOUGHTS.md` | Freeform product notes |
| `claude-code-playbook.md` | Claude Code-specific workflow reference |

---

## `.agents/` — AI Governance

| Path | Purpose |
|------|---------|
| `.agents/workflows/` | How to do things (create epic, create changelog, etc.) |
| `.agents/skills/` | Specialized AI personas (architect, dev, product, BA, QA) |
| `.agents/plans/` | Epic plans, RFCs, ADRs (permanent home) |
| `.agents/plans/templates/` | Reusable document templates for all work item types |
| `.agents/changelogs/` | Implementation records (created during development) |
| `.agents/memory/` | Cross-session context; one folder per branch |
| `.agents/memory/main/` | Memory for main branch |
| `.agents/tools/` | Executable scripts |
| `.agents/tools/memory-consolidate.sh` | Consolidate branch memory into main on merge |
| `.agents/guardrails.yml` | Platform-agnostic safety checks |
| `.agents/integrations.yml` | External tool integrations (MCP servers, APIs) |

### Skills by Category

| Category | Skills |
|----------|--------|
| `architect/` | fe-design, fe-review, be-design, be-review, infra-design, infra-review, qa-design, qa-review, engineering-design, engineering-review, cost-analysis |
| `dev/` | code-review, debug-investigation, refactor, security-review, explain-code, fix-review, tdd-plan, tdd-implement |
| `ba/` | requirements-spec, use-case, data-dictionary, gap-analysis, process-map, stakeholder-interview-guide, requirements-synthesis, requirements-traceability, api-cost-model, saving-session-state |
| `product/` | user-story, release-notes, user-research-synthesis, competitive-analysis-research, competitive-analysis-writeup, prioritize, roadmap-slice, metrics-definition, ideate, prd |
| `agentic/` | create-skill |

### Workflows

| Workflow | Purpose |
|----------|---------|
| `create-epic.md` | Plan a new feature initiative |
| `create-design-spec.md` | Technical blueprint |
| `create-changelog.md` | Document completed work |
| `create-bug.md` | Bug report |
| `create-rfc.md` | Architectural proposal |
| `create-ux-spec.md` | UX/interaction design |
| `create-test-plan.md` | Test strategy |
| `create-sprint-summary.md` | Sprint summary |
| `create-code-map.md` | Generate/update CODEMAP |
| `code-change-workflow.md` | Standard dev workflow |
| `discover-and-plan.md` | Explore and plan work |
| `review-and-fix.md` | Review and correct issues |
| `refactor.md` | Structured refactoring |
| `onboard.md` | Onboard to a codebase area |
| `context-refresh.md` | Refresh agent context |
| `retrospective.md` | Project retrospective |
| `prototype.md` | Prototype a feature |

---

## `product-documentation/` — Product Artifacts

| Path | Purpose |
|------|---------|
| `PRODUCT-BRIEF.md` | Full product vision, system overview, tech stack |
| `prds/` | Product requirement documents |
| `architecture/` | Architecture decision records (ADRs) |
| `cost-models/` | Cost analysis documents |

### PRDs

| File | Feature |
|------|---------|
| `20260226T150000Z-user-management-auth.md` | Auth, roles, sessions |
| `20260226T140000Z-content-curation.md` | Curator workflow, AI generation |
| `20260226T100000Z-srs-learning-path.md` | Quiz, mastery, ANKI algorithm |
| `20260302T000000Z-gemini-tts-generation.md` | Audio pipeline, quota management |

### Architecture Decisions

| File | Decision |
|------|---------|
| `20260226T133833Z-fe-framework-toolchain.md` | Vue 3 + Nuxt + PandaCSS |
| `20260227T000000Z-fe-pwa-platform-strategy.md` | PWA delivery strategy |
| `20260227T022513Z-engineering-monorepo-tooling.md` | Monorepo tooling |
| `20260301T161844Z-infra-cloudflare-platform.md` | Cloudflare Workers + D1 + R2 |
| `20260302T160536Z-engineering-srs-engine-package.md` | SRS engine as separate package |

---

## `sessions/` — Session State

| File | Purpose |
|------|---------|
| `20260226T133833Z-fe-framework-toolchain.md` | FE framework selection session |
| `20260227T000000Z-fe-platform-vue-pwa.md` | Vue + PWA platform session |

---

## `src/` — Application Source (TBD)

> Source directory not yet created. Structure will be established when implementation begins.

### Expected Structure

```
src/
├── server/
│   ├── api/                    # API routes (Nitro / Cloudflare Workers)
│   │   ├── auth/               # Login, OAuth, session handlers
│   │   ├── conversations/      # Content curation API endpoints
│   │   ├── quiz/               # Quiz batch assembly, answer submission
│   │   ├── tts/                # TTS generation request handlers
│   │   └── users/              # User management (admin)
│   ├── db/
│   │   ├── schema.ts           # D1 table definitions ⚠️ sensitive
│   │   └── migrations/         # Schema migrations ⚠️ sensitive
│   └── services/
│       ├── ttsService.ts       # Rate-limited TTS generation
│       ├── srsService.ts       # ANKI algorithm, mastery tracking
│       ├── quizBatchService.ts # Batch composition, active window
│       └── geminiService.ts    # Gemini API client (conv + breakdown)
│
├── components/
│   ├── quiz/                   # QuizBatch, QuizQuestion, MultipleChoice, WordBlock
│   ├── curation/               # ConversationEditor, WordBreakdown, PublishControls
│   ├── auth/                   # LoginForm, OAuthButton
│   └── ui/                     # Shared UI (buttons, cards, inputs — from Ark UI)
│
├── composables/
│   ├── useQuizBatch.ts         # Quiz batch state + answer submission
│   ├── useWordMastery.ts       # Mastery tracking, phase transitions
│   ├── useActiveWindow.ts      # 8-word active window management
│   ├── useTTSAudio.ts          # Audio playback, status polling
│   └── useAuth.ts              # Session state, role checks
│
├── pages/
│   ├── index.vue               # Dashboard / deck list
│   ├── quiz/[deckId].vue       # Quiz session
│   ├── curation/               # Curator interface
│   └── admin/                  # Admin user management
│
└── assets/
    ├── tokens/                 # PandaCSS design tokens
    └── styles/                 # Global styles
```

---

## Update Instructions

**When adding files**: Add to this map under the correct section.
**When removing files**: Remove the entry from this map.
**When renaming**: Update both the path and description.
**When restructuring**: Update the entire relevant section.

Do NOT let CODEMAP.md drift from actual project structure.
