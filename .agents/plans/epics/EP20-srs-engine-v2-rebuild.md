# EP20 - SRS Engine v2: Rebuild from Scratch

**Created**: 20260319T000000Z
**Status**: In Progress

<!-- Status: Draft | Accepted | In Progress | Impl-Complete | BDD Pending | Completed | Shelved | Withdrawn -->

**Type**: Epic Plan
**Depends on**: N/A (fresh start, independent of EP02–EP07)
**Parallel with**: N/A
**Predecessor**: EP04, EP07 (replaced by this epic)

---

## Problem Statement

The v1 SRS engine (`packages/srs-engine`) was built all at once — batch composition,
active window, carry-over, foundational allocation, FSRS scheduling — wired together
before any single piece was verified to work correctly. The result was an engine with
layered bugs that couldn't be isolated or tested incrementally.

## Approach

Build in strict vertical slices. Each slice:
- Has one job
- Is verified by a Node.js runner script before moving to the next
- Does not require HTTP to test

HTTP (Hono) comes after the engine is proven. The existing Hono server (`apps/server`)
is untouched until the engine is ready to wire in.

## Package

`packages/srs-engine-v2/` — self-contained, no imports from `apps/server` or any
framework. Mock data lives inside the package at `data/mock/`.

---

## Scope

**In scope**:

- Fresh `WordState` type and engine types defined from scratch
- `composeBatch` rebuilt slice by slice: flat → carry-over → priority → active window → foundational split → question type distribution
- `processAnswers`: mastery counting, phase transition, carry-over flagging
- Node.js runner script to exercise each slice manually
- Vitest unit tests per slice

**Out of scope** (for now):

- FSRS scheduling — deferred until core batch + mastery loop is verified
- Stuck word / shelving logic — deferred
- HTTP routes / Hono wiring — deferred until engine is solid
- `word_block` and `audio` question types — MC only until batch is correct

---

## Stories

### EP20-ST01: Mock seed data ✅

**Scope**: Create `packages/srs-engine-v2/data/mock/` with self-contained raw typed
arrays. No engine imports, no server imports.

- `mock-consonants.ts` — 5 foundational consonants (ko-kai → cho-chan)
  - `romanization` = consonant name (e.g. 'Ko Kai'), not phonetic
- `mock-words.ts` — 15 curated words
  - 12 from "let's eat something", 3 from "weather is hot today"
  - `romanization` = phonetic pronunciation (e.g. 'hǐw')

**Status**: Done



### EP20-ST02: Project scaffold + test harness ✅

**Scope**: Make `packages/srs-engine-v2` runnable and testable from root.

- `pnpm quizv2` runs `src/main.ts` via `tsx` from workspace root
- `__tests__/setup.ts` satisfies vitest config requirement
- `__tests__/integration/smoke.test.ts` — 2 passing smoke tests verifying mock data loads
- Confirms vitest runs cleanly with `pnpm --filter @gll/srs-engine-v2 test`

**Status**: Done

### EP20-ST03: Batch composition — 1 consonant, 4 MC questions, interactive runner

**Scope**: Given 1 consonant from `mockConsonants`, compose a batch of exactly 4
multiple-choice questions (one per direction) and run them interactively via stdin.

#### Question directions

| # | Prompt shows | Answer choices are |
|---|---|---|
| 1 | native (Thai char) | `english (class)` — e.g. `k (middle)` |
| 2 | `english (class)` | native (Thai char) |
| 3 | native (Thai char) | romanization — e.g. `Ko Kai` |
| 4 | romanization | native (Thai char) |

**English format**: always `"${english} (${class})"` — e.g. `"kh (high)"`. Never english alone.

#### Choices

- 4 options per question: `a`, `b`, `c`, `d`
- 1 correct, 3 distractors picked randomly from the remaining 4 consonants
- Distractors are the **same field type** as the correct answer — no mixing
  (e.g. direction 1 choices are all `english (class)` strings, not native or romanization)

#### Interactive runner (`pnpm quizv2`)

1. Display question prompt and 4 labelled choices
2. Wait for user to type `a` / `b` / `c` / `d` and press Enter
3. Show immediate feedback: ✓ Correct or ✗ Wrong — correct answer was: `<value>`
4. Move to next question
5. After all 4 questions, display final score: `Score: X / 4`

#### Files

- `src/types/quiz.ts` — `QuizQuestion`, `QuizChoice`, `QuizDirection` types
- `src/engine/compose-batch.ts` — `composeBatch(consonant, pool)` → `QuizQuestion[]`
- `src/runner/interactive.ts` — readline runner, imported by `main.ts`
- `src/__tests__/unit/compose-batch.test.ts` — unit tests (see below)
- `src/main.ts` — updated to call interactive runner with first consonant + full pool

#### Unit tests (`compose-batch.test.ts`)

- Returns exactly 4 questions
- Each question has exactly 4 choices
- Exactly 1 choice is marked correct per question
- Direction 1 choices are all `english (class)` format (`/\w+ \(\w+\)/`)
- Direction 2 choices are all native Thai strings
- Direction 3 choices are all romanization strings
- Direction 4 choices are all native Thai strings
- Correct answer is always present in the choices

#### Success criteria

1. `pnpm --filter @gll/srs-engine-v2 test` — all tests pass (including existing smoke tests)
2. `pnpm quizv2` — presents 4 questions interactively, shows per-answer feedback, ends with score

**Status**: Done

---

### EP20-ST04: Batch composition — N foundational words, configurable question limit

**Scope**: Extend the quiz engine to compose a batch across multiple foundational words,
with a configurable total question limit and guaranteed per-word coverage.

#### Configuration constants (in `main.ts`)

| Constant | Default | Purpose |
|---|---|---|
| `FOUNDATIONAL_WORD_COUNT` | `3` | How many words are included in the quiz |
| `QUESTION_LIMIT` | `5` | Total questions returned (must be ≥ `FOUNDATIONAL_WORD_COUNT`) |

#### New engine function

`composeBatchMulti(words, pool, { questionLimit }) → QuizQuestion[]`

**Algorithm (coverage-first shuffle)**:
1. For each word, generate all 4 direction questions and shuffle them
2. Pick 1 question per word as a guaranteed "coverage" slot → `wordCount` questions
3. Collect remaining questions from all words into a leftover pool
4. Shuffle the leftover pool; take `questionLimit - wordCount` questions as filler
5. Final shuffle of `[...coverage, ...filler]`
6. Edge case: if `questionLimit < wordCount`, coverage is capped at `questionLimit`

#### Files changed

- `src/engine/compose-batch.ts` — add `composeBatchMulti`; `composeBatch` unchanged
- `src/main.ts` — replace hardcoded single-word logic with two constants + `composeBatchMulti`
- `src/__tests__/unit/compose-batch.test.ts` — new `describe('composeBatchMulti')` block

#### Unit tests (`composeBatchMulti`)

- Returns exactly `questionLimit` questions
- Every input word appears in at least 1 question
- Each question has exactly 4 choices, exactly 1 correct
- No duplicate (word + direction) pairs
- When `questionLimit ≥ total possible`, all questions are returned

#### Success criteria

1. `pnpm --filter @gll/srs-engine-v2 test` — all tests pass (including existing ST03 tests)
2. `pnpm quizv2` — presents 5 questions across 3 words with per-answer feedback and final score
3. Changing `FOUNDATIONAL_WORD_COUNT` from 1 → 3 → 5 → 4 requires editing one line
4. Changing `QUESTION_LIMIT` requires editing one line

**Status**: Done

---

### EP20-ST05: Introduce non-foundational words into the quiz mix

**Scope**: Extend the quiz engine to handle `MockWord` alongside `MockConsonant`. Words
use plain `english` (no class suffix). Distractors never cross pools. Config extracted to
a single object in `main.ts`.

#### ID format change

Both types adopt a language-namespaced ID format: `th::native`.

- `MockConsonant` IDs updated: `ko-kai` → `th::ก`, `kho-khai` → `th::ข`, etc.
- `MockWord` gains `id` field with the same format: `th::หิว`, `th::ไป`, etc.

#### Type change — `QuizItem` union

Define `type QuizItem = MockConsonant | MockWord` in `src/engine/compose-batch.ts`.
Discriminant: `'class' in item` → `MockConsonant`; otherwise `MockWord`.

- `getEnglishLabel(item: QuizItem): string` replaces `englishWithClass`:
  - Consonant: `"${english} (${class})"`
  - Word: `english` only
- `composeBatch(item: QuizItem, pool: QuizItem[]): QuizQuestion[]` — signature generalised
- `composeBatchMulti(words: QuizItem[], pool: QuizItem[], options): QuizQuestion[]` — same

Pools remain homogeneous per call (words pool = `mockWords` only, consonant pool = `mockConsonants` only).

#### Config object (in `main.ts`)

Replace separate constants with a single object:

```ts
const config = {
  foundationalWordCount: 3,   // consonants to quiz
  nonFoundationalWordCount: 3, // words to quiz
  questionLimit: 8,            // total questions presented
};
```

Question limit split: `consonantLimit = Math.ceil(config.questionLimit / 2)`, `wordLimit = config.questionLimit - consonantLimit`.

#### `main.ts` wiring

```ts
const consonantQuestions = composeBatchMulti(consonants, mockConsonants, { questionLimit: consonantLimit });
const wordQuestions      = composeBatchMulti(words, mockWords,           { questionLimit: wordLimit });
await runInteractive(shuffle([...consonantQuestions, ...wordQuestions]));
```

#### Files changed

| File | Change |
|---|---|
| `data/mock/mock-consonants.ts` | Update 5 IDs to `th::native` format |
| `data/mock/mock-words.ts` | Add `id: string` to `MockWord`; populate `id: 'th::native'` for all 15 entries |
| `src/engine/compose-batch.ts` | `QuizItem` union; `getEnglishLabel`; generalise `composeBatch` + `composeBatchMulti` |
| `src/main.ts` | `config` object; import `mockWords`; two `composeBatchMulti` calls; combined shuffle |
| `src/__tests__/unit/compose-batch.test.ts` | Update ID-dependent assertions; add `describe('composeBatchMulti with words')` block |

#### Unit tests — new `describe('composeBatchMulti with words')`

- Returns exactly `questionLimit` questions
- Every input word appears in at least 1 question
- Each question has exactly 4 choices, exactly 1 correct
- No duplicate word+direction pairs
- `native-to-english` choices are plain english strings (no `(class)` suffix)

#### Success criteria

1. `pnpm --filter @gll/srs-engine-v2 test` — all tests pass
2. `pnpm quizv2` — presents 8 questions mixing consonants and words, with per-answer feedback and final score
3. Changing any value in `config` requires editing one line

**Status**: Done

---

### EP20-ST06: Deck + Batch architecture

**Scope**: Introduce `Deck` and `Batch` as first-class types. A deck holds two pools
(words + foundational). A batch is a sequential slice of both pools with a question limit.
The runner loops through all batches, prompting "Next batch?" between each, and shows a
run summary at the end.

#### New types — `src/types/deck.ts`

```ts
interface Deck {
  wordPool: MockWord[];
  foundationalPool: MockConsonant[];
}

interface BatchConfig {
  nonFoundationalFocusCount: number; // words pulled per batch from wordPool
  foundationalFocusCount: number;    // words pulled per batch from foundationalPool
  questionLimit: number;             // total questions per batch
}

interface Batch {
  focusWords: MockWord[];
  focusFoundational: MockConsonant[];
  questionLimit: number;
}
```

#### New engine function — `src/engine/compose-deck.ts`

`generateBatches(deck: Deck, config: BatchConfig): Batch[]`

Algorithm:
1. `batchCount = Math.ceil(deck.wordPool.length / config.nonFoundationalFocusCount)`
2. For each `i`: slice `focusWords` and `focusFoundational` sequentially
3. If foundational pool is shorter than wordPool, remaining batches get an empty `focusFoundational` (noted as future concern — not a ST06 failure case given equal pool sizes)

#### `runInteractive` return value

Update signature to return `{ correct: number, total: number }` instead of `void`.

#### New runner function — `runBatchLoop` (in `src/runner/interactive.ts`)

```
for each batch (index i):
  compose questions via composeBatchMulti (consonant half + word half, split from questionLimit)
  run runInteractive → { correct, total }
  show: "Batch i+1 score: X / Y"
  if not last batch: prompt "Next batch? (y/n)" — 'n' ends the run early
after all batches (or early exit):
  show run summary: "=== Run Complete === Batches: N  Score: X / Y"
```

#### `main.ts` wiring

Testing config (hardcoded for ST06):

```ts
const deck: Deck = {
  wordPool: mockWords.slice(0, 3),
  foundationalPool: mockConsonants.slice(0, 3),
};

const batchConfig: BatchConfig = {
  nonFoundationalFocusCount: 1,
  foundationalFocusCount: 1,
  questionLimit: 2,
};
```

#### Files changed

| File | Change |
|---|---|
| `src/types/deck.ts` | New — `Deck`, `BatchConfig`, `Batch` types |
| `src/engine/compose-deck.ts` | New — `generateBatches` |
| `src/runner/interactive.ts` | `runInteractive` returns score; add `runBatchLoop` |
| `src/main.ts` | Replace flat config with `Deck` + `BatchConfig`; call `runBatchLoop` |
| `src/__tests__/unit/compose-deck.test.ts` | New — `generateBatches` unit tests |

#### Unit tests — `compose-deck.test.ts`

- Returns correct number of batches (`ceil(wordPool.length / nonFoundationalFocusCount)`)
- Each batch has the right `focusWords` and `focusFoundational` counts
- Batches cover all words in `wordPool` with no repeats
- Each batch carries the correct `questionLimit`

#### Roadmap note (not in scope)

| Story | Scope |
|---|---|
| ST07 | `WordState` — tracks seen count + correct count per word, carried through the run |
| ST08 | Dynamic batch selection — use `WordState` to prioritise weak words (design TBD) |

#### Success criteria

1. `pnpm --filter @gll/srs-engine-v2 test` — all tests pass
2. `pnpm quizv2` — 3 batches of 2 questions, per-batch score after each, "Next batch?" prompt, run summary at end
3. Changing `batchConfig.questionLimit` or pool sizes requires editing one place

**Status**: Done

---

### EP20-ST07: WordState — per-word tracking across the run

**Scope**: Introduce `WordState` to track how many times each word has been seen and
answered correctly. State is built up across all batches in a run and shown as a
per-word summary after each batch (for words covered in that batch).

#### Type change — `QuizQuestion`

Add `wordId: string` to `QuizQuestion` (populated from `item.id` in `composeBatch`).
This lets the runner attribute each answered question to a specific word.

#### New file — `src/types/word-state.ts`

```ts
interface WordState { wordId: string; seen: number; correct: number }
type RunState = Map<string, WordState>
function updateRunState(state: RunState, wordId: string, wasCorrect: boolean): RunState
```

`updateRunState` is a pure function — takes existing state, returns new state with
the given word's `seen` incremented (always) and `correct` incremented (if correct).

#### `runInteractive` return value

Change from `{ correct, total }` to `{ correct, total, results: { wordId: string; correct: boolean }[] }`.

#### `runBatchLoop`

- Initialise a `RunState` before the batch loop
- After each batch: call `updateRunState` for each result; print per-word summary
  for words covered in that batch
- Run summary at end unchanged (aggregate score)

#### Per-batch word summary format

```
Word results:
  th::หิว   seen: 2  correct: 1
  th::ก     seen: 1  correct: 1
```

#### Files changed

| File | Change |
|---|---|
| `src/types/quiz.ts` | Add `wordId: string` to `QuizQuestion` |
| `src/types/word-state.ts` | New — `WordState`, `RunState`, `updateRunState` |
| `src/engine/compose-batch.ts` | Populate `wordId: item.id` in `composeBatch` |
| `src/runner/interactive.ts` | `runInteractive` returns `results`; `runBatchLoop` accumulates `RunState` + per-batch summary |
| `src/__tests__/unit/word-state.test.ts` | New — `updateRunState` unit tests |
| `src/__tests__/unit/compose-batch.test.ts` | Update `QuizQuestion` constructions to include `wordId` |

#### Unit tests — `word-state.test.ts`

- `seen` increments on correct answer
- `seen` increments on wrong answer
- `correct` increments only on correct answer
- Multiple words tracked independently in the same `RunState`
- Starting from empty state creates a new entry

#### Success criteria

1. `pnpm --filter @gll/srs-engine-v2 test` — all tests pass
2. `pnpm quizv2` — after each batch, shows per-word seen/correct for words in that batch

**Status**: Done

---

### EP20-ST08: Adaptive loop — sliding window, mastery, retirement, run-until-exhausted

**Scope**: Replace the pre-computed `generateBatches` + `runBatchLoop` architecture with
a single `runAdaptiveLoop` that owns the full learning lifecycle per the new ADR. Words
move through a queue → active → mastered cycle. The run continues until all words are
mastered and both active and queue are empty.

**Supersedes**: the intent of the old ST08 (weak-word priority) and ST09 (mastery +
retirement), which were collapsed into this story after the ADR was rewritten.

**Reference**: [SRS Engine v2 — Learning Phase ADR](../../../product-documentation/architecture/20260319T000000Z-engineering-srs-engine-v2-learning-phase.md)

---

#### New pure function — `nextActivePool`

Extracted from the loop so it is unit-testable:

```ts
function nextActivePool(
  active: QuizItem[],
  queue: QuizItem[],
  questionLimit: number,
  runState: RunState,
): { active: QuizItem[]; queue: QuizItem[] }
```

Algorithm:
1. Retire mastered words from active (`isMastered` from `RunState`)
2. Count free slots: `questionLimit - active.length`
3. Pull `free_slots` words from the front of queue into active
4. Return updated `{ active, queue }`

Called once per batch — at the **end** of each batch after updating `RunState`.
New words enter active at end-of-batch; they receive their first question next batch.

---

#### `runAdaptiveLoop`

Replaces `runBatchLoop`. Owns all I/O.

```
initialise: active = [], queue = [...all words], runState = new Map()

loop:
  1. if active empty + queue empty → run complete, break
  2. compose questions from active (composeBatchMulti, questionLimit)
  3. runInteractive(questions) → { correct, total, results }
  4. update RunState from results
  5. print per-batch word summary (words covered this batch)
  6. detect newly mastered words → print "Mastered: X" for each
  7. nextActivePool(active, queue, questionLimit, runState) → new active + queue
  8. if active not empty or queue not empty → "Next batch? (y/n)"

print run summary: batches, total score, mastered count
```

---

#### `main.ts` config (replacing Deck + BatchConfig)

```ts
const config = {
  words: mockWords.slice(0, 6),
  questionLimit: 2,
  masteryThreshold: 3,
};
```

`masteryThreshold` passed into `isMastered` — currently hardcoded to `3`, configurable
by changing one constant.

---

#### Files changed

| File | Change |
|---|---|
| `src/runner/interactive.ts` | Replace `runBatchLoop` with `runAdaptiveLoop`; extract `nextActivePool` as exported pure function |
| `src/engine/compose-deck.ts` | `generateBatches` removed |
| `src/types/deck.ts` | `BatchConfig` and `Batch` removed; `Deck` removed or simplified |
| `src/types/word-state.ts` | Add `isMastered(ws: WordState, threshold: number): boolean` |
| `src/main.ts` | Replace `Deck` + `BatchConfig` + `generateBatches` + `runBatchLoop` with flat config + `runAdaptiveLoop` |
| `src/__tests__/unit/adaptive-loop.test.ts` | New — `nextActivePool` unit tests |
| `src/__tests__/unit/compose-deck.test.ts` | Removed — `generateBatches` no longer exists |
| `src/__tests__/unit/word-state.test.ts` | Add `isMastered` tests |

---

#### Unit tests — `nextActivePool`

- Returns unchanged active + queue when no words are mastered and active is full
- Retires a mastered word and pulls next from queue
- Retires multiple mastered words in one call and pulls the same number from queue
- Returns empty queue when queue is exhausted
- Returns active shorter than questionLimit when queue runs out
- Does not mutate input arrays

#### Unit tests — `isMastered`

- Returns `false` when `correct < threshold`
- Returns `true` when `correct === threshold`
- Returns `true` when `correct > threshold`
- Returns `false` on a fresh `WordState`

---

#### Success criteria

1. `pnpm --filter @gll/srs-engine-v2 test` — all tests pass
2. `pnpm quizv2` — run starts with 2 active words; new words enter one at a time as
   words master; "Mastered: X" printed on graduation; run ends automatically when all
   words mastered with a final summary
3. Matches the 10-batch scenario in the ADR (all correct, 6 words, questionLimit 2,
   mastery 3)

**Status**: Done

---

---

### EP20-ST09: Word Streaks and Mastery

**Scope**: Replace the binary `correct >= threshold` mastery model with a streak-driven
integer mastery system. `mastery` (0–5) rises with consecutive correct answers and falls
with consecutive wrong answers. Retirement is `mastery >= masteryThreshold`.

---

#### Updated `WordState` — `src/types/word-state.ts`

```ts
interface WordState {
  wordId: string;
  seen: number;           // cumulative — unchanged
  correct: number;        // cumulative — unchanged
  mastery: number;        // 0–5
  correctStreak: number;  // consecutive correct answers
  wrongStreak: number;    // consecutive wrong answers
}
```

#### Config additions — `main.ts`

```ts
const config = {
  ...
  masteryThreshold: 5,          // mastery level for retirement
  correctStreakThreshold: 3,    // correct streak needed to increment mastery
  wrongStreakThreshold: 2,      // wrong streak needed to decrement mastery
};
```

Pass `correctStreakThreshold` and `wrongStreakThreshold` into `updateRunState`.
Pass `masteryThreshold` into `isMastered`.

---

#### `updateRunState` logic

**On correct answer**:
- `seen += 1`, `correct += 1`
- `wrongStreak = 0`
- `correctStreak += 1`
- if `correctStreak >= correctStreakThreshold` → `mastery = Math.min(5, mastery + 1)`

**On wrong answer**:
- `seen += 1`
- `correctStreak = 0`
- `wrongStreak += 1`
- if `wrongStreak >= wrongStreakThreshold` → `mastery = Math.max(0, mastery - 1)`

Note: streaks are **not reset** after triggering a mastery change. Once a streak exceeds
the threshold, every subsequent answer in the same direction triggers another mastery change.

#### `isMastered` update

```ts
function isMastered(ws: WordState, threshold: number): boolean {
  return ws.mastery >= threshold;
}
```

---

#### Files changed

| File | Change |
|---|---|
| `src/types/word-state.ts` | Add `mastery`, `correctStreak`, `wrongStreak` to `WordState`; update `updateRunState` signature + logic; update `isMastered` |
| `src/main.ts` | Add `correctStreakThreshold`, `wrongStreakThreshold` to config; update `runAdaptiveLoop` call |
| `src/runner/interactive.ts` | Pass new thresholds through to `updateRunState`; update per-batch summary to show `mastery` |
| `src/__tests__/unit/word-state.test.ts` | Replace old `isMastered` tests; add streak + mastery increment/decrement scenarios |

---

#### Unit tests — `word-state.test.ts`

**`updateRunState` — streak behaviour**:
- `correctStreak` increments on correct, resets to 0 on wrong
- `wrongStreak` increments on wrong, resets to 0 on correct
- `seen` and `correct` cumulative counts unchanged

**`updateRunState` — mastery increment**:
- mastery unchanged when `correctStreak < correctStreakThreshold`
- mastery += 1 when `correctStreak === correctStreakThreshold`
- mastery += 1 on next correct when already above threshold (no reset)
- mastery capped at 5

**`updateRunState` — mastery decrement**:
- mastery unchanged when `wrongStreak < wrongStreakThreshold`
- mastery -= 1 when `wrongStreak === wrongStreakThreshold`
- mastery -= 1 on next wrong when already above threshold (no reset)
- mastery floored at 0

**`isMastered`**:
- returns `false` when `mastery < threshold`
- returns `true` when `mastery === threshold`
- returns `true` when `mastery > threshold`

---

#### Success criteria

1. `pnpm --filter @gll/srs-engine-v2 test` — all tests pass
2. `pnpm quizv2` — per-batch word summary shows `mastery` level; words retire at mastery 5; wrong streak visibly drops mastery in the summary

**Status**: Done

---

---

### EP20-ST10: Multi-deck support — WordPool + MockDeck + deck selection

**Scope**: Introduce a global `WordPool` and `MockDeck` type that reflects the real
conversation → line → words hierarchy. Replace the flat `mockWords` array in `main.ts`
with two conversation-based decks. Add a deck selection prompt to the runner before the
adaptive loop starts.

---

#### Design: WordPool vs Deck

`WordPool` is a **global** flat list of unique `MockWord` entries — the source of truth
for all words. It sits at the same level as (or above) decks, not inside one.

A `MockDeck` **references** words from the pool by ID. Mastery (via `RunState`) is keyed
by `wordId` and is therefore pool-level — a word mastered in deck 1 carries that mastery
into deck 2 (see ST11 for the re-check edge case).

```
WordPool (global)
  MockWord[]  ← one entry per unique word, across all conversations

MockDeck
  id, topic
  lines: MockLine[]    ← conversation context (enables future word_block questions)
  wordIds: string[]    ← references into WordPool for this deck's focus words
```

Relationship: word → pool is **1:1**; word → deck is **1:many** (a word can belong to
multiple decks). `MockLine.words` preserves per-line components including duplicates
across lines — mastery is not tracked per-line, only per pool entry.

---

#### New types — `src/types/deck.ts`

Replace existing `Deck` with:

```ts
interface MockLine {
  speaker: 'A' | 'B';
  native: string;        // thai sentence
  romanization: string;
  english: string;
  words: MockWord[];     // per-line word components (duplicates across lines expected)
}

interface MockDeck {
  id: string;
  topic: string;
  lines: MockLine[];     // full conversation — enables future word_block questions
  wordIds: string[];     // IDs of focus words for this deck (subset of WordPool)
}
```

---

#### New file — `data/mock/mock-word-pool.ts`

Global pool containing all unique words across both test conversations (deduplicated
union). This replaces the role of the old flat `mockWords` array for distractor purposes.

```ts
export const wordPool: MockWord[] = [ /* union of both conversations' unique words */ ];
```

---

#### New file — `data/mock/mock-decks.ts`

Two `MockDeck` instances built from `conversations-2026-03-08.json`:

| Deck | Topic | wordIds (first 6 from uniqueWords) |
|---|---|---|
| deck-1 | let's eat something | หิว, แล้ว, ไป, กิน, อะไร, กัน |
| deck-2 | The weather is hot today | วันนี้, ร้อน, มาก, เลย, ใช่, จริงๆ |

`lines` built by merging `breakdown[i]` (components) with `lines[i]` (speaker) from the
JSON — they are 1:1 correlated.

---

#### Runner change — `src/runner/interactive.ts`

Add `selectDeck(decks: MockDeck[]): Promise<MockDeck>`:

```
Available decks:
  1. Let's eat something
  2. The weather is hot today
Select a deck (1/2):
```

Reads a single keypress, returns the chosen deck.

---

#### `main.ts` wiring

```ts
import { wordPool } from '../data/mock/mock-word-pool.js';
import { mockDecks } from '../data/mock/mock-decks.js';
import { selectDeck } from './runner/interactive.js';

const deck = await selectDeck(mockDecks);
const words = deck.wordIds.map(id => wordPool.find(w => w.id === id)!);

await runAdaptiveLoop(
  words,
  wordPool,           // distractor pool — unchanged role
  mockConsonants,
  config.questionLimit,
  config.masteryThreshold,
  { correctStreakThreshold: config.correctStreakThreshold, wrongStreakThreshold: config.wrongStreakThreshold },
);
```

`runAdaptiveLoop` signature is **unchanged**.

---

#### Files changed

| File | Change |
|---|---|
| `src/types/deck.ts` | Replace `Deck` with `MockLine`, `MockDeck` types |
| `data/mock/mock-word-pool.ts` | New — global word pool (union of both conversations) |
| `data/mock/mock-decks.ts` | New — 2 `MockDeck` instances |
| `src/runner/interactive.ts` | Add `selectDeck` prompt |
| `src/main.ts` | Import decks + pool; deck selection; resolve wordIds; pass to `runAdaptiveLoop` |
| `src/__tests__/unit/mock-decks.test.ts` | New — deck shape + pool reference tests |

---

#### Unit tests — `mock-decks.test.ts`

- Each deck has a non-empty `topic`
- Each deck has exactly 6 `wordIds`
- All `wordIds` in each deck resolve to entries in `wordPool`
- No duplicate `wordIds` within a single deck
- Each deck has at least 1 `MockLine`
- Each `MockLine` has at least 1 word in `words`
- Words shared between decks exist exactly once in `wordPool`

---

#### Success criteria

1. `pnpm --filter @gll/srs-engine-v2 test` — all tests pass
2. `pnpm quizv2` — shows deck selection prompt; selected deck's 6 words run through
   adaptive loop; behaviour otherwise identical to ST09
3. Adding a third deck requires editing only `mock-decks.ts`

**Status**: Done

---

### EP20-ST11: Re-check mastered words on new deck entry

**Status**: Planned (design agreed, not yet scoped)

#### Design context

Mastery is pool-global — a word mastered in deck 1 carries that state into deck 2.
This is correct for normal use, but creates a gap: a user returning after a long absence
(e.g. 2 years) would never see a previously mastered word again, even if forgotten.

#### Agreed behaviour (option C)

When a deck is loaded, words in `deck.wordIds` that are **already mastered** in the
current `RunState` are given a one-time **re-check**:

- Re-check questions are **mixed into the first batch** (not a separate phase)
- **Correct on first attempt** → word stays mastered, not shown again in this run
- **Incorrect on first attempt** → word re-enters the active pool for another chance
- **Incorrect on second attempt** → normal wrong-streak rules apply (mastery decrements)

If mixing re-check into the first batch proves too complex, a pre-run phase is acceptable
as a fallback.

#### Open design questions (to resolve at planning time)

- How is a "re-check word" flagged so the runner handles it differently from active pool words?
- Does the re-check count against the `questionLimit` for batch 1, or is it additive?
- At what point in the session lifecycle is the re-check list computed?

---

## Deferred

- FSRS / ANKI scheduling
- Stuck word shelving
- Foundational continuous-wrong reset rule
- Hono route wiring

## Next Steps

1. ✅ ST01 — Mock seed data complete
2. ✅ ST02 — Project scaffold + test harness complete
3. ✅ ST03 — Batch composition, 1 consonant, 4 MC directions, interactive runner
4. ✅ ST04 — Batch composition, N foundational words, configurable question limit
5. ✅ ST05 — Non-foundational words in the mix, QuizItem union, config object
6. ✅ ST06 — Deck + Batch architecture, batch loop runner, run summary
7. ✅ ST07 — WordState: per-word seen/correct tracking across the run, per-batch summary
8. ✅ ST08 — Adaptive loop: sliding window, mastery, retirement, run-until-exhausted
9. ✅ ST09 — Word streaks and mastery: integer mastery 0–5, streak-driven increment/decrement
10. ⬜ ST10 — Multi-deck support: WordPool + MockDeck + deck selection
11. ⬜ ST11 — Re-check mastered words on new deck entry

