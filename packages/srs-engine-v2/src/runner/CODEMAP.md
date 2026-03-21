# CODEMAP.md — `src/runner/`

CLI quiz execution. I/O only — no quiz generation logic.

---

## Files

| File | Purpose |
| --- | --- |
| `interactive.ts` | Renders questions, captures raw keypresses, shows feedback and final score; supports both interactive and auto modes |
| `auto-answerer.ts` | Automatically answers quiz questions using a provided `AnswerStrategy` |

---

## Exports — `interactive.ts`

| Export | Signature | Purpose |
| --- | --- | --- |
| `runInteractive` | `(questions: QuizQuestion[]) → Promise<{ correct: number; total: number; results: QuizResult[] }>` | Runs interactive quiz; accepts a/b/c/d keypresses without Enter; prints feedback per question |
| `runAdaptiveLoop` | `(words: QuizItem[], ..., strategy?: AnswerStrategy) → Promise<RunState>` | Main quiz loop; supports both interactive (no strategy) and auto mode (with strategy); auto mode passes `shuffle: false` to disable randomness |
| `selectDeck` | `(decks: MockDeck[]) → Promise<MockDeck>` | CLI deck selection prompt |
| `QuizResult` | Interface | `{ wordId: string; correct: boolean }` — result of a single question |

### Internal Helpers

| Helper | Purpose |
| --- | --- |
| `readKey` | Captures a single keypress via `process.stdin` raw mode (no echo) |
| `runBatch` | Composes and runs a single batch; routes to `runInteractive` or `runAutoInteractive` based on strategy |

## Exports — `auto-answerer.ts`

| Export | Signature | Purpose |
| --- | --- | --- |
| `runAutoInteractive` | `(questions: QuizQuestion[], strategy: AnswerStrategy) → Promise<{ correct: number; total: number; results: QuizResult[] }>` | Runs auto quiz using a strategy; no user input, completes instantly |
| `QuizResult` | Interface | `{ wordId: string; correct: boolean }` — result of a single question |

---

## Dependencies

| Import | Source |
| --- | --- |
| `QuizQuestion` | `../types/quiz` |
| `AnswerStrategy` | `../types/answer-strategy` |
| `RunState`, `WordState` | `../types/word-state` |
| `process.stdin` | Node built-in |
