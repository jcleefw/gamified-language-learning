---
unit: packages/srs-engine
sources: [EP02, EP04, EP05, EP06]
updated: 2026-07-25
---

# packages/srs-engine — Domain Knowledge

> **APPROVED EDITS ONLY.** No agent or automation may write to this file without
> explicit human approval. Always ask first, every time — this holds for the
> first write and every later append.

## spaced-repetition

The core scheduling engine that drives adaptive learning. Words advance through phases (Learning → Foundational ANKI → Curated ANKI) based on mastery points: correct answers add 1 point, incorrect subtract 1 (floor at 0). Curated words that lapse 3 times reset to Learning. Scheduling uses ts-fsrs algorithm with intervals capped at 90 days. Only two user ratings (Good/Again) are exposed; the engine handles the mapping internally.

## batch-composition

Practice batches assemble words in priority order: carry-over from incomplete sessions, foundational review, new words, foundational learning. Question types mix at 70/20/10 ratio, with audio questions swapped to multiple-choice when unavailable. Foundational decks allocate only 20% of batch slots to active foundational words, with 5% reserved for depleted pools.

## learning-session-lifecycle

The active window limits learners to 8 concurrent words (4 new per batch), forcing vocabulary to compete for slots. Foundational decks cap this at 3 active words to reduce cognitive load on script fundamentals.

## mastery-tracking

Foundational words reset mastery to 0 on three consecutive wrong answers, preventing learners from grinding on words they cannot progress on. This constraint keeps foundational-phase learning focused and efficient.

## shelving

Words showing no progress for 3 consecutive batches are shelved for 1 day. Maximum 2 shelved words; overflow shelves the newest stuck word.
