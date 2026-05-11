# @gll/srs-engine-v2

Standalone SRS quiz engine. Internal package — not published to npm.

Exposes pure functions for composing quiz questions and managing session
state. Can be wrapped by any interface layer — terminal (`demo/`) or web
(server + frontend).

## Library API

```ts
import {
  composeBatch,
  composeBatchMulti,
  processRecheckResult,
  nextActivePool,
  updateMasteryState,
  updateRunState,
  isMastered,
} from '@gll/srs-engine-v2';
```

All exports are pure functions. No I/O, no side effects, no persistence.

## Terminal demo

The `demo/` folder shows how to build a terminal interface on top of the
library. It is also used to manually verify the engine behaves correctly.

**From repo root:**

```bash
pnpm learnv2
```

**Modes** — controlled by `AUTO_MODE` in `demo/config.ts`:

- `AUTO_MODE = false` — interactive; prompts deck selection and reads
  `a/b/c/d` keystrokes
- `AUTO_MODE = true` — auto-answers using `CorrectAutoAnswerStrategy`,
  exits after one run

**Configuration** (`demo/config.ts`):

```ts
questionLimit: 8     // max questions per batch
masteryThreshold: 2  // mastery count required to graduate a word
```

**Active words** — edit `demo/learning-runner.ts` to change which
foundationals and deck are drilled:

```ts
const mockFoundational = [...mockConsonants, ...mockVowels, ...mockTones];
const words = [mockConsonants[0], mockVowels[0], mockTones[0], ...deckWords];
```

## Architecture

```
src/index.ts                 public library API

src/engine/
  compose-batch.ts           composeBatch, composeBatchMulti
  session.ts                 processRecheckResult, nextActivePool,
                             updateMasteryState

src/types/
  word-state.ts              updateRunState, isMastered, RunState
  quiz.ts                    QuizQuestion, QuizChoice, QuizResult
  deck.ts                    MockDeck, MockLine
  foundational.ts            MockFoundational, ThaiFoundational

demo/                        terminal interface (uses src/index.ts)
  learning-runner.ts         entry point
  learning-io.ts             I/O + runAdaptiveLoop orchestration
  auto-answerer.ts           runAutoInteractive
  auto-answer-strategy.ts    CorrectAuto, RandomAuto, WeightedAccuracy
  config.ts                  LEARNING_CONFIG, AUTO_MODE

data/mock/                   Thai + Japanese test data
```

### Question directions per item type

| Type | Directions |
| --- | --- |
| consonant, vowel, word | native↔english, native↔romanization (4 total) |
| tone | native↔english only (2 total) |

### Session state flow (one batch)

```
nextActivePool(active, queue, ...)
  → composeBatchMulti(activeItems, pool, { questionLimit })
  → QuizQuestion[]  →  answered by user or strategy
  → updateMasteryState(results, runState, prevState, ...)
      → processRecheckResult per answer
          → updateRunState (streak + mastery transitions)
  → MasteryUpdateResult { runState, newlyMasteredIds, ... }
```

## Running tests

```bash
# All tests
pnpm test

# Watch mode
pnpm test:watch

# Single file
npx vitest run src/__tests__/unit/session.test.ts

# From repo root
pnpm --filter @gll/srs-engine-v2 test
```
