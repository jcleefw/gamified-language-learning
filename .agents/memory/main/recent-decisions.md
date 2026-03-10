# Recent Decisions

**Branch**: main
**Updated**: 20260311T000000Z
**Rolling window**: Keep last 3 days only. Older decisions archived to `decisions-archive.md`.

## Decision Index (1-liner each)

| Date  | Decision                                                                                                                          | Related                                       |
| ----- | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| 03-11 | Stage 1 complete — all 10 epics (EP01–EP10) delivered and merged                                                                  | Stage 1 delivery report                       |
| 03-11 | Stage 2 backend location: `apps/server` (not `apps/api` or `packages/backend`)                                                    | Stage 2 roadmap                               |
| 03-11 | All packages use `@gll/` scope — GAP-01 ADR reference to `@repo/api-contract` superseded by `@gll/api-contract`                   | Stage 2 roadmap                               |
| 03-11 | Deck ID: random hash generated at seed time, fixed for process lifetime, printed to console on startup                            | EP13 design                                   |
| 03-11 | Batch ID: server-generated `crypto.randomUUID()` — server is authority on what was asked                                          | EP13 design                                   |
| 03-11 | `targetText` source: in-memory `Map<wordId, wordDetail>` seeded from mappers at startup                                           | EP13 design                                   |
| 03-11 | `options[]` (MC distractors): omitted in Stage 2 — field is optional in ADR; known limitation                                     | EP13 design                                   |
| 03-11 | `wrangler.toml`: minimal config added in EP12 scaffold; not wired into local dev loop (`tsx` runs locally)                        | EP12 design                                   |
| 03-10 | Remove worktree list at start of each AGENT operation                                                                             | AGENT.md                                      |
| 03-09 | All exported and non-trivial private functions require a docstring — plain English, max 80 chars/line                             | code-review SKILL                             |
| 03-07 | EP05: `batchesSinceLastProgress` is caller-managed — not set by `updateMastery`; calling layer increments/resets after each batch | EP05-ST02                                     |
| 03-07 | EP05: Active window marker = `srsM2_review` phase; no extra `isActive` flag on `WordState`                                        | EP05-ST01                                     |
| 03-07 | EP04: `composeBatch` always returns deterministic priority order; shuffling for display is caller's responsibility                | EP04-DS01                                     |
| 03-06 | Parallel epics via git worktrees — one worktree per epic, one Claude session per worktree                                         | EP04/05/06 parallel dev                       |
| 03-06 | Worktree agents: STOP at `gh pr create` — FORBIDDEN to checkout main, merge, or gh pr merge                                       | WORKTREE.md                                   |
| 03-06 | Memory for feature branch agents goes to `.agents/memory/feature/{branch}/` NOT `main/`                                           | WORKTREE.md                                   |
| 03-06 | No story-level branches in worktrees — all stories commit to single epic feature branch                                           | code-change-workflow                          |
| 03-06 | EP02-ST05: FSRS interval growth requires backdating `lastReview` by `scheduledDays` — elapsed time must be simulated in tests     | EP02-ST05                                     |
| 03-06 | EP02-ST04: `enable_short_term: false` required in ts-fsrs — default schedules in minutes not days                                 | EP02-ST04                                     |
| 03-06 | EP02: Unit tests co-located in `src/**/__tests__/`; integration tests at `__tests__/integration/`                                 | EP02 review                                   |
| 03-05 | GAP-01: API surface ADR accepted — flat namespace, wrapped envelope, Bearer JWT, api-contract package                             | `20260305T200000Z-engineering-api-surface.md` |
| 03-05 | GAP-05 resolved: full agentic dev workflow defined (branching, TDD, commit discipline, PR template)                               | GAP-05 discussion                             |
| 03-05 | Stage 1 = terminal proof (no infra, no HTTP, no DB)                                                                               | roadmap slice                                 |
| 03-05 | Hono before DB — prove API layer with in-memory state first                                                                       | roadmap slice                                 |
| 03-05 | DB persistence tech-agnostic: local SQLite first, D1 is deployment                                                                | roadmap slice                                 |
| 03-04 | Memory pointer, D1 batch, mid-quiz, ANKI params, word pool decisions                                                              | archived → decisions-archive.md               |

## Recent Details (last 3 days only)

### 2026-03-11: Stage 1 Complete — Stage 2 Planning

**Stage 1 verdict**: All 10 epics delivered. Delivery report: `.agents/changelogs/roadmap/20260311T000000Z-stage1-delivery-report.md`.

**Stage 2 roadmap**: `product-documentation/roadmap/20260311T000000Z-stage2-build-sequence.md`

**Key type mappings** (load-bearing — engine → wire format, must be handled in EP13):

- `QuestionType 'mc'` → `'multiple_choice'`; `'wordBlock'` → `'word_block'`
- `MasteryPhase 'srsM2_review'` → `'anki_review'`
- `QuizAnswer.isCorrect` → `QuizAnswer.correct`

**Blocking prerequisite for EP11**: EP08 must be merged to `main` first (EP13 imports data mappers from `@gll/srs-engine`).

---

## Rotation Policy

- Keep only decisions from the last 3 days in "Recent Details"
- Decision Index keeps 1-liner summaries indefinitely (trim when > 20 rows)
- When trimming: move full details to `decisions-archive.md`
