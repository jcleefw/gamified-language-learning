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

## Deferred (post-EP20)

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

