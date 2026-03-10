# Terminal Quiz Runner

Run with `pnpm quiz` (or `tsx scripts/quiz-runner.ts`).

An interactive terminal quiz that exercises the SRS engine end-to-end with real Thai language seed data. This is an **engine validation tool** — it proves the `SrsEngine` API works correctly, not a user-facing product.

---

## How it works

1. Loads seed data: **5 foundational Thai consonants** (ก ข ค ง จ) + **vocabulary from conversation decks** (~49 curated words after dedup).
2. Loops: compose a batch → present questions → accept self-assessed answers (`c`orrect / `w`rong / `q`uit) → update mastery → print summary → repeat.
3. All data is in-memory. Nothing is persisted between runs.

---

## Current config

| Setting                         | Value                              | What it controls                                                 |
| ------------------------------- | ---------------------------------- | ---------------------------------------------------------------- |
| `batchSize`                     | 15                                 | Max questions per batch (actual count depends on eligible words) |
| `masteryThreshold.foundational` | **5**                              | Correct answers to promote a foundational word to `srsM2_review` |
| `masteryThreshold.curated`      | **10**                             | Correct answers to promote a curated word to `srsM2_review`      |
| `activeWordLimit`               | 20                                 | Max words in the active learning window                          |
| `newWordsPerBatch`              | 3                                  | New words introduced per batch                                   |
| `lapseThreshold`                | 3                                  | Wrong answers in `srsM2_review` before resetting to `learning`   |
| `shelveAfterBatches`            | 5                                  | Batches without progress before a word is shelved                |
| `maxShelved`                    | 50                                 | Max simultaneously shelved words                                 |
| `continuousWrongThreshold`      | 3                                  | Consecutive wrongs on a foundational word to reset mastery to 0  |
| `questionTypeSplit`             | 60% mc / 30% wordBlock / 10% audio | Question type distribution                                       |
| `foundationalAllocation`        | 20% active / 5% post-depletion     | Batch slots reserved for foundational words                      |

---

## Word lifecycle

```
                    ┌─────────────────────────────────────────┐
                    │           learning phase                │
                    │                                         │
   New word ──────► │  Each correct answer: masteryCount + 1  │
                    │  Each wrong answer:   masteryCount - 1  │
                    │  (floor at 0)                           │
                    │                                         │
                    └──────────────┬──────────────────────────┘
                                   │
                     masteryCount reaches threshold
                     (foundational: 5, curated: 10)
                                   │
                                   ▼
                    ┌─────────────────────────────────────────┐
                    │         srsM2_review phase              │
                    │                                         │
                    │  FSRS scheduling takes over             │
                    │  Word is now "active" in the window     │
                    │  Keeps appearing in batches as          │
                    │  carry-over until FSRS interval elapses │
                    │                                         │
                    │  3 wrong answers (lapses) → reset back  │
                    │  to learning phase with masteryCount=0  │
                    └─────────────────────────────────────────┘
```

---

## Behaviors you will observe (not bugs)

### Small initial batches

The first batch has only **3 questions**, not 15. This is because `newWordsPerBatch=3` limits how many new words enter the active window per batch. Batches grow as words get promoted to `srsM2_review` (they become "active" and carry over).

### Promoted words keep appearing

Once a word reaches `srsM2_review`, it **does not exit the deck**. It becomes a carry-over word and appears in every subsequent batch. In a real app with persistence, FSRS would space reviews out (1 day → 3 days → 14 days…). In this in-memory runner there is no time passage, so FSRS intervals don't apply and the word keeps showing up.

### Mastery count keeps rising past the threshold

A foundational word promoted at `masteryCount=5` will show `mastery=6, 7, 8…` in later batches. This is correct — the threshold only gates the phase transition. Mastery continues to be tracked in `srsM2_review`.

### Same words repeat across batches

Words in `learning` phase reappear until promoted. Words in `srsM2_review` reappear as carry-over. New words (3 per batch) are introduced only when there's room in the active window.

### Foundational words appear before curated words

The engine prioritises: carry-over → foundational revision → new words → foundational learning. Foundational consonants (with a lower threshold of 5) promote faster and dominate early batches.

### 3 consecutive wrongs resets foundational mastery

If you answer a foundational word wrong 3 times in a row during `learning` phase, its `masteryCount` resets to 0. This is the `continuousWrongThreshold` rule.

---

## Question types

| Type                     | Foundational example               | Curated example                   |
| ------------------------ | ---------------------------------- | --------------------------------- |
| **mc** (multiple choice) | What is "ก"? → Ko Kai — k          | What does "หิว" mean? → hungry    |
| **wordBlock**            | Spell the romanization of "จ" → ch | Arrange: "hungry" in Thai → หิว   |
| **audio**                | Listen: "ก" — what sound? → k      | Listen: "หิว" — meaning? → hungry |

Audio questions appear in the distribution breakdown but are not actually playable in the terminal.
