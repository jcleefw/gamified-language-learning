# ADR: Conversation Audio — Standalone Audio Asset Model & Versioning

**Status:** Accepted

**Date:** 2026-07-14

**Deciders:** PO (solo founder)

**Epic:** EP43 (decided during EP43-DS02 pivot); **implemented by** a storage epic (proposed EP44) that revises EP42 — see Decision.

**Scope:** How audio is *modeled and persisted* as a data entity — the table shape that holds a binary's identity, ownership, timing sidecar, and version history. This is the **substrate** the [WebVTT timing ADR](20260714T123438Z-engineering-audio-timing-webvtt.md) sits on. It does **not** decide the timing *format* or the runtime consume path (that ADR does).

**Supersedes (in part):** the `decks.audio_key` **column** decision embedded in EP42 (Deck Audio Storage & Retrieval) — see [playback ADR](20260713T140218Z-engineering-audio-playback-model.md) for the runtime contract that referenced it. **Paired with:** [WebVTT timing ADR](20260714T123438Z-engineering-audio-timing-webvtt.md). **Relates:** [mixed-platform hosting ADR](20260712T124801Z-infra-mixed-platform-hosting.md) (R2 binary storage).

---

## Context

EP42 modeled a deck's audio as a single `decks.audio_key` **column** — one binary, one slot, deck-owned. During the EP43-DS02 pivot the PO determined this is too narrow:

- **Audio is not inherently deck-scoped.** The same *word* pronunciation is reused across every deck that contains that word (1 audio → many decks, transitively through the word). A deck-owned column can never express that. A future *sentence* clip is the same shape.
- **Replacing audio should not destroy history.** Because binaries live in the bucket content-addressed (a re-upload is a *new key*, not an overwrite), the previous audio — and its timing — still exist; the model should retain them, not clobber a single column.
- **Timing (VTT) must hang off the binary, not the deck.** The paired WebVTT ADR keys timing to a specific audio binary; that timing therefore belongs on the audio record, not smeared across the deck or its sentences.

**EP42 is not merged to main.** So this is adopted by **revising EP42 in place** to introduce the audio table from the start — *not* by shipping a migration that adds `audio_key` and a later one that drops it. No throwaway migration reaches main.

## Decision

**Model audio as a first-class, standalone, versioned entity — not a column on `decks`.**

1. **Standalone `audio` table.** A row is one binary asset: its bucket pointer (content-addressed key), metadata (format, size, duration, uploaded_by, created_at), and a nullable timing sidecar.
2. **Polymorphic owner** — `subject_type` + `subject_id`. Conceptually `subject_type ∈ {deck, sentence, word}`, but **only `deck` is honored now**; the allowed-value set ships as `deck`-only and is widened by a trivial migration when sentence/word actually arrive (do not pre-declare inert values — see Consequences). The table's *shape* is the future-proofing; the enum stays honest to what is wired.
3. **Deck↔audio is 1:1 (current), versioned over time.** Replacing a deck's audio **inserts a new `audio` row** and flips `is_current`; the prior row — binary key **and** its VTT — is retained as history. "Last linked audio & vtt" is simply the previous row. Content-addressing dedups the *bytes* in the bucket, so history costs rows, not blobs.
4. **Deck audio and sentence audio are one model.** Both are segmentable system audio and are treated identically; no separate table or path.
5. **`vtt` is a nullable column on `audio`.** It is populated only for *segmentable* audio (deck/sentence). Atomic audio (a future word clip) leaves it null — VTT presence *means* "this binary has addressable sub-segments." The VTT's format, storage tiering, and lifecycle are defined by the [WebVTT timing ADR](20260714T123438Z-engineering-audio-timing-webvtt.md); this ADR only decides *that the column lives here*.
6. **Replacement is admin/curator-only.** Learners never replace system audio. The *approval flow* for a replacement (provisional assumption: admin approves) is a **separate, later discussion**; permission-gating for replacement is **explicitly out of scope** and must not be locked in by this ADR.

## Consequences

**Positive:**

- Audio is never locked to deck context; sentence/word/crowdsourced audio slot in via `subject_type` with no structural rework.
- Replacing audio retains full history (binary + timing) instead of clobbering a single column.
- Timing (VTT) has a natural, binary-adjacent home, keeping the WebVTT ADR's "travels with the binary" invariant honest.
- Adopted by revising unmerged EP42 — no migrate-then-drop noise in main's history.

**Negative:**

- More schema and query surface than a single column (a table + `is_current` resolution on read).
- Polymorphic ownership trades DB-level FK integrity for flexibility (a `subject_id` isn't a typed foreign key across three possible parents).
- Widening `subject_type` to `sentence`/`word` later is a (small) migration — deliberately deferred over pre-declaring untested values.

**Neutral:**

- The binary continues to live in the bucket, content-addressed (unchanged from EP42/R2).
- No runtime wire-contract change is implied here on its own; the consume path is decided by the paired WebVTT ADR.

## Deferred / out of scope

- `sentence` and `word` subject types — shape reserved, paths not built.
- **Crowdsourced / user audio** — a *different tier* (local storage, user-only, not the system bucket). Not modeled now; the standalone shape simply doesn't forbid it later.
- **Replacement approval/permission flow** — provisional "admin approves"; its own discussion, not decided here.
