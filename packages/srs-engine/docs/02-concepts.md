# How the SRS Engine Works — Conceptual View

> For: New developers, architects joining the project  
> Depth: How the pieces fit together; enough to reason about the design

---

## The two containers: Active Pool and Queue

All words start in a **queue** — unseen, waiting. A small subset is pulled into the **active pool** (size controlled by `wordsPerBatch`). Every batch is composed entirely from this active pool; the queue doesn't get touched mid-batch.

When a word graduates (reaches mastery), it leaves the active pool. The freed slot is filled from the queue at the **end** of the batch — so the incoming word gets its first question in the *next* batch, never mid-flight. This prevents a brand new word from arriving already carrying a deficit of unseen answers within the same batch.

The session ends when both pools are empty: `active.length === 0 && queue.length === 0`.

---

## Foundational items: a distinct item type

The engine distinguishes two categories of active items:

- **Vocabulary words** (`MockWord`) — curated deck content
- **Foundational items** (`MockFoundational`) — consonants, vowels, tones; the script building blocks

Both share the same `QuizItem` union type and go through the same `RunState` / streak / mastery cycle. The difference is in `assembleBatch` (`src/learn/engine/assemble-batch.ts:28-38`):

```ts
const activeFoundational = active.filter(item => 'foundationalType' in item);
const activeWords        = active.filter(item => !('foundationalType' in item));

const foundationalLimit = Math.round((wordsPerBatch * activeFoundational.length) / active.length);
const wordLimit = wordsPerBatch - foundationalLimit;
```

Question slots are **proportionally split** based on how many of each type are in the active pool. If 2 of 6 active items are foundational, foundational items get ~⅓ of the question slots.

Foundational items also get different question directions (`FOUNDATIONAL_DIRECTIONS` in `src/learn/engine/compose-word-batch.ts`):

| Type | Directions |
|---|---|
| Consonant, Vowel | native↔english, native↔romanization (4 total) |
| Tone | native↔english only (2 total) — no romanization testing |

---

## RunState: the per-word score sheet

`RunState` is a `Map<wordId, WordState>`. Each entry tracks:

| Field | Meaning |
|---|---|
| `seen` | Total times the word was presented |
| `correct` | Total correct answers |
| `mastery` | Integer 0–5 — the only field that controls retirement |
| `correctStreak` | Consecutive correct answers |
| `wrongStreak` | Consecutive wrong answers |

`RunState` is **ephemeral** — it lives only for the duration of a session. The calling layer (server, CLI) is responsible for persistence if needed. The engine itself is stateless.

Mastery is **global** — `RunState` is keyed on `wordId` alone, with no `deckId`. The same word appearing in two different decks maps to the same `WordState`. Once mastered, a word does not reappear in any deck's active pool. (`wordId` format: `th::native_form`, e.g. `th::หิว`.)

---

## How streaks drive mastery

The rule (`updateRunState` in `src/learn/types/word-state.ts`):

- **Correct answer**: `correctStreak++`, `wrongStreak = 0`. Once `correctStreak >= correctStreakThreshold` → `mastery = min(5, mastery + 1)`
- **Wrong answer**: `wrongStreak++`, `correctStreak = 0`. Once `wrongStreak >= wrongStreakThreshold` → `mastery = max(0, mastery - 1)`

Crucially: **streaks are never reset after a mastery change**. If a streak hits the threshold and bumps mastery, the streak continues accumulating. This lets a well-known word climb quickly and lets a shaky word fall quickly — without artificial dampening.

Retirement check: `ws.mastery >= masteryThreshold` (default: 5).

---

## The recheck loop

Wrong answers don't disappear — they re-enter the question queue within the same batch, up to a cap (`retryPerWordCap` per batch, `retryPerSessionCap` across the whole session). This is the **recheck mechanic** managed by `BatchState` in `src/learn/engine/batch-queue.ts`.

`retryPerSessionCap` is tracked per word in `AdaptiveSessionState.sessionRetryCounts`, accumulated across batches by `finishBatch`/`advanceAdaptiveSession`. Once a word's cumulative retries hit the cap, it stops getting re-served within a batch — but this budget isn't permanent: `advanceAdaptiveSession` clears a word's `sessionRetryCounts` entry as soon as its `correctStreak` reaches `correctStreakThreshold` again, giving it a full retry allowance on the next batch. Without this reset, a word that struggled for several batches early on would stay retry-starved for the rest of the session even after the learner started getting it right.

The recheck mechanic uses two sets that track a word across its re-appearances:

- **`recheckPending`**: word's first re-appearance. `processRecheckResult` suppresses streak/mastery updates — only `seen` and `correct` increment. Protects against a mis-tap killing a streak.
- **`recheckReentered`**: word that *failed* its first re-appearance. Normal scoring resumes, but the word is added to `recheckExempt` passed into `nextActivePool` — blocking retirement even if `mastery >= masteryThreshold`. The word stays active until it genuinely masters. Removed from `recheckReentered` only when `isMastered` returns true on a subsequent answer.

Both sets are union'd when calling `nextActivePool`: `new Set([...recheckPending, ...recheckReentered])` (`adaptive-session.ts:81`). This ensures neither recheck stage can be prematurely retired mid-recovery.

---

## Question composition: words and sentences

The engine has two sibling composers:

**`composeWordBatch`** — generates one question per direction for a single item.  
`composeWordBatchMulti` wraps it across multiple active words within a `questionLimit`.

| Type | Directions |
|---|---|
| Consonant, Vowel, Word | native↔english, native↔romanization (4 total) |
| Tone | native↔english only (2 total) |

Distractors are drawn from the **full word pool**, not just the active pool — keeping choices plausible regardless of how small the active group is.

**`composeSentenceBatch`** — generates word-block construction questions from a `SentenceContext`.

A sentence becomes eligible when all its words have `WordState.seen >= minSeenForSentence` (default: 2). Mastery is not required. The composer produces 3 directions:
- english-to-native (arrange tiles to match English prompt)
- native-to-english (arrange tiles to match native prompt)
- romanization-to-native (arrange tiles to match romanized prompt)

Tiles are shuffled; the `answer` is the correct `wordId` sequence. Sentence correctness does **not** affect `WordState.mastery` — word and sentence mastery tracks are independent.

**Language config**: `composeSentenceBatch` uses `LANGUAGE_CONFIG` (`src/config/language.ts`) to join native script tiles correctly. Languages like Thai, Japanese, Chinese, and Korean use `wordJoin: 'no-space'` — tiles are concatenated without spaces in the native prompt. Romanization is always space-separated regardless of language.

---

## Session lifecycle (the full chain)

```
initAdaptiveSession(words, config, sentenceContexts)
  ↓
  active ← first N words from words list
  queue  ← remainder
  SentenceRunState ← initialized empty

Per batch:
  assembleBatch(active, wordPool, foundationalPool, wordsPerBatch, {
    extraThunks: [
      () => composeSentenceBatch(ctx1, tiles1),
      () => composeSentenceBatch(ctx2, tiles2),
      ...
    ]
  }) → QuizQuestion[]
  initBatchState(questions, retryConfig) → BatchState

  Per question:
    nextQuestion(batchState)              → question + new BatchState
    submitBatchResult(batchState, result) → new BatchState
      (wrong answer? re-enqueue up to retry cap)
      (kind: 'mcq' or 'word-block')
  
  finishBatch(batchState)                → BatchOutput

advanceAdaptiveSession(sessionState, batchOutput, config)
  → updateMasteryState  → processRecheckResult per word result
  → updateSentenceRunState → streak logic per sentence result
  → nextActivePool      → retire mastered words, fill from queue
  → new AdaptiveSessionState

Repeat until active.length === 0 && queue.length === 0
```

**Key points:**
- Word and sentence questions are mixed in a single batch via `assembleBatch` + composer registry
- Wrong answers of either kind re-queue within the batch (subject to per-word, per-session caps)
- Sentence results do not affect `WordState.mastery` — they update `SentenceRunState` only
- Sentence eligibility is checked per batch; eligible sentences are passed as `extraThunks` to assembly

---

## Shelving: the stagnation relief valve

Shelving lives in `src/shelving/` (`@gll/srs-engine/shelving`), independent of the Learning types above — `evaluateShelving` takes primitive `stagnantWordIds`/`currentlyShelved`/`config`, never a `RunState` or `WordState`. Detecting *which* words are stagnant is the host's job (e.g. "no mastery progress for `stagnationBatchWindow` consecutive batches"); the module only decides what to do once candidates are handed to it.

```ts
evaluateShelving(stagnantWordIds: string[], currentlyShelved: Set<string>, config: ShelvingConfig): ShelvingDecision
```

- Filters out anything already in `currentlyShelved` — no re-shelving a word that's already off to the side.
- Caps how many it shelves this call by `config.maxShelved - currentlyShelved.size` — shelving is a relief valve with a fixed number of slots, not an unlimited escape hatch.
- Preserves input order when trimming candidates down to available slots.
- `toUnshelve` is always empty from this function — unshelving (bringing every shelved word back into rotation) is the separate `unshelveAll()` helper, called by the host at session boundaries (e.g. "a new session always brings previously shelved words back in").

`DEFAULT_SHELVING_CONFIG` ships as `{ stagnationBatchWindow: 3, maxShelved: 2 }`, both overridable per host.

## Review: long-term scheduling with FSRS

Once a word masters, it graduates out of Learning into Review — long-term spaced repetition, distinct from the streak/mastery cycle above. This lives in `src/review/` (`@gll/srs-engine/review`) and is intentionally **server-only**: `apps/srs-demo` never imports it (ADR D3) — only `apps/server` schedules and serves due reviews.

The module is built around one contract, `ReviewScheduler`, with `FsrsScheduler` (wrapping `ts-fsrs`) as its only implementation:

```ts
interface ReviewScheduler {
  seed(wordId: string, performance: GraduationPerformance, now: Date): ReviewCard;
  schedule(card: ReviewCard, rating: ReviewRating, now: Date): ReviewCard;
  isDue(card: ReviewCard, now: Date): boolean;
}
```

- **`seed`** creates a word's first `ReviewCard` at the moment it graduates from Learning, inferring an initial `ReviewRating` (`again` | `hard` | `good` | `easy`) from its `GraduationPerformance` — `correctStreak`, `lapses`, `correctRatio` — never `again`, since graduation already implies success.
- **`schedule`** advances a card after a review is answered, given the (inferred, never asked) rating for that review.
- **`isDue`** is a pure time check against the card's `due` date.
- `ReviewCard.schedulerData` is an opaque blob — only `FsrsScheduler` reads or writes its shape (the serialised `ts-fsrs` `Card`). Persistence round-trips it as-is; nothing outside the scheduler inspects it.

The `review` module never imports `WordState` or anything from `learn/` — `GraduationPerformance` is a primitive snapshot the host derives from `WordState` at the graduation boundary, keeping Review decoupled from how Learning tracks progress.

---

## The boundary: engine vs. host

The engine defines **rules**. The host (Vue app, CLI, server) owns **state**.

- `AdaptiveSessionState` — held by the host between batches
- `BatchState` — held by the host between questions
- `RunState` — inside `AdaptiveSessionState`, passed back and forth

No I/O, no timers, no side effects inside any engine function. Everything is a pure function: same inputs → same outputs.
