# Current Focus

**Branch**: main
**Updated**: 2026-03-05

## Active Work

- **Epic**: EP01 — Monorepo Scaffolding
- **Story**: EP01-ST03 ✅ — complete, pending commit
- **Status**: ST01 ✅ ST02 ✅ ST03 ✅ — EP01 all stories done

## Last Session Outcome

EP01-ST03 — Vitest workspace + srs-engine scaffold complete.
- Created `vitest.workspace.ts`, full `packages/srs-engine/` skeleton
- `pnpm install`, `pnpm build`, `pnpm test` all exit 0
- 3 DS01 spec gaps corrected (see recent-decisions.md)
- **Next**: commit EP01-ST03, then begin EP02 — SRS engine core
- Gap: ESLint 9.x requires `jiti` to load `.ts` config — installed as root devDependency
- Config parses and resolves correctly ✅

**Next**: EP01-ST03 — Vitest workspace + `packages/srs-engine/` skeleton → `pnpm test` exits 0

### Build Sequence (Accepted)

| Stage | Feature | Key Dependency |
|---|---|---|
| 1 | SRS engine + terminal runner (in-memory, pure TS) | None — start here |
| 2 | Hono API layer (engine over HTTP, in-memory) | Stage 1 engine |
| 3 | Database persistence (local SQLite first → cloud D1 later) | Stage 2 API |
| 4 | Quiz UI (mobile-first, seed data) | Stage 3 DB |
| 5 | Auth (Google OAuth + JWT) | Stage 2 API |
| 6 | Curation engine (pure TS, parallel track) | Stage 1 monorepo |
| 7 | Gemini integration (real AI-generated decks) | Stage 6 + Stage 2 |
| 8 | Curator UI | Stage 7 |
| 9 | TTS audio system | Stage 8 |
| 10 | Admin UI | Stage 5 auth |

### Epic Lifecycle Gates (Accepted)

| Transition | Entry Criteria | Validator |
|---|---|---|
| `Accepted → In Progress` | Design spec ready, ADRs accepted, schema available (if DB epic), no upstream dependencies | Agent self-check |
| `In Progress → Impl-Complete` | All stories Done, local tests pass, changelog + CODEMAP + memory updated | Human approves |
| `Impl-Complete → BDD Pending` | PRD agent writes BDD scenarios, human confirms before QA picks up | Human confirms |
| `BDD Pending → Completed` | Agent creates PR. Human monitors CI, merges when green. | Human |

### Branching Model (Accepted)

```
main
  └── feature/EP##-slug          (epic branch)
        └── feature/EP##-ST##-slug  (story branch per story)
```

Story branch → merged to epic branch when story Done. Epic branch → merged to main via human-approved PR at Impl-Complete.

### Story Creation Sequence (Accepted)

Titles (rough list) → Design spec → Stories fully detailed → Epic Accepted → agent picks up ST##01.

### BDD Protocol (Accepted)

- PRD agent writes scenarios (product owns what). QA agent writes test implementation (owns how).
- Two-strike rule applies to QA agent building tests locally.
- CI monitoring is out of scope for agents. Agents create PR only; human monitors CI and merges.

### Unit Test Protocol (Accepted)

| Layer | TDD | Coverage | Done Gate |
|---|---|---|---|
| Engine packages | Strict TDD | High — all paths | Full package suite (B) |
| Backend routes | Pragmatic | Contract-level | Full package suite (B) |
| Frontend | Pragmatic | Happy path | Full package suite (B) |
| BDD | PRD agent scenarios + QA impl | Medium | Deferred to UI stage |

### Commit Discipline (Accepted)

- One commit per story, at end of REVIEW phase, after full package suite passes
- Implementation + tests in one commit — never split
- Format: `feat(EP##-ST##): [what]. [why in body].`
- Conventional types: `feat`, `fix`, `chore`, `docs`, `refactor`

### Story Sizing (Accepted)

- Max one layer per story. Cross-layer = must split before CODE begins.
- Split triggers: layer bleed, multiple independent ACs, >~5 files discovered in PLAN phase
- Agent proposes split inline, waits for human approval — no files created until approved
- Splitting allowed in PLAN phase only. CODE started = no splitting

### PR Template (Accepted)

```
## What
[Story ID + one-line summary]

## Why
[Acceptance criteria this closes]

## Test evidence
[Test command + pass/fail summary]

## Linked artifacts
[Story file, Design spec, ADR(s)]

## Checklist
- [ ] Full package suite passes
- [ ] CODEMAP updated
- [ ] Changelog entry written
- [ ] Memory updated
```

### Story-Level State (Accepted)

No formal story states. PLAN/CODE/TEST/REVIEW phases + full package suite pass + "ready for next story?" is sufficient.

## Remaining Gaps

| # | Gap | Status | When |
|---|---|---|---|
| GAP-01 | No API contract | ✅ Resolved | — |
| GAP-02 | No database schema | Open | Stage 3 prerequisite |
| GAP-03 | No build sequence | ✅ Resolved | — |
| GAP-04 | Curation ADR still "Proposed" | ✅ Resolved | — |
| GAP-05 | No agentic dev workflow | ✅ Resolved | — |

## Follow-Up Actions (Next Session)

1. Begin **Stage 1** implementation: monorepo scaffolding → srs-engine → terminal runner
2. Write agentic workflow decisions into WORKFLOW.md / RULES.md (the GAP-05 output artifact)

## Key File References

- Roadmap slice: `product-documentation/roadmap/20260305T142801Z-stage1-build-sequence.md`
- Gap register: `product-documentation/20260304T125757Z-mvp-readiness-gaps.md`
- SRS engine ADR: `product-documentation/architecture/20260302T160536Z-engineering-srs-engine-package.md`
- Curation engine ADR: `product-documentation/architecture/20260303T210000Z-engineering-curation-engine-package.md`
- Hono backend ADR: `product-documentation/architecture/20260303T195134Z-engineering-headless-hono-backend.md`
