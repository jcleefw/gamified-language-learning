---
unit: packages/api-contract
sources: [EP11, EP15, EP32, EP35, EP42]
updated: 2026-08-16
---

# packages/api-contract — Domain Knowledge

> **APPROVED EDITS ONLY.** No agent or automation may write to this file without
> explicit human approval. Always ask first, every time — this holds for the
> first write and every later append.

## api-contract

The package exports TypeScript type declarations with zero runtime dependencies —
it defines the wire format shared between server and every client, nothing more.

A common response envelope wraps all API responses, with a standardized error
interface for codes and messages.

Answer submissions identify the learner's chosen option by key rather than
reporting correctness directly — the server, not the client, judges whether an
answer was right.

The contract supports the word-tracking model: times seen, times correct, a
mastery score, correct/wrong streaks, and lapses.

## content-curation

The contract defines validated shapes for curriculum content — both the
external upload format and the internal stored format — so malformed content
can be rejected with a clear error.

## audio

A deck's response can include an audio URL and a subtitle-track URL, present
only when audio exists and storage is configured.
