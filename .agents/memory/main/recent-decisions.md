# Recent Decisions

**Branch**: main
**Updated**: 20260314T000000Z
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
| 03-11 | `options[]` (MC distractors): omitted in Stage 2 — field is optional in ADR; known limitation                                     | EP13 design — superseded 03-13                |
| 03-13 | EP13 quiz contract rejected — `choices` and `answer` missing from batch; `correct: boolean` from client is wrong authority         | ADR: quiz-contract-answer-authority           |
| 03-13 | New epic required: server generates `choices`, withholds `answer`, client sends `selectedKey`, server verifies correctness         | ADR: quiz-contract-answer-authority           |
| 03-13 | `quiz-runner.ts` rejected — reveals answer in question text, self-reports correctness, bypasses HTTP API                          | ADR: quiz-contract-answer-authority           |
| 03-13 | Distractor selection: 3 random `targetText` values from same word pool, shuffled with correct answer into a/b/c/d                  | ADR: quiz-contract-answer-authority           |
| 03-13 | EP15-ST01: `QuizAnswer.correct` removed — intentional breakage in `@gll/server` left for ST02/ST03; api-contract typechecks clean | EP15-ST01                                     |
| 03-13 | EP15-ST02: non-MC questions get `choices: {}` (empty); only MC generates a/b/c/d — runner (EP16) skips MC interaction for other types | EP15-ST02                                     |
| 03-13 | EP15-ST03: `/answers` accepts `selectedKey`, server determines correctness via registry lookup; `/seed` route added returning `deckId` | EP15-ST03                                     |
| 03-14 | EP15-ST04: MC questions get random `questionDirection` (`english_to_native` or `native_to_english`); `buildMcChoices` derives `targetText` from direction | EP15-DS02, EP15-ST04                          |
| 03-14 | EP15-ST05: third direction `native_to_romanization` added; picker changed from 50/50 to uniform 1-of-3 via `DIRECTIONS` array | EP15-DS03, EP15-ST05                          |
| 03-14 | Hono `logger()` middleware added to `app.ts` for request/response visibility during development | logging fix                                   |
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

### 2026-03-13: EP13 Quiz Contract Rejected — New Epic Required

**Problem**: EP13 delivered a non-functional quiz. Three root failures:
1. `/api/srs/batch` returns no `choices` — unrenderable questions
2. `/api/srs/answers` accepts `correct: boolean` from client — client is answer authority
3. `quiz-runner.ts` shows the answer in the question text and self-reports correctness; bypasses HTTP API entirely

**Decision**: New epic to fix the quiz contract. ADR: `product-documentation/architecture/20260313T000000Z-engineering-quiz-contract-answer-authority.md`

**Contract changes**:
- `QuizQuestion` gains `choices: Record<string, string>` (a/b/c/d → targetText)
- `answer` is stored server-side in batch registry — NOT returned to client
- `QuizAnswer.correct: boolean` → `QuizAnswer.selectedKey: string`
- `AnswerResultPayload` gains `submittedKey` and `correctKey`
- Batch registry changes from `Map<batchId, QuizQuestion[]>` to `Map<batchId, { questions, correctKeys }>`

**quiz-runner.ts**: Full rewrite — must call HTTP API, display real MC choices, accept a/b/c/d keypress, print results with correctKey after submission.

**Scope**: Multiple choice only. `word_block` and `audio` out of scope for this epic.

**Open questions before implementation**:
- Distractor fallback when pool < 4 words
- Should `/seed` return `deckId` to eliminate console-log dependency in runner?
- Should `word_block`/`audio` types be filtered from batch output for this epic?

---

### 2026-03-14: EP15 Complete — Mixed Question Directions + Romanization

**EP15-ST03** (completed 03-13): `/api/srs/answers` now accepts `{ wordId, selectedKey }` per answer. Server looks up `correctKey` from `batchRegistry`, determines `correct` independently, returns `{ submittedKey, correctKey, correct, masteryCount, phase }` per word. `/api/srs/seed` route added — returns `{ deckId, wordCount, phase }` in response body (eliminates console-log dependency for EP16 runner).

**EP15-ST04** (completed 03-14): Each `multiple_choice` question in `/batch` response now has `questionDirection: 'english_to_native' | 'native_to_english'`. `buildMcChoices` accepts a `direction` parameter and derives `targetText`, `correctText`, and distractor field from it. `targetText` and `choices` values are always different text types.

**EP15-ST05** (completed 03-14): Third direction `native_to_romanization` added — `targetText` is Thai char, choices are romanization strings (e.g. `"Ko Kai"`). Direction picker changed from `Math.random() < 0.5` to uniform 1-of-3 via `DIRECTIONS` constant array. Motivation: many consonants share the same English sound (`"kh"` → ข, ค, ฆ, ฅ), making romanization the only unambiguous label.

**Current `QuestionDirection` type**: `'english_to_native' | 'native_to_english' | 'native_to_romanization'`

**Direction → field mapping**:

| direction | `targetText` | `correctText` | distractor field |
|---|---|---|---|
| `english_to_native` | `.english` | `.native` | `.native` |
| `native_to_english` | `.native` | `.english` | `.english` |
| `native_to_romanization` | `.native` | `.romanization` | `.romanization` |

**Test count**: 19 server tests passing. `pnpm typecheck` green across monorepo.

---

## Rotation Policy

- Keep only decisions from the last 3 days in "Recent Details"
- Decision Index keeps 1-liner summaries indefinitely (trim when > 20 rows)
- When trimming: move full details to `decisions-archive.md`
