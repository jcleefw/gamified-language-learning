---
unit: packages/srs-engine
sources: [EP02, EP04]
updated: 2026-07-21
---

# packages/srs-engine — Domain Knowledge

> **APPROVED EDITS ONLY.** No agent or automation may write to this file without
> explicit human approval. Always ask first, every time — this holds for the
> first write and every later append.

## spaced-repetition

The core scheduling engine that drives adaptive learning. Three key behaviors:

**Mastery counting and phase transitions:** Every answer adds or subtracts mastery points (correct: +1, incorrect: −1, floor at 0). Two thresholds drive phase transitions — Foundational mastery (5 points) and Curated mastery (10 points). Words cycle through Learning → Foundational ANKI → Curated ANKI, with a reset rule: three lapses in curated ANKI drops back to Learning to prevent retention collapse.

**Scheduling algorithm:** Uses ts-fsrs (a TypeScript port of the Forgetting Curve algorithm) to compute review intervals based on rating, grade, and retention target. Intervals cap at 90 days to keep review demands bounded even for well-retained words.

**Rating semantics:** User ratings (Good/Again) map directly to algorithm input; only these two are exposed to callers — the engine owns the mapping, not the caller.

## batch-composition

Each practice session assembles a batch of words in a fixed priority: words carried over from an unfinished session first, then words due for foundational-level review, then new words, then words still in foundational learning.

Batches mix question types in a fixed 70/20/10 ratio. When the audio format isn't available for a word, that question is swapped to multiple-choice so the batch still completes.
