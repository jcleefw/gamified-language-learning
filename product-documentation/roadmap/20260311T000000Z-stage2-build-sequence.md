# Roadmap Snapshot — Stage 2: API Layer

**Date:** 2026-03-11
**Context:** Stage 1 complete. All engine epics (EP01–EP10) merged and green. Stage 2 exposes the SRS engine over HTTP using Hono with in-memory state — no database, no auth.
**Planning horizon:** Now = Stage 2 (API Layer). Next = Stage 3 (Database Persistence).
**Predecessor:** [Stage 1 Build Sequence](./20260305T142801Z-stage1-build-sequence.md)

---

## Decisions Locked

| Decision                     | Value                                                      | Rationale                                                     |
| ---------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------- |
| Backend app location         | `apps/server`                                              | Deployed app, not a shared lib — `apps/` namespace is correct |
| Package scope                | `@gll/` for all packages                                   | Consistent with `@gll/srs-engine` established in Stage 1      |
| Shared types package         | `@gll/api-contract`                                        | GAP-01 ADR updated to `@gll/` scope                           |
| Hardcoded deck ID            | Random hash string (server-generated at seed time)         | No fixed magic string; generated once on process start        |
| Batch ID strategy            | Server-generated `crypto.randomUUID()`                     | Server is authority on what was asked; prevents client replay |
| ANKI scheduling routes       | `/api/srs/batch` + `/api/srs/answers`                      | GAP-01 ADR paths (take precedence over roadmap shorthand)     |
| Hono version                 | Hono 4 (latest stable) + `@hono/node-server` for local dev | Cloudflare Workers first-class; `tsx` for local runner        |
| `targetText` source          | In-memory `Map<wordId, wordDetail>` seeded from mappers    | Stage 2 shortcut; Stage 3+ DB provides content                |
| `options[]` (MC distractors) | Omitted in Stage 2 (field is optional in ADR)              | Engine does not generate distractors; known limitation        |
| `wrangler.toml`              | Minimal config added in EP12 scaffold                      | Avoids rework; not wired into local dev loop                  |

---

## Now — Stage 2: API Layer

| Epic                                | Scope                                                                                                                                                                                   | Owner | Effort   |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | -------- |
| EP11 — `@gll/api-contract` package  | Types-only shared package: `ApiResponse<T>`, `ApiError`, `ErrorCode`, SRS wire types (`GetBatchRequest`, `BatchPayload`, `QuizQuestion`, `SubmitAnswersRequest`, `AnswerResultPayload`) | Dev   | 0.25 day |
| EP12 — Hono server scaffold         | `apps/server`: package setup, health route, middleware stack (CORS, error handler, auth passthrough), minimal `wrangler.toml`                                                           | Dev   | 0.5 day  |
| EP13 — SRS routes + in-memory state | `POST /api/srs/batch` + `POST /api/srs/answers`, in-memory word state store seeded from srs-engine mappers, batch registry, engine singleton                                            | Dev   | 1 day    |
| EP14 — CI Stage 2 update            | Turborepo + GitHub Actions coverage for `packages/api-contract` + `apps/server`; `CODEMAP.md` update                                                                                    | Dev   | 0.25 day |

**Total: ~2 days**

### Implementation Order

```
[EP08 merged] → EP11 → EP12 → EP13 (ST01 → ST02 → ST03)
                                  └── EP14 (parallel with EP13 once EP12 is done)
```

No story-level branches. Each epic on its own feature branch. Stories commit sequentially to the epic branch.

---

## Stage 2 Definition of Done

- `POST /api/srs/batch` with body `{ "deckId": "<hash>" }` returns `200` with 15 questions (verified via Postman)
- `POST /api/srs/answers` processes answers and returns updated mastery states
- Hardcoded user — single in-memory `WordState[]` store; no multi-tenancy
- All state in-memory — process restart resets state; no file I/O, no DB, no network calls
- No auth enforcement — `Authorization` header accepted but not validated
- `pnpm test` green across all packages including `apps/server`
- `pnpm typecheck` green for `@gll/api-contract` and `apps/server`

### What Stage 2 Proves

- The SRS engine API is ergonomic for an HTTP calling layer
- The `@gll/api-contract` type shape is usable by both server and future Nuxt consumer
- The error envelope and route structure are correct before a database is introduced
- The seed data shape (carried from Stage 1) is sufficient for API-level testing

---

## Epic List

| #    | Epic                                    | Key Stories                                                                                                                                               | Estimated Effort |
| ---- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| EP11 | `@gll/api-contract` — shared HTTP types | ST01: package scaffold + error types; ST02: SRS wire types                                                                                                | 0.25 day         |
| EP12 | `apps/server` — Hono scaffold           | ST01: package scaffold + health route + `wrangler.toml`; ST02: middleware stack (CORS, error handler, auth passthrough)                                   | 0.5 day          |
| EP13 | `apps/server` — SRS routes              | ST01: in-memory state store + engine singleton + batch registry; ST02: `POST /api/srs/batch`; ST03: `POST /api/srs/answers` + end-to-end integration test | 1 day            |
| EP14 | CI Stage 2 update                       | ST01: Turborepo + CI coverage for new packages + `CODEMAP.md`                                                                                             | 0.25 day         |

**Total: ~2 days**

---

## Key Type Mappings (Engine → Wire)

These discrepancies are load-bearing and must be handled in EP13 route handlers:

| Engine type/value               | Wire type/value                   | Location                                      |
| ------------------------------- | --------------------------------- | --------------------------------------------- |
| `QuestionType: 'mc'`            | `questionType: 'multiple_choice'` | `QuizQuestion` in `@gll/api-contract`         |
| `QuestionType: 'wordBlock'`     | `questionType: 'word_block'`      | `QuizQuestion` in `@gll/api-contract`         |
| `QuestionType: 'audio'`         | `questionType: 'audio'`           | (same)                                        |
| `MasteryPhase: 'srsM2_review'`  | `phase: 'anki_review'`            | `WordMasterySummary` in `@gll/api-contract`   |
| `QuizAnswer.isCorrect: boolean` | `QuizAnswer.correct: boolean`     | `SubmitAnswersRequest` in `@gll/api-contract` |

---

## Dependencies

| Dependency             | Type         | Notes                                                                                                                          |
| ---------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| EP08 merged to `main`  | **Blocking** | EP13 imports `@gll/srs-engine` data mappers; these exist on the EP08 branch                                                    |
| GAP-01 API surface ADR | Reference    | `product-documentation/architecture/20260305T200000Z-engineering-api-surface.md` — accepted; EP11 implements against this spec |
| EP01 monorepo scaffold | Required     | `tsconfig.base.json`, `pnpm-workspace.yaml`, Turborepo config inherited by EP11/EP12                                           |

---

## Open Questions

| Question                                                                                     | Impact                                                      | Owner                                                                 |
| -------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------- |
| Should `apps/server` include `wrangler.toml` from day one, or stay Node-only until Stage 3+? | Deployment config complexity vs rework cost                 | Locked: add minimal `wrangler.toml` in EP12, not wired into local dev |
| When should `deckId` hash be generated — at seed time (fixed per process) or per-request?    | Determines whether `deckId` is logged or must be discovered | Recommendation: fixed at seed time, printed to console on startup     |

---

## Next Stage

**Stage 3: Database Persistence** — local SQLite, schema migrations, data access layer behind the Hono routes. Depends on GAP-02 schema ADR (informed by Stage 1 seed data shapes).

_Resolves: Stage 2 planning_
_Related: [Stage 1 Build Sequence](./20260305T142801Z-stage1-build-sequence.md) · [MVP Readiness Gaps](../20260304T125757Z-mvp-readiness-gaps.md)_
