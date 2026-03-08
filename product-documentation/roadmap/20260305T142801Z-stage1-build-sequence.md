# Roadmap Snapshot — MVP Build Sequence

**Date:** 2026-03-05
**Context:** GAP-03 resolution. Solo developer + AI agents. MVP build sequence for gamified language learning platform.
**Planning horizon:** Now = 1 week (4 working days). Next = following weeks. Later = post-MVP.

---

## Now — Stage 1: Engine + Terminal Proof (Week 1)

| Item | Owner | Why now |
|---|---|---|
| Monorepo scaffolding (pnpm workspaces + Turborepo + tsconfig) | Dev | Foundation — everything depends on this |
| `packages/srs-engine` implementation | Dev | Core learning loop — the brain of the app. Pure TS, no I/O, no blockers |
| Terminal quiz runner script (`scripts/quiz-runner.ts`) | Dev | End-to-end proof that the engine works: compose batch → answer → mastery update → repeat |
| Seed data: 1 fake deck (~15–20 words) | Dev | Runner needs words to exercise |
| GAP-05: Agentic dev workflow (commit discipline, test protocol, stage transitions) | Dev | Defines how all subsequent work is done. Must be in place before Stage 2 |

**Added feature:** SRS engine works end-to-end in a terminal.

### Stage 1 Definition of Done

- `pnpm test` runs srs-engine unit + integration tests (all green)
- `pnpm run quiz` (or `tsx scripts/quiz-runner.ts`) plays a full quiz session in terminal:
  - Composes a 15-question batch from seed data
  - Accepts answers (hardcoded or stdin)
  - Processes answers → prints updated mastery states
  - Demonstrates carry-over, stuck word shelving, phase transition (Learning → ANKI)
- All data in-memory (no database, no network, no infra)
- Agentic dev workflow documented and applied to Stage 1 work

### What Stage 1 Proves

- SRS engine correctly implements: mastery counting, batch composition, active window, stuck words, foundational deck mechanics, ANKI scheduling
- The engine API is ergonomic for the calling layer
- The seed data shape informs the future database schema (organic discovery, not upfront design)

---

## Next — Stage 2: API Layer (Week 2)

| Item | Why next | Dependencies |
|---|---|---|
| GAP-01: API contract ADR (routes, request/response, error envelope) | Can't build routes without it | Stage 1 complete (engine API proven) |
| Hono backend routes (quiz batch + answer processing) | Engine accessible over HTTP | GAP-01 resolved |

**Added feature:** Engine accessible over HTTP (Postman/curl testable). In-memory state — no DB yet.

### Stage 2 Definition of Done

- `POST /quiz/batch` returns 15 questions via Postman
- `POST /quiz/answers` processes answers and returns updated mastery
- Hardcoded user, in-memory state (no persistence, no auth)

---

## Next — Stage 3: Database Persistence (Week 3)

| Item | Why next | Dependencies |
|---|---|---|
| GAP-02: Database schema ADR (tables, columns, indexes — tech-agnostic) | Can't persist without it. Informed by Stage 1 seed data shapes | Stage 1 complete |
| Local SQLite implementation + migrations | First persistence layer — runs locally, no cloud dependency | GAP-02 resolved |
| Data access layer (read/write word states) | Thin mapping between engine types and DB rows | Schema defined |

**Added feature:** Data persists across sessions. Local SQLite first — cloud D1 migration is a deployment concern, not a feature stage.

### Stage 3 Definition of Done

- Hono API reads/writes word states from local SQLite
- Mastery progress survives process restart
- Schema migrations run cleanly
- D1 migration path documented but not required yet

---

## Next — Stage 4: Quiz UI (Week 4)

| Item | Why next | Dependencies |
|---|---|---|
| Quiz screen (Vue 3 + Nuxt — mobile-first) | First visual interface for the learning loop | Hono API (Stage 2) + DB (Stage 3) |
| Learner dashboard (deck list, progress) | Entry point to quiz | Quiz screen |

**Added feature:** A learner can play a quiz on a phone screen (seed data).

### Stage 4 Definition of Done

- Quiz renders on 375px-wide viewport, touch-friendly
- Multiple choice questions display, accept taps, show feedback
- Mastery progress visible after batch completion
- Still hardcoded user, seed data (no auth, no curation yet)

---

## Next — Stage 5: Auth (Week 5)

| Item | Why next | Dependencies |
|---|---|---|
| Google OAuth + JWT sessions | Real users need identity | Hono backend (Stage 2) |
| Role-based access (learner/curator/admin) | Gates curator and admin features | Auth |

**Added feature:** Real users can sign in and own their progress.

### Stage 5 Definition of Done

- Google OAuth one-click sign-in creates a learner account
- JWT sessions persist across page reloads (7-day expiry)
- Quiz progress tied to authenticated user

---

## Next — Stage 6: Curation Engine (parallel track — can start alongside Stage 2+)

| Item | Why next | Dependencies |
|---|---|---|
| GAP-04: Accept curation engine ADR | Quick — flip status | None |
| `packages/curation-engine` implementation | Second engine package — same pure TS pattern | Monorepo scaffolding (Stage 1) |

**Added feature:** Prompt-builder + response-parser for AI content generation.

### Stage 6 Definition of Done

- Curation engine passes unit + integration tests
- Prompt construction and response parsing work with mock Gemini output
- No infra dependency — can run in parallel with any stage after Stage 1

---

## Next — Stage 7: Gemini Integration (after Stage 6)

| Item | Why next | Dependencies |
|---|---|---|
| Gemini API calling layer (send prompts, receive responses) | Connects curation engine to real AI | Curation engine (Stage 6), Hono backend (Stage 2) |
| Deck creation via API (Postman/curl) | Real AI-generated decks without UI | Gemini integration |

**Added feature:** Real conversation decks created via AI (API-only, no UI yet).

### Stage 7 Definition of Done

- `POST /curation/conversation` generates a real conversation via Gemini
- `POST /curation/breakdown` generates word breakdowns
- Decks persist to database and appear in quiz

---

## Later — Stage 8: Curator UI

| Item | Signal to move it forward |
|---|---|
| Curator UI (conversation creation, breakdown, publishing) | Gemini integration working (Stage 7) — curators need a visual workflow |

**Added feature:** A curator can create and publish decks through a UI.

---

## Later — Stage 9: TTS Audio System

| Item | Signal to move it forward |
|---|---|
| Gemini TTS + R2 storage + Cloudflare Queue | Curation workflow complete (Stage 8) |
| Audio question type in quiz | TTS system operational |

**Added feature:** Words have audio. Audio recognition questions appear in quiz.

---

## Later — Stage 10: Admin

| Item | Signal to move it forward |
|---|---|
| Admin UI (user CRUD, role assignment, deactivation) | Multiple users onboarding (Gate 1 prep) |

**Added feature:** Admin can manage users and roles.

---

## Parked / Not on Roadmap

| Item | Reason |
|---|---|
| Offline mode | Out of scope v1 |
| User-created custom decks | Out of scope v1 |
| Social features (leaderboards, sharing) | Out of scope v1 |
| Batch TTS generation | Out of scope v1 |
| Fallback TTS providers | Out of scope v1 |
| Onboarding flow / placement tests | Out of scope v1 |

---

## Key Dependencies

```
Stage 1: Monorepo scaffold → srs-engine → terminal runner
Stage 2: Stage 1 engine API → GAP-01 API contract → Hono routes (in-memory)
Stage 3: Stage 1 data shapes → GAP-02 schema ADR → local SQLite → data layer behind Hono
Stage 4: Stage 2 API + Stage 3 DB → Quiz UI (seed data)
Stage 5: Stage 2 API → Auth → tie progress to user
Stage 6: Stage 1 monorepo → curation-engine (parallel with 2–5)
Stage 7: Stage 6 curation-engine + Stage 2 Hono → Gemini integration (real decks)
Stage 8: Stage 7 Gemini → Curator UI
Stage 9: Stage 8 curation → TTS + audio questions
Stage 10: Stage 5 auth → Admin UI
```

---

## Open Questions

| Question | Owner | Impact |
|---|---|---|
| Should the terminal runner use stdin for answers or hardcoded scenarios? | Dev | Low — stdin is more fun, hardcoded is faster to script |
| Does `ts-fsrs` support the 3-lapse fallback rule natively? | Dev | Discovered during Stage 1 implementation |
| Package scope — `@projectname/srs-engine` or unscoped? | Dev | Decide before `package.json` creation (Stage 1, Day 1) |
| When to migrate local SQLite → cloud D1? | Dev | Deployment concern — not a feature stage. Likely before Gate 1 |

---

## Epic List (Stage 1 — Now)

| # | Epic | Scope | Estimated Effort |
|---|---|---|---|
| E-01 | Monorepo scaffolding | pnpm workspaces, Turborepo, root tsconfig, ESLint flat config, Vitest setup | 0.5 day |
| E-02 | SRS engine: mastery + phase transitions | `mastery.ts` — counting, thresholds, Learning → ANKI, lapse reset | 0.5 day |
| E-03 | SRS engine: ANKI scheduling | `scheduling/` — ts-fsrs adapter, SpacedRepetitionScheduler interface | 0.5 day |
| E-04 | SRS engine: batch composition | `batch.ts` — priority ordering, question type distribution, audio redistribution | 0.5 day |
| E-05 | SRS engine: active window + stuck words | `active-window.ts`, `stuck-words.ts` — 8-word limit, shelving, carry-over | 0.5 day |
| E-06 | SRS engine: foundational deck | `foundational.ts` — 3-active, continuous wrong rule, allocation shift | 0.25 day |
| E-07 | SRS engine: answer processing + SrsEngine class | `srs-engine.ts` — orchestrator class, `processAnswers`, config validation | 0.25 day |
| E-08 | Terminal quiz runner + seed data | `scripts/quiz-runner.ts` — end-to-end proof in terminal | 0.5 day |
| E-09 | Agentic dev workflow (GAP-05) | Commit discipline, test protocol, stage transitions — doc or skill | 0.5 day |
| EP10 | GitHub Actions CI — test + lint | `.github/workflows/ci.yml` — runs `pnpm test`, `pnpm lint`, `tsc --noEmit` on every PR push | 0.25 day |

**Total: ~4.25 days** (fits 1-week window at 4 days/week)

---

*Resolves: GAP-03 (Build Sequence / Stage 1 Vertical Slice)*
*Related: [MVP Readiness Gaps](../20260304T125757Z-mvp-readiness-gaps.md)*
