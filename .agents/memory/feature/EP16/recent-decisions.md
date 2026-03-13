# Recent Decisions — EP16

## 2026-03-13 — EP16-ST01 PLAN

**Story**: Rewrite `scripts/quiz-runner.ts` as HTTP API client

### Decisions

**Shared fetch helper `postJson<T>`**: Single typed helper for all three API calls (seed, batch, answers). Avoids 3x duplicated fetch boilerplate without being a premature abstraction.

**Mastery delta display** (`prev → masteryCount`): Server does not return previous mastery. Compute as `prev = masteryCount - (correct ? 1 : 0)`. Safe assumption for a single-batch session from a fresh seed (all words start at 0).

**`readKey()` raw mode pattern**: `process.stdin.resume()` + `setRawMode(true)` + `once('data', ...)` listener. Loop internally until `a/b/c/d` received. Call `setRawMode(false)` before resolving. This avoids readline (which buffers and requires Enter).

**No `CollectedAnswer` exported type**: Internal interface only — only used within `runQuiz()` and `submitAnswers()`. Not a contract type.

**CODEMAP update scope**: Root CODEMAP.md only — update the `scripts/quiz-runner.ts` row description to reflect HTTP client rewrite.
