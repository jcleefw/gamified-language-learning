# EP16-DS01: Quiz Runner HTTP Rewrite Specification

**Date**: 20260313T000000Z
**Status**: Draft
**Epic**: [EP16 - Quiz Runner: HTTP-Based Interactive Quiz](.agents/plans/epics/EP16-quiz-runner-http-rewrite.md)

---

## 1. Feature Overview

Fully replace `scripts/quiz-runner.ts` with an HTTP API client. The new script drives a real multiple-choice quiz by calling three server endpoints in sequence: `/seed` → `/batch` → `/answers`. It collects one raw keypress per question, submits `selectedKey` values to the server, and displays per-word correctness results returned by the server. The script does not import any engine or data packages — all quiz logic lives on the server (EP15).

The client declares `clientCapabilities: { mc: true, wordBlock: false, audio: false }` in each batch request. The server normalises any unsupported question type to `mc` before returning, so the client always receives questions it can render.

**Precondition**: EP15 must be complete. The server must expose:
- `POST /api/srs/seed` → `{ success: true, data: { deckId, wordCount, phase } }`
- `POST /api/srs/batch` with `choices` in each question, correct key withheld
- `POST /api/srs/answers` accepting `selectedKey`, returning `submittedKey` + `correctKey` + `correct`

---

## 2. Core Requirements

| Requirement | Decision | Rationale |
| --- | --- | --- |
| HTTP client | Native `fetch` (Node 18+) | No extra dependencies; already available in the monorepo runtime |
| Keypress input | `process.stdin.setRawMode(true)` + single `data` event | Captures a single keypress without requiring Enter; readline is not suitable for raw key capture |
| Valid keys | `a`, `b`, `c`, `d` only — reprompt on any other key | Prevents silent bad input |
| Server URL | `http://localhost:3000` hardcoded | Single-environment script; no env config needed for this epic |
| Unsupported question types | Client sends `clientCapabilities`; server normalises to `mc` — no client-side skip logic needed | Cleaner than skipping: server guarantees every question is renderable before it arrives |
| Unit tests | None — manual E2E verification only | Per epic plan: the script is a thin HTTP client with no logic worth unit-testing in isolation |
| TypeScript | Strict — no `any`, no `// @ts-ignore` | `pnpm typecheck` must pass |
| Imports | `@gll/api-contract` types only (no engine packages) | Script is a pure HTTP client; engine packages are server-side |

---

## 3. Data Structures

```typescript
// ── packages/api-contract/src/srs.ts additions ──────────────────────────────

/** Which question types the client is able to render. */
export interface ClientCapabilities {
  mc?: boolean;
  wordBlock?: boolean;
  audio?: boolean;
}

/** POST /api/srs/batch — request body */
export interface GetBatchRequest {
  deckId: string;
  size?: number;
  clientCapabilities?: ClientCapabilities;
}

// ── Consumed from @gll/api-contract (after EP15) ────────────────────────────

// POST /api/srs/seed response
interface SeedPayload {
  deckId: string;
  seedId?: string;
  wordCount: number;
  phase: MasteryPhase;
}

// POST /api/srs/batch response — choices added by EP15
interface QuizQuestion {
  wordId: string;
  questionType: QuestionType;   // 'multiple_choice' | 'word_block' | 'audio'
  targetText: string;
  choices: Record<string, string>;  // { a: "ก", b: "ข", c: "ค", d: "ง" }
  // correct key intentionally absent — server withholds it
}

interface BatchPayload {
  batchId: string;
  questions: QuizQuestion[];
  batchSize: number;
}

// POST /api/srs/answers request — selectedKey replaces correct: boolean (EP15)
interface QuizAnswer {
  wordId: string;
  selectedKey: string;
}

interface SubmitAnswersRequest {
  batchId: string;
  answers: QuizAnswer[];
}

// POST /api/srs/answers response — submittedKey + correctKey added by EP15
interface AnswerResultPayload {
  wordId: string;
  submittedKey: string;
  correctKey: string;
  correct: boolean;
  masteryCount: number;
  phase: MasteryPhase;
}

interface SubmitAnswersResponse {
  processed: number;
  updatedWords: AnswerResultPayload[];
}

// ── Script-internal ──────────────────────────────────────────────────────────

// Collected during the question loop; submitted as a batch to /answers
interface CollectedAnswer {
  wordId: string;
  selectedKey: string;
}

// ── Server-side normalisation (apps/server/src/routes/srs.ts) ────────────────

// When clientCapabilities is present, any question whose type the client cannot
// render is remapped to the first supported type before the response is sent.
// Priority: mc > wordBlock > audio. If no supported type exists, question is dropped.
```

---

## 4. User Workflows

```
START
  │
  ▼
POST /api/srs/seed
  → read deckId from response JSON
  → print "Seeded N words"
  │
  ▼
POST /api/srs/batch { deckId, clientCapabilities: { mc: true, wordBlock: false, audio: false } }
  → server normalises any non-mc questions to mc
  → read batchId, questions[]
  → print batch header: "Batch 1 — N questions"
  │
  ▼
FOR EACH question
  → print separator + "Q{n} of {total}"
  → print targetText as question prompt
  → print a/b/c/d choices
  → print "→ Your answer (a/b/c/d):"
  → capture single raw keypress
  │
  ├─ key ∈ { a, b, c, d }  → record CollectedAnswer { wordId, selectedKey }
  └─ key ∉ valid keys      → reprompt (loop)
  │
  ▼
POST /api/srs/answers { batchId, answers: CollectedAnswer[] }
  │
  ▼
PRINT results header
FOR EACH updatedWord in response
  ├─ correct === true   → "  {targetText} ({wordId})  ✓  mastery: {prev} → {masteryCount}"
  └─ correct === false  → "  {targetText} ({wordId})  ✗  you: {submittedKey}  correct: {correctKey}   mastery: {prev} → {masteryCount}"

PROMPT "Next batch? (Enter to continue, q to quit)"
  → Enter → repeat from POST /api/srs/batch
  → q or Ctrl+C → exit 0

END (process exits 0)
```

**Error path**: Any HTTP error (non-2xx, network failure) prints the error to stderr and calls `process.exit(1)`.

---

## 5. Stories

### EP16-ST01: Rewrite `scripts/quiz-runner.ts` as HTTP API client

**Scope**: Full replacement of `scripts/quiz-runner.ts`. Remove all engine imports, seed-loading, and self-assessment logic. Implement the three-step HTTP flow: seed → batch → collect answers → submit answers → display results → prompt for next batch. No tests required.

**Precondition**: EP15 complete and server running on `localhost:3000`.

**Read List**:
- `scripts/quiz-runner.ts` — current implementation (understand what is being removed)
- `packages/api-contract/src/srs.ts` — wire types used for request/response shapes
- `apps/server/src/routes/srs.ts` — server batch route (to add clientCapabilities normalisation)

**Tasks**:

- [ ] `packages/api-contract/src/srs.ts` — add `ClientCapabilities` interface; add `clientCapabilities?: ClientCapabilities` to `GetBatchRequest`
- [ ] `apps/server/src/routes/srs.ts` — import `GetBatchRequest`; after composing batch, remap any question whose type the client cannot render to the first supported type (priority: mc > wordBlock > audio); add `mastered: 'anki_review'` to `ENGINE_TO_WIRE_PHASE` map
- [ ] `scripts/quiz-runner.ts` — remove all `import` statements referencing `@gll/srs-engine`, `node:fs`, `node:path`, `node:url`, or local data packages
- [ ] `scripts/quiz-runner.ts` — add `import type` for `ApiResponse`, `SeedPayload`, `BatchPayload`, `QuizQuestion`, `SubmitAnswersResponse`, `AnswerResultPayload` from `@gll/api-contract`
- [ ] `scripts/quiz-runner.ts` — implement `seed()`: `POST /api/srs/seed`, return `SeedPayload`
- [ ] `scripts/quiz-runner.ts` — implement `getBatch(deckId)`: `POST /api/srs/batch` with `{ deckId, clientCapabilities: { mc: true, wordBlock: false, audio: false } }`, return `BatchPayload`
- [ ] `scripts/quiz-runner.ts` — implement `submitAnswers(batchId, answers)`: `POST /api/srs/answers`, return `SubmitAnswersResponse`
- [ ] `scripts/quiz-runner.ts` — implement `readKey()`: raw stdin, resolve on `a`/`b`/`c`/`d`, reprompt on invalid, restore stdin before resolving
- [ ] `scripts/quiz-runner.ts` — implement `displayQuestion(q, index, total, batchNumber)`: separator, batch/question header, targetText prompt, labelled choices, answer prompt
- [ ] `scripts/quiz-runner.ts` — implement `displayResults(updatedWords, questions)`: results header, one line per word — `✓` or `✗` with mastery delta; wrong answers show `you:` and `correct:` keys
- [ ] `scripts/quiz-runner.ts` — implement `runQuiz()`: seed → multi-batch loop (batch → questions → submit → results → promptContinue)
- [ ] Verify `pnpm typecheck` passes

**Acceptance Criteria**:

- [ ] `npx tsx scripts/quiz-runner.ts` (with server running) prints seed confirmation, batch header, N questions, results, then prompts for next batch
- [ ] Each question shows `targetText`, labelled `a/b/c/d` choices, and a prompt; the correct key is not visible before submitting
- [ ] Pressing a valid key (`a`/`b`/`c`/`d`) records the answer and advances without requiring Enter
- [ ] Pressing an invalid key re-displays the prompt without advancing
- [ ] All questions are `multiple_choice` — no skipped questions
- [ ] Results screen shows `✓`/`✗` per word with `you:` and `correct:` keys for wrong answers and mastery delta
- [ ] After results, pressing Enter fetches the next batch; pressing `q` or Ctrl+C exits cleanly
- [ ] `pnpm typecheck` green for the script and server

---

## 6. Success Criteria

1. `npx tsx scripts/quiz-runner.ts` completes multiple batch loops against the running server without error
2. Correct answer key is never shown to the user during the question phase — only revealed in the results
3. Server determines correctness — submitting any key returns a real verdict (no client self-reporting)
4. All questions rendered as multiple choice — no skipped or unsupported question types
5. `pnpm typecheck` green across the monorepo
6. No imports of engine packages or local data files remain in the script
