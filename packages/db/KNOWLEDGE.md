---
unit: packages/db
sources: [EP26, EP30, EP31, EP35, EP41, EP42, EP43]
updated: 2026-08-16
---

# packages/db — Domain Knowledge

> **APPROVED EDITS ONLY.** No agent or automation may write to this file without
> explicit human approval. Always ask first, every time — this holds for the
> first write and every later append.

## database-schema

Importing curriculum content is safe to repeat — it never creates duplicate
words, and three correctness issues from an earlier version were fixed.

A deck's sentences and their word breakdowns are stored together as one
self-contained unit, rather than split across separate tables.

Uploaded audio files are checked against their real format (not just the
filename) before being stored; each deck keeps a history of prior audio
versions alongside the current one.

## data-access

Learner progress (words and sentences) is stored behind a seam the learning
engine itself doesn't need to know about.

Deck content is stored behind its own equivalent seam, separate from learner
progress.

Re-importing the same curriculum content is safe — it never creates
duplicates, and a partial or bad import is fully undone rather than left
half-applied.

A user's difficulty setting and session preferences are saved per-user; no
saved preference means nothing has been chosen yet.

## shelving

Word stagnation (how long a word has gone without progress) is tracked per
user and per deck, and survives a page refresh.

Shelving a word applies only within its own deck — it doesn't affect the same
word in a different deck.

## audio-timing

A subtitle file for a deck is only accepted if it was authored against the
audio currently uploaded for that deck; mismatched subtitles are rejected.
