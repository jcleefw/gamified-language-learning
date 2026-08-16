---
unit: packages/srs-engine
sources: [EP17, EP18, EP20, EP21, EP22, EP23, EP25, EP26, EP30, EP31, EP36]
updated: 2026-08-16
---

# packages/srs-engine — Domain Knowledge

> **APPROVED EDITS ONLY.** No agent or automation may write to this file without
> explicit human approval. Always ask first, every time — this holds for the
> first write and every later append.

## learning-session-lifecycle

Words move automatically through queued → active → mastered as a session progresses, continuing until everything is mastered, rather than running a fixed sequence of batches. How many words are active at once is configurable. A word that was already mastered before a new deck loads gets a one-time re-check: a correct answer reconfirms mastery, a wrong answer returns it to active play without wiping its prior streak history.

## mastery-tracking

Mastery is tracked as a level on a configurable scale that rises or falls based on consecutive right/wrong streaks, with faster climbs or drops once a streak passes a configurable threshold.

## batch-composition

Practice batches draw from a deck's word pool, guaranteeing every active word appears at least once per batch (batch size is configurable). A shelved word is skipped when assembling a batch's questions but still keeps its reserved slot in the active pool rather than being backfilled. Within a batch, a wrong answer is automatically re-asked up to a configurable retry limit, reusing the exact same question rather than rewording it, and the batch produces a clean summary once it ends.

## batch-validation

The engine runs a safety-net check on a finished batch, flagging two kinds of problems: a word that should have been excluded sneaking back in — either as its own question or hidden inside a sentence's word tiles — and the same question appearing twice in one batch. The check only reports problems; it never fixes or blocks anything itself, leaving that decision to the caller.

## foundational-content

The engine supports Thai vowels and tones alongside consonants as foundational content. Tone quizzing is limited to two directions instead of the usual four, since distinguishing the small diacritic marks visually was judged too unreliable to quiz in all four directions.

## sentence-scheduling

Once a learner has seen every word in a pre-written sentence enough times (configurable), "arrange the tiles in order" questions appear, in three directions: from an English prompt, from a romanized prompt, and from a native-script prompt. Sentences track their own streak and are shelved or graduated out of rotation based on consecutive results, mirroring word-level shelving.

## shelving

Stagnation tracking and shelving are persistent (they survive across sessions) and scoped per learner per deck.

## data-access

A learner's progress is saved after every answer rather than only at the end of a session, so quitting mid-session doesn't lose progress.

## spaced-repetition

The engine schedules reviews with an FSRS-based scheduler: seeding a new review card from a learner's mastery performance, advancing the card's due date after each review, and checking whether a card is due. The third-party scheduling library is isolated behind this one internal module so the rest of the engine never depends on it directly.
