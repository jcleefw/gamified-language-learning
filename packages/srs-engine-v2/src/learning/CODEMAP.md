# CODEMAP.md — `src/learning/`

Learning phase execution and orchestration.

---

## Files

| File | Purpose |
| --- | --- |
| `learning-runner.ts` | CLI entry point — wires mock data, selects deck/strategy, and starts the adaptive loop |
| `learning-io.ts` | CLI I/O orchestration — renders questions, captures input, manages session flow (formerly `interactive.ts`) |
| `auto-answerer.ts` | Automated quiz runner — answers questions using a provided `AutoAnswerStrategy` |
| `auto-answer-strategy.ts` | Strategy implementations for automated answering (Perfect, Random, Weighted) |
| `config.ts` | Learning phase constants — foundational word counts, question limits, and mastery thresholds |

---

## Key Exports — `learning-io.ts`

| Export | Signature | Purpose |
| --- | --- | --- |
| `runAdaptiveLoop` | `(words: QuizItem[], ..., strategy?: AutoAnswerStrategy) → Promise<RunState>` | Main quiz loop; supports both interactive (no strategy) and auto mode (with strategy) |
| `selectDeck` | `(decks: MockDeck[]) → Promise<MockDeck>` | CLI deck selection prompt |
| `runInteractive` | `(questions: QuizQuestion[]) → Promise<QuizResult[]>` | Low-level interactive quiz session |

## Key Exports — `auto-answerer.ts`

| Export | Signature | Purpose |
| --- | --- | --- |
| `runAutoInteractive` | `(questions: QuizQuestion[], strategy: AutoAnswerStrategy) → Promise<QuizResult[]>` | Automated quiz execution |

---

## Dependencies

| Import | Source |
| --- | --- |
| `QuizQuestion` | `../types/quiz` |
| `AutoAnswerStrategy` | `./auto-answer-strategy` |
| `RunState`, `WordState` | `../types/word-state` |
| `LEARNING_CONFIG`, `STREAK_THRESHOLDS` | `./config` |
