---
unit: apps/server
sources: [EP31, EP34, EP35, EP37, EP38, EP39, EP40, EP41, EP42, EP43]
updated: 2026-08-16
---

# apps/server — Domain Knowledge

> **APPROVED EDITS ONLY.** No agent or automation may write to this file without
> explicit human approval. Always ask first, every time — this holds for the
> first write and every later append.

## package-scaffold

A pnpm workspace package (`@gll/server`) exists with TypeScript configuration,
a Hono 4 app, and a `GET /health` route. The app is split into two files: the
pure Hono app instance (exported for tests and Workers runtime) and the Node
server entry point (for local development via tsx watch). A Wrangler config
file declares the package name and entry point for future Cloudflare Workers
deployment.

## learning-authority

Quiz answers are graded on the server rather than the client — the server
computes the outcome of an answer and is the single source of truth, so
correctness can no longer be spoofed from the client. A "recheck" (re-asking
a word the learner just missed, without resetting its progress) is handled
identically whether it originates from the client or the server.

## data-access

Endpoints exist to fetch a learner's saved word progress, save an update
after each answer, and wipe all saved progress. Storage writes are properly
awaited before responding, so a failed write is reported back as an error
rather than silently lost.

## content-curation

Curriculum content is validated both on upload (external format) and before
storage (internal format) — malformed content is rejected with a clear error
rather than silently corrupting storage.

## review-session

A due-review endpoint returns a learner's due review cards, most-overdue
first. Submitting a review answer only advances that word's schedule if the
card was genuinely due — the client cannot influence or fake this. A
Practice Anytime endpoint returns all learned words, due or not, in a smart
order (overdue first, others rotated by how recently they were practiced),
capped at 50, and reports back whether an answer actually advanced the
schedule.

## mastery-tracking

When a word crosses the mastery threshold, its first review card is created
automatically. The server owns the learning-policy settings (mastery
threshold, streak rules) and serves them to any client at startup.

## config-policy

A named difficulty level (currently only "normal") maps to underlying
pacing/forgiveness numbers, with the mastery finish line identical no matter
which difficulty is chosen. A config endpoint merges a user's saved
preference overrides with fixed system defaults. A separate validated
endpoint saves preference changes (difficulty, batch size, sentence
directions), rejecting anything that tries to change a fixed system setting
or an invalid value.

## audio-timing

Local audio storage stands in for the production object store during
development. A storage client resolves a stored audio key into a servable
URL (and a sibling subtitle-track URL) through pure string composition, with
no network call needed on the read path. An upload endpoint verifies an
audio file's real format from its contents (not its filename), stores it,
and keeps prior versions as history alongside the current one. A subtitle
upload is only accepted if it was authored against the audio currently
uploaded for that deck; a mismatched one is rejected.

## debug-tooling

A learner's session can be recorded (Start/Stop) and downloaded as a
self-contained file, then replayed later — from the command line or as an
automated regression check — to reproduce it exactly and flag the first
point where the replay diverges from what actually happened.
