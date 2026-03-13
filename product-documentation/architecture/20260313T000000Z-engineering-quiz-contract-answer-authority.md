# ADR: Quiz Contract & Answer Authority

**Status:** Proposed

**Date:** 2026-03-13

**Deciders:** [To be confirmed]

---

## Context

EP13 delivered three SRS HTTP endpoints (`/seed`, `/batch`, `/answers`) and an interactive quiz runner script (`scripts/quiz-runner.ts`). Neither is usable as a real quiz:

- `/api/srs/batch` returns questions with no `choices` — the client cannot render a multiple choice question.
- `/api/srs/answers` accepts `correct: boolean` from the client — the client self-reports correctness. The server has no way to verify anything.
- `scripts/quiz-runner.ts` reveals the answer in the question text and asks "did you get it right?" — it is a self-assessment tool, not a quiz runner.
- `quiz-runner.ts` calls `SrsEngine` directly and bypasses the HTTP API entirely, so it cannot be used to validate the API contract.

The root failure is that the quiz loop was never designed around actual multiple choice interaction. The server generates questions but does not own the answer, so correctness cannot be verified.

---

## Decision

**The server owns the quiz from question generation through answer verification.**

### 1. `POST /api/srs/batch` — add `choices`, withhold `answer`

The response adds a `choices` field per question. The correct answer key is **not** returned to the client — it is stored server-side in the batch registry alongside the questions.

**Distractor selection:** 3 random `targetText` values drawn from the seeded word pool (excluding the correct word), shuffled with the correct answer into a/b/c/d slots.

**Updated `QuizQuestion` wire type:**
```ts
interface QuizQuestion {
  wordId: string;
  questionType: QuestionType;
  targetText: string;
  choices: Record<string, string>;  // { a: "ก", b: "ข", c: "ค", d: "ง" }
}
```

**Updated batch registry entry (server-internal):**
```ts
interface BatchEntry {
  questions: QuizQuestion[];
  correctKeys: Record<string, string>;  // { wordId → correctKey }
}
```

**Example batch response:**
```json
{
  "success": true,
  "data": {
    "batchId": "f3fd439f-...",
    "questions": [
      {
        "wordId": "ko-kai",
        "questionType": "multiple_choice",
        "targetText": "ก",
        "choices": { "a": "ข", "b": "ก", "c": "ค", "d": "ง" }
      }
    ],
    "batchSize": 3
  }
}
```

### 2. `POST /api/srs/answers` — client sends `selectedKey`, server determines correctness

The client sends the key the user picked. The server looks up the stored correct key for each `wordId`, determines `correct`, then calls `processAnswers` on the engine.

**Updated `QuizAnswer` wire type:**
```ts
interface QuizAnswer {
  wordId: string;
  selectedKey: string;  // replaces: correct: boolean
}
```

**Updated `AnswerResultPayload` wire type:**
```ts
interface AnswerResultPayload {
  wordId: string;
  submittedKey: string;
  correctKey: string;
  correct: boolean;
  masteryCount: number;
  phase: MasteryPhase;
}
```

**Example answers request:**
```json
{
  "batchId": "f3fd439f-...",
  "answers": [
    { "wordId": "ko-kai",    "selectedKey": "b" },
    { "wordId": "kho-khai",  "selectedKey": "b" },
    { "wordId": "kho-khwai", "selectedKey": "c" }
  ]
}
```

**Example answers response:**
```json
{
  "success": true,
  "data": {
    "processed": 3,
    "updatedWords": [
      { "wordId": "ko-kai",    "submittedKey": "b", "correctKey": "b", "correct": true,  "masteryCount": 1, "phase": "learning" },
      { "wordId": "kho-khai",  "submittedKey": "b", "correctKey": "b", "correct": true,  "masteryCount": 1, "phase": "learning" },
      { "wordId": "kho-khwai", "submittedKey": "c", "correctKey": "c", "correct": true,  "masteryCount": 1, "phase": "learning" }
    ]
  }
}
```

### 3. `scripts/quiz-runner.ts` — rewrite to call the HTTP server

The script is rewritten to exercise the real API:

1. `POST /seed` → capture `deckId` from response JSON
2. `POST /api/srs/batch` → display choices one question at a time
3. Collect `selectedKey` from stdin keypress (`a`/`b`/`c`/`d`)
4. After all questions answered, `POST /api/srs/answers` with collected `selectedKey` values
5. Print per-word results: submitted key, correct key, mastery delta

**Example question display:**
```
─────────────────────────────────────────
  Batch 1 — Q3 of 15
─────────────────────────────────────────
  What sound does "ค" make?

  a) ก
  b) ข
  c) ค
  d) ง

  → Your answer (a/b/c/d):
```

**Example results display:**
```
─────────────────────────────────────────
  Results
─────────────────────────────────────────
  ก (Ko Kai)     ✓  mastery: 0 → 1
  ข (Kho Khai)   ✗  you: c  correct: b   mastery: 0 → 0
  ค (Kho Khwai)  ✓  mastery: 0 → 1
```

---

## Rationale

- **Answer authority on the server** prevents client spoofing and makes the Postman flow meaningful — submitting any key gets you a real correctness verdict, with `correctKey` in the response to verify the system is working.
- **`choices` generated server-side** means both Postman and the runner get a self-contained question with no extra lookup needed.
- **`answer` withheld from batch response** preserves quiz integrity. The interactive runner cannot auto-answer; the user must engage with the choices.
- **Runner calls HTTP API** means it validates the actual contract, not an internal engine shortcut.
- **Multiple choice only** for this epic keeps scope tight. `word_block` and `audio` question types are out of scope.

---

## Alternatives Considered

| Option | Pros | Cons | Why Not Chosen |
|--------|------|------|----------------|
| Return `answer` in batch response | Easy Postman testing | Client knows correct answer before submitting; no real quiz | `correctKey` in answers response serves the same testing need without exposing the answer upfront |
| Keep `correct: boolean` from client | No breaking change | Server cannot verify; client cheats trivially | Correctness must be authoritative on the server |
| Runner calls engine directly | Simpler, no server dependency | Cannot validate HTTP contract; bypasses all route logic | Quiz runner exists specifically to exercise the API end-to-end |

---

## Consequences

**Positive:**
- Postman flow now fully exercises the quiz loop end-to-end with real verification
- Interactive runner demonstrates the API is working correctly, not just the engine
- Server is the single source of truth for correctness — no client trust required

**Negative / Risks:**
- Breaking change to `QuizAnswer` (`correct: boolean` → `selectedKey: string`) — any existing clients or tests using the old shape must be updated
- Distractor pool must have ≥ 3 other words with `targetText`; small seed sets (< 4 words) will need a fallback strategy

**Neutral:**
- `BatchPayload` gains a field (`choices`) but is otherwise the same shape
- Batch registry changes from `Map<batchId, QuizQuestion[]>` to `Map<batchId, BatchEntry>` — internal only

---

## Open Questions

| Question | Owner | Target | Decision |
|----------|-------|--------|----------|
| What is the fallback when the word pool has fewer than 4 words (can't generate 3 distractors)? | Dev | Before implementation | ✅ DECIDED: Return validation error from `/batch` if pool < 4 words. See note below. |
| Should `deckId` be returned from `/seed` to eliminate the console-log dependency in the runner? | Dev | Before implementation | ✅ DECIDED: Yes, return `deckId` in `/seed` response. See note below. |
| Should `word_block` and `audio` types be stripped from batch output for this epic, or left in with no `choices`? | Dev | Before implementation | ✅ DECIDED: Leave them in but mark them as "not yet implemented" in the runner. See note below. |

---

## Implementation Notes

### Minimum Pool Size Validation

**`/api/srs/batch` must validate that `requestedQuestions ≤ wordPool.size - 3`**

If the word pool has fewer than 4 words, it's impossible to generate 3 unique distractors for **any** question. Rather than implement complex fallback logic (reuse words, reduce choices, skip questions), the cleanest approach is to reject the request early:

```ts
const uniqueWords = wordPool.filter(w => w.targetText !== correctWord);
if (uniqueWords.length < 3) {
  return {
    success: false,
    error: {
      code: "INSUFFICIENT_WORD_POOL",
      message: `Cannot generate choices: need ≥4 unique words, got ${wordPool.length}`
    }
  };
}
```

**Rationale:**
- **Quiz integrity:** All questions must have consistent, distinct choices.
- **Data quality:** Seed sets with <4 words are incomplete for testing; surfacing the error early catches data problems.
- **Simplicity:** Avoids conditional logic for partial distractors or reuse strategies that would confuse the runner.
- **Postman testing:** Testers will immediately see if their seed is too small.

### `/seed` Response Includes `deckId`

**`POST /seed` must return `deckId` in the response body** instead of relying on console-log parsing in the runner.

Updated response format:
```json
{
  "success": true,
  "data": {
    "deckId": "deck-123abc",
    "seedId": "seed-456def",
    "wordCount": 25,
    "phase": "learning"
  }
}
```

**Rationale:**
- **API clarity:** The contract is explicit and testable; no hidden side effects.
- **Runner simplicity:** Script reads `deckId` from JSON response, not parsed stdout.
- **Consistency:** Matches the pattern of other endpoints that return IDs in response bodies.
