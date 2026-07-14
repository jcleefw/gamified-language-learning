# PRD: Audio Marker Tool

**Date**: 20260713T140217Z
**Status**: Draft — architecture revised (see note)

> **Architecture update (20260714)**: The build architecture this PRD assumed (bespoke JSON marker map, `apply-markers` seed/import, pass-1 → pass-2 evolution) is **superseded** by [Conversation Audio — Timing as WebVTT](../architecture/20260714T123438Z-engineering-audio-timing-webvtt.md) and [Standalone Audio Asset Model](../architecture/20260714T123409Z-engineering-audio-asset-model.md). Timing is now WebVTT bound to the audio binary, stored on a standalone versioned `audio` entity, with a single-pass gated server-write. The *curator experience* this PRD describes (point-and-click in/out marking) still holds; the storage/ingest mechanics below do not.
**Epic**: Audio (proposed) — first slice of Stage-7 curation, pulled forward as an audio dependency
**Related ADR**: [Conversation Audio — Playback Model & Data Contract](../architecture/20260713T140218Z-engineering-audio-playback-model.md)
**Related ADR**: [Conversation Audio — Marking (Authoring) Architecture](../architecture/20260713T140219Z-engineering-audio-marking-authoring.md)
**Related ADR**: [Infrastructure — Mixed-Platform Hosting](../architecture/20260712T124801Z-infra-mixed-platform-hosting.md)

> **Scope**: The **curator experience** for placing per-sentence audio markers on a deck's single conversation file. Defines what the curator does, the minimum tool capability to unblock MVP audio, and the pass-1 → pass-2 evolution. Playback of the resulting markers to learners is covered by the playback ADR, not here.

---

## 1. Why This Tool

Audio is supplied as **one conversation file per deck**, but playback is by **sentence** — each sentence needs a `[start, end]` time range into that file (the playback ADR's data contract). Someone has to produce those ranges. Doing it by hand in an audio editor and copying timestamps is slow and error-prone across ≥10 decks.

The marker tool lets the curator (the PO, for the MVP) **scrub the conversation in the browser and set in/out points per sentence quickly**, producing the markers the learner-facing player consumes. Audio is an MVP-release blocker; markers are its hidden dependency; this tool is how they get made.

---

## 2. Users

- **Curator / PO** — authors decks and their audio markers. The only user for the MVP. No learner ever sees this tool.

---

## 3. What the Curator Does (core flow)

1. Open the tool for a deck; its **sentence list** (from `DeckDoc.sentences`) is shown in order.
2. Load the deck's **conversation audio** (pass 1: a local file; pass 2: the R2-hosted file).
3. Play/scrub the audio, using **slow-down** for precision.
4. For each sentence, set its **start** and **end** from the play-head.
5. **Verify** by playing back a sentence's segment (seek to start → stop at end).
6. **Save** the markers (pass 1: export a JSON marker map; pass 2: write through the server).

---

## 4. Scope

### 4.1 Pass 1 — MVP (in `srs-demo`, gated route)

**In:**
- Load the deck's sentence list + a **locally-served** audio file.
- Play / pause / scrub with a **time readout**.
- **Playback-rate** control (1× / 0.75× / 0.5×) — the same control the learner player uses.
- Set **in / out per sentence** from the play-head: a button to capture, plus **keyboard nudge** for fine adjustment.
- **Segment preview**: play a single sentence's `[start, end]`.
- **Export a JSON marker map** (`sentenceId → { start, end }`) for the seed/import pipeline.

**Out (pass 1):**
- **No waveform** — a scrubber + numeric time is enough to place markers.
- No server write; no R2 upload; no auth beyond the existing route gate.
- No word-level markers; no auto-derived markers.

### 4.2 Pass 2 — Curator app

- Lives in a **separate `apps/curator`** app.
- **Upload-first**: upload the conversation file to **R2**, load it from the R2 URL.
- **Persist markers through the server → DB** (direct `DeckDoc` writes), replacing the JSON-map hand-off.
- Curator **auth**.
- *Candidate niceties:* waveform view, multi-deck management, edit-in-place of existing markers.

### 4.3 Explicitly out of scope (both passes)

- Word-level audio / markers (deferred with word audio).
- Automated marker derivation (forced alignment, silence detection).
- Generating audio (TTS) — audio is manually produced for the MVP.

---

## 5. Success Criteria

- The curator can mark a full conversation deck (all sentences) **without leaving the browser** and **without an external audio editor**.
- Exported markers drive correct **segment playback** on both learner surfaces (DeckOverview + word-block question) via the playback contract.
- Pass-1 output feeds the seed/import pipeline with **no manual DB editing**.

---

## 6. Open Questions

| Question | Owner |
| -------- | ----- |
| JSON marker-map schema + how the curator moves it into seed/import | Dev |
| Keyboard-nudge granularity + whether snap-to-play-head is enough without a waveform | Dev / PO |
| Route gating for the pass-1 curator view (how "curator-only" is enforced pre-auth) | Dev |
