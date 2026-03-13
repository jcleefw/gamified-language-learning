# EP16-DS01: Quiz Runner HTTP Rewrite Specification

**Date**: 20260313T000000Z
**Status**: Draft
**Epic**: [EP16 - Quiz Runner: HTTP-Based Interactive Quiz](.agents/plans/epics/EP16-quiz-runner-http-rewrite.md)

---

## 1. Feature Overview

Fully replace `scripts/quiz-runner.ts` with an HTTP API client. The new script drives a real multiple-choice quiz by calling three server endpoints in sequence: `/seed` → `/batch` → `/answers`. It collects one raw keypress per question, submits `selectedKey` values to the server, and displays per-word correctness results returned by the server. The script does not import any engine or data packages — all quiz logic lives on the server (EP15).

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
| Unsupported question types | Print `[not yet implemented — skipped]` and do not collect a keypress | `word_block` and `audio` are out of scope; skipping is cleaner than collecting a meaningless key |
| Unit tests | None — manual E2E verification only | Per epic plan: the script is a thin HTTP client with no logic worth unit-testing in isolation |
| TypeScript | Strict — no `any`, no `// @ts-ignore` | `pnpm typecheck` must pass |
| Imports | `@gll/api-contract` types only (no engine packages) | Script is a pure HTTP client; engine packages are server-side |

---

## 3. Data Structures

```typescript
// ── Consumed from @gll/api-contract (after EP15) ───────────────────────────

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

// ── Script-internal ─────────────────────────────────────────────────────────

// Collected during the question loop; submitted as a batch to /answers
interface CollectedAnswer {
  wordId: string;
  selectedKey: string;
}
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
POST /api/srs/batch { deckId }
  → read batchId, questions[]
  → print batch header: "Batch 1 — N questions"
  │
  ▼
FOR EACH question
  │
  ├─ questionType === 'multiple_choice'
  │    → print separator + "Q{n} of {total}"
  │    → print targetText as question prompt
  │    → print a/b/c/d choices
  │    → print "→ Your answer (a/b/c/d):"
  │    → capture single raw keypress
  │    │
  │    ├─ key ∈ { a, b, c, d }  → record CollectedAnswer { wordId, selectedKey }
  │    └─ key ∉ valid keys      → reprompt (loop)
  │
  └─ questionType ∈ { word_block, audio }
       → print "[not yet implemented — skipped]"
       → no keypress collected
  │
  ▼
POST /api/srs/answers { batchId, answers: CollectedAnswer[] }
  │
  ▼
PRINT results header
FOR EACH updatedWord in response
  ├─ correct === true   → "  {targetText} ({wordId})  ✓  mastery: {prev} → {masteryCount}"
  └─ correct === false  → "  {targetText} ({wordId})  ✗  you: {submittedKey}  correct: {correctKey}   mastery: {prev} → {masteryCount}"

END (process exits 0)
```

**Error path**: Any HTTP error (non-2xx, network failure) prints the error to stderr and calls `process.exit(1)`.

---

## 5. Stories

### EP16-ST01: Rewrite `scripts/quiz-runner.ts` as HTTP API client

**Scope**: Full replacement of `scripts/quiz-runner.ts`. Remove all engine imports, seed-loading, and self-assessment logic. Implement the three-step HTTP flow: seed → batch → collect answers → submit answers → display results. No tests required.

**Precondition**: EP15 complete and server running on `localhost:3000`.

**Read List**:
- `scripts/quiz-runner.ts` — current implementation (understand what is being removed)
- `packages/api-contract/src/srs.ts` — wire types used for request/response shapes
- `product-documentation/architecture/20260313T000000Z-engineering-quiz-contract-answer-authority.md` — display format (question display, results display)

**Tasks**:

- [ ] Remove all `import` statements referencing `@gll/srs-engine`, `node:fs`, `node:path`, `node:url`, or local data packages
- [ ] Add `import type` for `ApiResponse`, `SeedPayload`, `BatchPayload`, `QuizQuestion`, `SubmitAnswersRequest`, `SubmitAnswersResponse`, `AnswerResultPayload` from `@gll/api-contract`
- [ ] Implement `seed()` helper: `POST http://localhost:3000/api/srs/seed`, return `deckId` from `data.deckId`
- [ ] Implement `getBatch(deckId)` helper: `POST http://localhost:3000/api/srs/batch` with `{ deckId }`, return `BatchPayload`
- [ ] Implement `submitAnswers(batchId, answers)` helper: `POST http://localhost:3000/api/srs/answers`, return `SubmitAnswersResponse`
- [ ] Implement `readKey()` helper: set stdin to raw mode, resolve on first keypress in `{ a, b, c, d }`, reprompt on invalid key, restore stdin to normal mode before resolving
- [ ] Implement `displayQuestion(q, index, total)`: print separator line, `Q{index} of {total}`, targetText prompt, labelled choices, answer prompt
- [ ] Implement `displayResults(updatedWords, questions)`: print results header, one line per word — `✓` or `✗` with mastery delta; for wrong answers show `you:` and `correct:` keys
- [ ] Implement `runQuiz()`: call seed → batch → question loop (skip non-mc, collect answers) → submit → display results → `process.exit(0)`
- [ ] Verify `pnpm typecheck` passes with no errors for the script

**Acceptance Criteria**:

- [ ] `npx tsx scripts/quiz-runner.ts` (with server running) prints seed confirmation, batch header, N questions, then results — no unhandled errors
- [ ] Each `multiple_choice` question shows `targetText`, labelled `a/b/c/d` choices, and a prompt; the correct key is not visible before submitting
- [ ] Pressing a valid key (`a`/`b`/`c`/`d`) records the answer and advances to the next question without requiring Enter
- [ ] Pressing an invalid key re-displays the prompt without advancing
- [ ] `word_block` and `audio` questions display `[not yet implemented — skipped]` and do not collect a keypress
- [ ] Results screen shows `✓`/`✗` per word with `you:` and `correct:` keys for wrong answers and mastery delta
- [ ] A deliberately wrong answer shows `✗`, displays the correct key, and shows mastery unchanged (0 → 0)
- [ ] `deckId` is read from the `/seed` JSON response — no `console.log` parsing
- [ ] `pnpm typecheck` green for the script

---

## 6. Success Criteria

1. `npx tsx scripts/quiz-runner.ts` completes a full quiz loop against the running server without error
2. Correct answer key is never shown to the user during the question phase — only revealed in the results
3. Server determines correctness — submitting any key returns a real verdict (no client self-reporting)
4. `pnpm typecheck` green across the monorepo
5. No imports of engine packages or local data files remain in the script