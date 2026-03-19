# CODEMAP.md — `src/runner/`

CLI quiz execution. I/O only — no quiz generation logic.

---

## Files

| File | Purpose |
| --- | --- |
| `interactive.ts` | Renders questions, captures raw keypresses, shows feedback and final score |

---

## Exports — `interactive.ts`

| Export | Signature | Purpose |
| --- | --- | --- |
| `runInteractive` | `(questions: QuizQuestion[]) → Promise<void>` | Runs a full quiz session; accepts a/b/c/d keypresses without Enter; prints feedback per question and score at end |

### Internal Helpers

| Helper | Purpose |
| --- | --- |
| `readKey` | Captures a single keypress via `process.stdin` raw mode (no echo) |

---

## Dependencies

| Import | Source |
| --- | --- |
| `QuizQuestion` | `../types/quiz` |
| `process.stdin` | Node built-in |
