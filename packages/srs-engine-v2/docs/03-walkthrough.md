# How the SRS Engine Works — Walkthrough View

> For: You (the builder), when you need to reason through the algorithm  
> Depth: Step-by-step with an annotated example, word from New → Mastered

---

## Setup for this walkthrough

```
Deck:                    [w1, w2, w3]
wordsPerBatch:           2
masteryThreshold:        5
correctStreakThreshold:  3  (3 correct in a row → mastery +1)
wrongStreakThreshold:    2  (2 wrong in a row → mastery -1)
retryPerWordCap:         2  (re-quiz wrong words up to 2x per batch)
```

**wordId format**: IDs follow `language::native_form`, e.g. `th::หิว` (Thai: "hungry"). The same wordId is used whether the word appears in deck A or deck B — mastery is global, not per-deck.

In this walkthrough, w1/w2/w3 are shorthand. In real data they'd be `th::หิว`, `th::กิน`, etc.

---

## Batch 1: Introduction

**State before batch:**
```
active: []
queue:  [w1, w2, w3]
runState: {} (empty)
```

`initAdaptiveSession` pulls `wordsPerBatch = 2` words from queue into active:

```
active: [w1, w2]
queue:  [w3]
runState: {} (still empty—no words seen yet)
```

`assembleBatch` / `composeWordBatchMulti` generates questions. For a 2-word active pool and `questionLimit=4`, we'd get ~2 questions each:

```
q1: w1 (native → english)
q2: w2 (native → english)
q3: w1 (english → native)
q4: w2 (english → native)
```

**User answers:** w1 ✓, w2 ✓, w1 ✓, w2 ✓ (all correct)

`updateMasteryState` applies each result:
- w1 first correct → `correctStreak=1, wrongStreak=0, mastery=0` (not yet at threshold)
- w2 first correct → `correctStreak=1, wrongStreak=0, mastery=0`
- w1 second correct → `correctStreak=2, wrongStreak=0, mastery=0` (need 3)
- w2 second correct → `correctStreak=2, wrongStreak=0, mastery=0`

**State after batch:**
```
runState: {
  w1: {seen: 2, correct: 2, mastery: 0, correctStreak: 2, wrongStreak: 0},
  w2: {seen: 2, correct: 2, mastery: 0, correctStreak: 2, wrongStreak: 0}
}
active: [w1, w2]  (no retirements—neither has mastery ≥ 5)
queue:  [w3]
batchNum: 1
```

---

## Aside: Foundational items in the same batch

In a real session, the active pool may contain both vocabulary words and foundational items (consonants, vowels, tones). Suppose:

```
active: [w1, w2, consonant-ก]
wordsPerBatch: 3
```

`assembleBatch` splits the pool:
```
activeFoundational: [consonant-ก]  (1 of 3 items)
activeWords:        [w1, w2]       (2 of 3 items)

foundationalLimit = round(3 * 1/3) = 1
wordLimit         = 3 - 1 = 2
```

Questions generated:
```
1 question from composeWordBatchItems([consonant-ก], foundationalPool, { questionLimit: 1 })
2 questions from composeWordBatchItems([w1, w2],    wordPool,         { questionLimit: 2 })
```

The consonant gets 4 possible directions (native↔english, native↔romanization), but only 1 slot, so a random direction is picked. A tone item would only have 2 directions to choose from (no romanization testing).

Both foundational items and vocabulary words flow through the same `RunState`, streak rules, and retirement logic — there's no separate mastery counter for foundational types.

---

## Batch 2: Approaching mastery

**State before:**
```
active: [w1, w2]
queue:  [w3]
runState: { w1: {seen: 2, correct: 2, mastery: 0, correctStreak: 2, ...}, ... }
```

More questions on w1 and w2. **User answers:** w1 ✓, w2 ✓, w1 ✓, w2 ✗

Processing results:
- w1 third correct → `correctStreak=3 >= 3` → **mastery goes 0→1**. Streaks don't reset, so `correctStreak` remains 3 for tiebreaking.
- w2 third correct → `correctStreak=3 >= 3` → **mastery goes 0→1**
- w1 fourth correct → `correctStreak=4, wrongStreak=0, mastery=1` (streak continues)
- w2 wrong answer → `correctStreak=0, wrongStreak=1, mastery=1` (no mastery change yet; need 2 wrongs)

The wrong w2 answer also re-enqueues w2 in the batch queue (up to `retryPerWordCap`).

**State after batch:**
```
runState: {
  w1: {seen: 4, correct: 4, mastery: 1, correctStreak: 4, wrongStreak: 0},
  w2: {seen: 4, correct: 3, mastery: 1, correctStreak: 0, wrongStreak: 1}
}
active: [w1, w2]  (still both active—not retired)
queue:  [w3]
batchNum: 2
```

---

## Batch 3: First retirement

**State before:**
```
active: [w1, w2]
queue:  [w3]
runState: { w1: {mastery: 1, ...}, w2: {mastery: 1, ...} }
```

More questions. **User answers:** w1 ✓, w1 ✓, w2 ✓, w2 ✓

Processing:
- w1 first correct → `correctStreak=5`, but mastery stays at 1 (streak increments don't automatically bump mastery)
- w1 second correct → `correctStreak=6 >= 3` → mastery goes 1→2 (yes, it bumps again—we're riding the streak)
- w2 first correct → `correctStreak=1` (reset from previous wrong)
- w2 second correct → `correctStreak=2 >= 3`? No, not yet.

Simplified, after batch:
```
runState: {
  w1: {seen: 6, correct: 6, mastery: 2, correctStreak: 6, wrongStreak: 0},
  w2: {seen: 6, correct: 5, mastery: 1, correctStreak: 2, wrongStreak: 0}
}
```

**Active pool retirement step:**

`nextActivePool` filters the active pool by `isMastered(ws, masteryThreshold=5)`:
- w1: mastery=2 < 5 → stays active
- w2: mastery=1 < 5 → stays active

No retirements yet. Check free slots: `freeSlots = wordsPerBatch - active.length = 2 - 2 = 0`. No new words from queue.

```
active: [w1, w2]
queue:  [w3]
batchNum: 3
```

---

## Batches 4–5: Climbing

(Assume user answers perfectly.)

**Batch 4:**
- w1: two more correct → `mastery=2→3` and `mastery=3→4` (streak climbs, mastery climbs)
- w2: three more correct → `correctStreak` reaches threshold again → `mastery=1→2`

**Batch 5:**
- w1: two more correct → `mastery=4→5` 🎓 **w1 MASTERS**
- w2: two more correct → `mastery=2→3`

After batch 5:
```
runState: {
  w1: {mastery: 5, ...},  ← w1 now meets masteryThreshold
  w2: {mastery: 3, ...}
}
```

**Retirement & slot filling:**

`nextActivePool` processes:
- w1: mastery=5 >= masteryThreshold=5 → **retire** ✓
- w2: mastery=3 < 5 → stays active

Active becomes `[w2]` (one word left). Free slots: `freeSlots = 2 - 1 = 1`.

Fill 1 slot from queue: pull w3.

```
active: [w2, w3]  (w1 is gone)
queue:  []
batchNum: 5
```

---

## Batch 6+: w3's journey

**Batch 6:**
- w2: continues climbing toward mastery
- w3: first appearance; `seen=1, correct=0 or 1` depending on user's answer
- (repeat until w2 masters)

When w2 reaches mastery 5, it retires. w3 moves into the active pool alone.

```
active: [w3]
queue:  []
```

Since queue is empty, no new words come in. w3 keeps getting quizzed until it masters.

**Final batch:**
- w3: final questions; reaches mastery 5
- active becomes empty

```
active: []
queue:  []
```

**Session terminates.** All 3 words mastered. `advanceAdaptiveSession` detects terminal condition and returns a final state that the host recognizes as "done."

---

## Batches with Sentence Questions

**Starting from Batch 6 (w2 and w3 active):**

Assume we have a sentence context available:
```
SentenceContext {
  sentenceId: "sent::001",
  englishSentence: "I'm hungry",
  wordOrder: ["th::หิว"] (w2's wordId)
}
```

For w2 to trigger a sentence question, it needs `seen >= minSeenForSentence` (default: 2). After Batch 5, w2 has `seen >= 5`, so it's eligible.

`resolveEligibleContexts` filters the sentence corpus:
- Check: all words in `wordOrder` have `seen >= 2`? ✓ w2 qualifies
- Check: sentence not shelved (`active === true`)? ✓
- Check: batch gap respected (`batchNum - lastBatchSeen > sentenceBatchGap`)? ✓ (first appearance, `lastBatchSeen = -1`)

The session registers a thunk for this sentence:
```
registry.add(() => composeSentenceBatch(ctx, resolvedTiles))
```

`composeSentenceBatch` generates 3 word-block directions:
```
q1: english-to-native
    prompt: "I'm hungry"
    tiles: [shuffled w2 tile]
    answer: [w2's wordId]

q2: native-to-english
    prompt: "หิว" (w2 native)
    tiles: [shuffled w2 tile]
    answer: [w2's wordId]

q3: native-to-romanization
    prompt: "hǐw" (w2 romanized)
    tiles: [shuffled w2 tile]
    answer: [w2's wordId]
```

`assembleBatch` merges word questions + sentence questions into one batch:

```
q1: w2 native→english (MCQ)
q2: w3 native→english (MCQ)
q3: Sentence "I'm hungry" english→native (word-block)
q4: w2 english→native (MCQ)
q5: w3 english→native (MCQ)
q6: Sentence "I'm hungry" native→english (word-block)
... (shuffled)
```

**User answers:** w2 ✓, w3 ✓, sent ✓, w2 ✓, w3 ✗, sent ✗ (then re-queue w3 and sent)

Processing results:
- w2 correct → `WordState` update (streak/mastery)
- w3 correct → `WordState` update
- sent correct → `SentenceRunState` update: `sentenceStreak=1, sessionWrongStreak=0, lastBatchSeen=6`
- w2 correct → `WordState` update
- w3 wrong → `WordState` update (streak drops), re-enqueue in batch
- sent wrong → `SentenceRunState` update: `sentenceStreak=0, sessionWrongStreak=1`, no re-enqueue yet

w3 and sent re-serve in the same batch (up to `maxRetryPerWord` and `maxRetryPerSession` caps).

**Key difference from word questions:**
- Sentence results do NOT affect `WordState.mastery`
- Sentence state has its own streak: `sentenceCorrectStreakThreshold` (default: 3) correct answers → `active=false` (shelved)
- Sentence state also tracks `sessionWrongStreakThreshold` (default: 3) wrong answers → `active=false` (shelved)
- Shelved sentences do not re-queue, even if wrong answers remain
- Spacing rule: sentence not served in back-to-back batches (`lastBatchSeen` checked against current `batchNum`)

After sentence retires (`sentenceStreak >= 3`), it moves to FSRS review scheduling — see [Batch N: Shelving and Review](#batch-n-shelving-and-review) below.

---

## Batch N: Shelving and Review

**Shelving — a word gets stuck.** Suppose w4 (not in the original 3-word deck; imagine a longer session) has been wrong for 3 consecutive batches with no mastery progress — the host's `stagnationBatchWindow` default. The host, not the engine, decides w4 is stagnant and calls into `@gll/srs-engine-v2/shelving`:

```ts
evaluateShelving(['th::w4'], currentlyShelved, DEFAULT_SHELVING_CONFIG)
// currentlyShelved is empty, maxShelved is 2 → 2 slots available
// → { toShelve: ['th::w4'], toUnshelve: [] }
```

The host removes `th::w4` from `active`, and it stops being served — the practice session keeps moving with the words that remain. `runState` for w4 is untouched; it isn't retired, just parked. A later session start calls `unshelveAll()`, and the host merges the previously-shelved IDs back into that session's initial `active`/`queue` split — w4 gets another shot, without carrying the shelving decision itself.

**Review — w1 graduates from Learning.** Back in the main walkthrough, w1 reached `mastery: 5` in Batch 5 and retired from `active`. That's where Learning's job for w1 ends and Review's begins. The host derives a `GraduationPerformance` snapshot from w1's final `WordState` and hands it to `@gll/srs-engine-v2/review`:

```ts
const performance: GraduationPerformance = { correctStreak: 6, lapses: 0, correctRatio: 1.0 };
const scheduler = new FsrsScheduler();
const card = scheduler.seed('th::หิว', performance, new Date());
// lapses === 0 && correctStreak >= 4 (EASY_STREAK) → seeded as 'easy'
// → { wordId: 'th::หิว', due: <a few days out>, schedulerData: <ts-fsrs Card> }
```

The host persists `card` (its `schedulerData` is opaque — never inspected outside `FsrsScheduler`) and later, when `isDue(card, now)` is true, presents w1 for review. Whatever the learner does on that review maps to an inferred `ReviewRating`, and `scheduler.schedule(card, rating, now)` returns the next `ReviewCard` with a new `due` date — further out on a good answer, pulled back in on `again`. None of this touches `active`/`queue`/`RunState` — Review runs on its own persisted `ReviewCard`, entirely decoupled from the Learning session that produced it.

---

## Key dynamics

### Streak behavior

- Streaks don't reset after mastery bumps. A word with `correctStreak=6` that bumps from mastery 3→4 **keeps** `correctStreak=6`, not reset to 0. This allows continuous momentum.
- If a word answers correctly 4 times, wrong 1 time, the `correctStreak` resets to 0 *immediately*, and if the word then answers wrong again, `wrongStreak` will trigger a mastery drop.

### Wrong answers and retries

- A word answered wrong goes back into the current batch's queue.
- On its **first re-appearance** (`recheckPending` set): streak/mastery update suppressed — only `seen` and `correct` increment. One mis-tap doesn't nuke a word's streak.
- On its **second+ re-appearance**: normal streak rules apply.

If a word fails even the first suppressed re-attempt, it moves into `recheckReentered`. This has one key consequence: the word is **blocked from retirement** by `nextActivePool` even if its `mastery >= masteryThreshold`. It stays active until it genuinely answers correctly enough to master. Only then is it removed from `recheckReentered` and allowed to retire.

Concretely — both sets are union'd into `recheckExempt`:
```ts
// adaptive-session.ts:81
nextActivePool(active, queue, wordsPerBatch, runState, masteryThreshold,
  new Set([...recheckPending, ...recheckReentered])
)
```
Any word in either set is exempt from retirement that batch.

### Session retry cap and its reset

`sessionRetryCounts` (`AdaptiveSessionState`) tracks, per word, how many retries it has used across the *whole session* (not just the current batch). `finishBatch` accumulates a batch's retries into the running total; once a word's total reaches `maxRetryPerSession`, `submitBatchResult` stops re-enqueueing it on wrong answers for the rest of the session — even though its per-batch `maxRetryPerWord` allowance is untouched.

Example with `maxRetryPerWord=2`, `maxRetryPerSession=5`, `correctStreakThreshold=2`:

- Batches 1–3: a word is wrong every time → 3 questions/batch (1 initial + 2 retries). Cumulative session retries: 2 → 4 → 6.
- Batch 4: cumulative total (6) is already `>= maxRetryPerSession` (5) → the word gets served **once**, no retries, regardless of the answer.
- Batches 4–5: word keeps missing → still served once/batch, cumulative total unchanged (no retries were granted to add to it).
- Batch 6: word is answered correctly twice in a row (`correctStreak >= correctStreakThreshold`, possibly spanning batch 5→6) → `advanceAdaptiveSession` deletes the word's `sessionRetryCounts` entry.
- Batch 7: the word's cumulative total is back to 0 → full retry behavior resumes, as if it were batch 1 again.

Without this reset, a word that struggled early in a long session would stay retry-starved for every subsequent batch, even after the learner clearly relearned it — silently shrinking how much practice that batch actually serves. The reset is applied once per batch boundary (in `advanceAdaptiveSession`, using the `runState` merged at the end of that batch); it only affects batches starting *after* the streak was hit, since `submitBatchResult` reads a frozen snapshot of `sessionRetryCounts` taken at the start of the batch (`initBatchState`).

### Retiring and queue refilling

- Retirements happen per-batch after answer processing.
- Queue refilling is immediate: retire a word → check free slots → pull that many from queue into active → use them in the next batch.
- A word pulled from queue gets its first question in the *next* batch, never in the batch that retired the predecessor.

### Sentence question mechanics

- **Eligibility**: all words in the sentence must have `seen >= 2`; mastery not required
- **Composing**: `composeSentenceBatch` always produces 3 directions (english→native, native→english, native→romanization)
- **No state crossover**: a sentence answer never changes `WordState`; word answers never change `SentenceRunState`
- **Shelving**: sentence marked `active=false` if it accumulates 3 wrong answers in a session, or 3 correct answers (exits)
- **Spacing**: a sentence cannot appear in back-to-back batches (`batchNum - lastBatchSeen` must be ≥ 1)
- **Retirement**: after correct streak reaches threshold (default: 3), the sentence moves to FSRS review (`src/review/`)

### Terminal condition

- Session is done when `active.length === 0 && queue.length === 0`.
- This is unambiguous: if you have a deck of 50 words and each needs to reach mastery 5, the session runs until all 50 are mastered.
- Sentence questions do not block termination — they retire independently to FSRS and do not contribute to the word-based `active/queue` state.
