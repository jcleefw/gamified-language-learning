# PRD: Audio Marker Tool

**Date**: 20260713T140217Z
**Status**: Draft (revised 20260714 — realigned to the WebVTT + standalone-audio ADRs)
**Epic**: EP43 — Audio Playback & Marking (re-scoped DS02); depends on the audio-asset-model storage work (proposed EP44).

**Related ADR**: [Conversation Audio — Timing as WebVTT (Storage, Authoring & Playback)](../architecture/20260714T123438Z-engineering-audio-timing-webvtt.md) — *the governing ADR for this tool.*
**Related ADR**: [Conversation Audio — Standalone Audio Asset Model & Versioning](../architecture/20260714T123409Z-engineering-audio-asset-model.md) — where the VTT is stored.
**Related ADR**: [Conversation Audio — Playback Model & Data Contract](../architecture/20260713T140218Z-engineering-audio-playback-model.md) *(amended — consume mechanism now Option C)*.
**Superseded ADR**: [Conversation Audio — Marking (Authoring) Architecture](../architecture/20260713T140219Z-engineering-audio-marking-authoring.md) *(the bespoke-JSON / two-pass build this PRD originally assumed)*.
**Related ADR**: [Infrastructure — Mixed-Platform Hosting](../architecture/20260712T124801Z-infra-mixed-platform-hosting.md) (R2 audio storage).

> **Scope**: The **curator experience** for placing per-sentence audio markers on a deck's single conversation file. Defines what the curator does and the minimum tool capability to unblock MVP audio. The *format, storage, and persistence* of markers are decided by the WebVTT ADR; the *audio entity* they attach to by the asset-model ADR; *playback* of the resulting markers to learners by the playback ADR. This PRD owns the authoring UX, not the mechanics.

---

## 1. Why This Tool

Audio is supplied as **one conversation file per deck**, but playback is by **sentence** — each sentence needs a `[start, end]` time range into that file. Someone has to produce those ranges. Doing it by hand in an audio editor and copying timestamps is slow and error-prone across ≥10 decks.

The marker tool lets the curator (the PO, for the MVP) **scrub the deck's already-uploaded conversation audio in the browser and set in/out points per sentence quickly**. The output is a **WebVTT track bound to that audio binary** — the same track the learner-facing player consumes (via the browser's native subtitle engine, per the playback ADR amendment). Audio is a beta-release blocker; markers are its hidden dependency; this tool is how they get made.

---

## 2. Users

- **Curator / PO** — authors decks and their audio markers. The only user for the MVP. No learner sees this tool.
- *(Later, not built here)* the same marker capability may be exposed to learners for their own word-level markers — hence the tool is built as an **isolated, portable component** rather than wired into curator-only plumbing.

---

## 3. What the Curator Does (core flow)

1. Open the tool for a deck; its **sentence list** (from `DeckDoc.sentences`) is shown in order.
2. The deck's **conversation audio** — already uploaded and content-addressed in the bucket (per EP42 / the asset-model ADR) — loads for playback. If a VTT already exists for that binary, it loads too, for fine-tuning.
3. Play/scrub the audio, using **slow-down** for precision.
4. For each sentence, set its **start** and **end** from the play-head (capture + keyboard nudge).
5. **Verify** by playing back a sentence's segment (seek to start → stop at end).
6. **Commit**: the markers are written as WebVTT — to the DB working copy and flushed to the durable bucket `.vtt` — through a gated server endpoint. The curator can **download** the VTT and **overwrite** it later.

---

## 4. Scope

Single delivery — no pass-1/pass-2 split (the old two-pass build is superseded; the marking ADR collapsed it into one server-write pass).

### 4.1 In scope

- Mount as an **isolated, portable marker component** in `srs-demo`, behind a gated route. VTT-in / VTT-out at its edges; no reach into app internals (so it can move to a curator surface or be reused for learner word-level marking later).
- Load the deck's sentence list + its **bucket-hosted** conversation audio; load an existing VTT if present.
- Play / pause / scrub with a **time readout**.
- **Playback-rate** control (1× / 0.75× / 0.5×) — the same primitive the learner player uses.
- Set **in / out per sentence** from the play-head: a capture button plus **keyboard nudge** for fine adjustment.
- **Segment preview**: play a single sentence's `[start, end]`.
- **Commit to WebVTT** via the **gated curator server endpoint** — writes the DB working copy + the durable bucket `.vtt` (cue-ID = `sentenceId`; hash-stamped to the audio binary). **Download** and **overwrite** supported.

### 4.2 Out of scope (this tool)

- **No waveform** — a scrubber + numeric time is enough to place markers.
- **No word-level marking UI** — the VTT cue-ID namespace *reserves* the `sentenceId#wordIndex` shape, but no word-level authoring UI is built here.
- **No automated marker derivation** — forced alignment (aeneas/MFA) is a separate future producer/epic, not this hand-marking tool.
- **No audio upload** — the binary already exists (EP42 curator upload). This tool marks it; it does not ingest audio.
- **No TTS / audio generation** — audio is manually produced for the MVP.
- **No audio-replacement permission/approval model** — replacement is admin/curator-only; the approval flow is deferred (asset-model ADR).

---

## 5. Success Criteria

- The curator can mark a full conversation deck (all sentences) **without leaving the browser** and **without an external audio editor**.
- Committed markers drive correct **segment playback** on both learner surfaces (DeckOverview + word-block question) — via the served WebVTT track the browser plays natively.
- Markers persist through the **server → DB working copy + durable bucket `.vtt`** with **no manual DB or file editing**, and the VTT is **downloadable** for portability.
- The committed VTT is **bound to its audio binary** (hash-stamped): re-uploading the audio leaves the old timing behind (hard-invalidate), never silently mismatched.

---

## 6. Open Questions

| Question | Owner |
| -------- | ----- |
| Keyboard-nudge granularity + whether snap-to-play-head is enough without a waveform | Dev / PO |
| Route gating for the curator view (how "curator-only" is enforced pre-auth) | Dev |
| Confirm the Option-C premise for this tool's *preview* (browser TextTrack vs a simple seek-and-stop) | Dev |
| Exact shape of the gated commit endpoint (upsert VTT for an existing audio key) | Dev |
