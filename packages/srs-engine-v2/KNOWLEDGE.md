---
sources: [EP20]
updated: 2026-08-03
---

## foundational-content
Supports Thai foundational categories (Consonants, Vowels, Tones) with special handling for combining marks to ensure correct display in terminal environments.

## batch-composition
Quiz batches are composed from a mix of curated words and foundational characters. The system ensures comprehensive coverage of the active pool using a coverage-first shuffle, while adhering to a configurable total question limit per batch.

## mastery-tracking
Word mastery is tracked via a streak-driven integer system (0–5). Consecutive correct answers increase mastery and consecutive wrong answers decrease it; words are retired upon reaching the mastery threshold. To prevent regression, previously mastered words are re-checked once upon entering a new deck.

## learning-session-lifecycle
Learning follows an adaptive lifecycle where words transition from a queue to an active window, and finally to a mastered state. A session continues until all words in the deck have been mastered.
