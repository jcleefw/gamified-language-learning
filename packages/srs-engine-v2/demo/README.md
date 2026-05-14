# srs-engine-v2 Demo

## Running the demo

```bash
pnpm --filter @gll/srs-engine-v2 exec tsx demo/learning-runner.ts
```

To change configuration, edit `demo/config.ts`.

---

## Terminology

### Active window

The set of words currently being studied in a session. Size is controlled by `wordsPerBatch` in `LEARNING_CONFIG`. A word stays in the active window until it is mastered, at which point it is retired and the next word from the queue takes its slot.

### Queue

Words waiting to enter the active window. Words are promoted from queue → active one at a time as slots free up through mastery.

### Batch

One round of questions served to the learner. A batch is composed from the active window — each active word generates one or more questions via the composer registry. After ST03, batch length is **variable**: re-serve retries can extend it beyond `wordsPerBatch`.

### `wordsPerBatch`

How many word items can be in the active window at once. This is a **slot count**, not a question count. Set to `3` by default.

After the re-serve loop is implemented (ST03), a single batch may contain more than `wordsPerBatch` questions because wrong answers are re-queued within the batch. `wordsPerBatch` bounds the *words in play*, not the *questions asked*.

### `questionLimit` (composer option)

A separate concept from `wordsPerBatch`. The `{ questionLimit }` option on `composeWordBatchItems` caps the number of MCQ questions that composer generates from a given word set. Lives in the engine layer (`compose-word-batch.ts`) and is unrelated to active window size.

### Re-serve loop (ST03, upcoming)

After a wrong answer, the identical question is re-queued within the current batch. Controlled by two caps:

| Constant | Scope | Default |
|---|---|---|
| `maxRetryPerWord` | Per batch — max re-serves for one word within a single batch | 2 |
| `maxRetryPerSession` | Per session — max re-serves for one word across the entire `runAdaptiveLoop` call | 6 |

Words that exhaust `maxRetryPerWord` carry over to the next batch. Words that exhaust `maxRetryPerSession` are shelved for the session.

### Composer registry

The session layer registers each active composer as a pre-bound thunk `() => QuizQuestion[]` before calling `assembleBatchQuestions(registry)`. This produces a flat merged `QuizQuestion[]` without any direct coupling between composers. Adding a new question type (e.g. audio) is a registration, not a change to session logic.

### `SentenceState` (ST04/ST05, upcoming)

Per-sentence tracking required for spacing and shelving rules. Distinct from `WordState` — sentence mastery and word mastery are independent tracks.

| Field | Purpose |
|---|---|
| `sentenceStreak` | Consecutive correct answers — streak-based exit |
| `lastBatchSeen` | Batch sequence number — prevents back-to-back appearances |
| `dailyCount` | Times served this session (session = day in demo) — daily cap |
| `sessionWrongStreak` | Consecutive wrong answers this session — auto-shelve trigger |
| `active` | Whether the sentence is in the active pool |

---

## Config reference (`demo/config.ts`)

| Key | Type | Description |
|---|---|---|
| `wordsPerBatch` | number | Active window size — words in play per batch |
| `masteryThreshold` | number | Mastery score required to retire a word |
| `maxMastery` | number | Maximum mastery score |
| `correctStreakThreshold` | number | Correct streak needed to increment mastery |
| `wrongStreakThreshold` | number | Wrong streak needed to decrement mastery |
| `minSeenForSentence` | number | Min `seen` count before a sentence question becomes eligible |
| `debugSentenceEligibility` | boolean | When `true`, all sentence questions are eligible regardless of `seen` count |
| `AUTO_MODE` | boolean | When `true`, runs with an auto-answer strategy (no keyboard input) |
