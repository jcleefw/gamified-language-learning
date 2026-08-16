---
unit: apps/srs-demo
sources: [EP24, EP25, EP26, EP31, EP33, EP37, EP38, EP39, EP41, EP42, EP43, EP44]
updated: 2026-08-16
---

# apps/srs-demo — Domain Knowledge

> **APPROVED EDITS ONLY.** No agent or automation may write to this file without
> explicit human approval. Always ask first, every time — this holds for the
> first write and every later append.

## ui-components

A learner picks a deck to study from a deck-selection screen, which offers to
resume or clear a saved session if one exists.

A single question shows a prompt with choices and gives visual feedback on the
option picked. Multiple-choice review questions pause on a right/wrong reveal
before moving on, matching how sentence questions already behave.

A results screen after each batch shows the score and a mastery table per
word.

A home dashboard routes a learner into Learn or Review; Review is reachable at
any time and shows a due-count badge. A persistent navigation menu carries
this same badge on every screen.

The review hub always offers a choice between Due Review and Practice
Anytime, never locked out even when nothing is currently due.

An end-of-session summary reports how many words/cards were covered and when
the next review is due, with a friendly "nothing due" state for review
sessions and a distinct "practiced / advanced" count for practice sessions.

## curriculum

Deck content (words, lines) lives in the app and is fetched from the server
rather than a hardcoded file, using server-generated deck ids throughout
(including shelving).

A curator-only upload screen lets a curator pick a deck and a local audio
file and upload it, showing success or a clear error; hidden entirely outside
curation mode.

## batch-composition

A batch of quiz items is deduplicated per deck, and wrong-answer choices are
drawn from a shared pool spanning every deck in play, not just the current
one.

## shelving

A shelved (struggling) word is excluded from both word-mode and
sentence-tile questions, stays excluded across a session resume, and its
batch is backfilled with a replacement word so batch size doesn't shrink.
Shelving one deck's copy of a word never affects the same word in another
deck.

## sentence-scheduling

A sentence-building question ("put the words in order") becomes available
only once a learner has seen every word in that sentence enough times.

## review-session

A due review reuses the same quiz screen as learning, saving each answer to
the server immediately so nothing is lost if the learner leaves mid-session.

Practice Anytime covers every learned word (due or not, most-overdue-first),
reusing the same review screen; the app reports back from the server whether
each answer actually advanced that word's schedule, since not every answer
in practice mode does.

## mastery-tracking

A "recheck" — re-asking a word the learner just missed, without resetting
its progress — behaves identically whether decided by the client or the
server, and is recorded as such.

## config-policy

A learner's personal settings (like difficulty) are merged with fixed,
system-wide settings and served to the app at startup; the app will not
start a session if this fetch fails. Difficulty preference feeds directly
into how an answer is scored.

## audio-timing

A shared audio player (play/pause/seek/speed) reads its per-sentence timing
from a deck's subtitle track — the quiz engine itself has no notion of
audio. Word-block quiz questions can optionally offer a "play this
sentence" control; multiple-choice questions never show one.

A curator's marker-authoring tool sets per-sentence start/end points against
a visible, draggable waveform, kept in sync with a marker table in both
directions, with an auto-fill convenience for adjacent sentence boundaries.

## deck-overview

From a deck's detail screen, a learner can play the whole conversation or a
single sentence by clicking it, with the currently-playing sentence
highlighted using the subtitle track's timing.
