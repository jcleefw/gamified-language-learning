# EP43 - Audio Playback & Marking UI (WebVTT)

**Created**: 20260713T232015Z
**Redefined**: 20260714 — timing is WebVTT (not a bespoke JSON marker map); DS01 retrofits to the VTT consume path, DS02 rebuilds the marker tool as a WebVTT server-write.

**Status**: Draft

<!-- Status: Draft | Accepted | In Progress | Impl-Complete | BDD Pending | Completed | Shelved | Withdrawn -->

**Type**: Epic Plan
**Depends on**: [EP42 - Deck Audio Storage & Retrieval](EP42-deck-audio-storage-and-retrieval.md) — consumes the wire fields EP42 emits (`AppDeckPayload.audioUrl`, `AppDeckPayload.vttUrl`), the curated `audio` row (binary), and the `audio.vtt` sidecar column EP42 provides. EP43 authors the VTT and renders/consumes it; it does not re-decide storage.
**Parallel with**: N/A
**Predecessor**: N/A

> **Redefinition (20260714):** timing is now **WebVTT** ([WebVTT Timing ADR](../../product-documentation/architecture/20260714T123438Z-engineering-audio-timing-webvtt.md)), replacing the bespoke detached-JSON marker map. Two changes to the previously-shipped scope: **DS01** (learner playback) is *retrofitted* to consume a served `.vtt` via the browser's native `TextTrack`/`cuechange` (Option C) instead of reading per-line `audioStart`/`audioEnd`; **DS02** (marker authoring) is rebuilt as an **isolated VTT-in/VTT-out component** committing through a **single-pass gated server-write** (DB `audio.vtt` column + durable bucket `.vtt`), replacing the JSON export + `apply-markers` CLI seed step. The shared `AudioPlayer`/`useSegmentPlayer` primitive is kept.

---

## Problem Statement

After EP42 ships, a deck's conversation binary is stored as a versioned `audio` row and `GET /api/decks` can emit `audioUrl` + `vttUrl` — **but no learner can hear anything** (`srs-demo` renders no `<audio>` anywhere), and **no timing exists to segment by** (the `audio.vtt` column is empty until something authors it). Producing per-sentence timing by hand-editing files is the toil the [Audio Marker Tool PRD](../../product-documentation/prds/20260713T140217Z-audio-marker-tool.md) exists to remove.

Audio pronunciation is a **PO-declared beta-release blocker**. EP42 makes audio *storable*; this epic makes it *heard* and *ergonomically markable*:

- **Playback (DS01)** realizes the UI half of the [Playback Model ADR](../../product-documentation/architecture/20260713T140218Z-engineering-audio-playback-model.md) — but its **consume mechanism is amended to Option C** by the WebVTT ADR §6: the learner's browser attaches the served `.vtt` as a `TextTrack`, and `cuechange` (cue-ID = `sentenceId`) drives sentence highlighting + segment bounds. No per-line numbers on the wire, no server-side parse.
- **Marking (DS02)** realizes the [WebVTT Timing ADR](../../product-documentation/architecture/20260714T123438Z-engineering-audio-timing-webvtt.md) + the marker PRD: an isolated marker component scrubs the deck's bucket-hosted audio, sets per-sentence in/out from the play-head, and **commits WebVTT through a gated server endpoint** that writes both the DB working copy (`audio.vtt`) and the durable bucket `.vtt`, hash-stamped to the binary.

It front-loads playback (DS01) so the shared audio-player primitive exists before the marker tool (DS02) reuses it.

## Scope

**In scope**:

- A **shared audio-player primitive** (`AudioPlayer.vue` + `useSegmentPlayer`) — one `<audio>` wrapper owning `seek → play → pause-at-end` and a **primary, always-visible** 1× / 0.75× / 0.5× speed control. Extended to attach a `<track>` from `vttUrl` and expose the active cue. Built once, mounted on every audio surface (learner + curator). *(DS01.)*
- **VTT consume (Option C)** — the browser parses the served `.vtt`; `cuechange` fires as playback crosses cue boundaries. A cue's ID is the `sentenceId`; its `[startTime, endTime]` are the segment bounds. *(DS01.)*
- **Learner playback on `DeckOverview`** — play the whole conversation; clicking a sentence seeks to that sentence's cue and plays to its cue end; the active cue highlights the current sentence. *(DS01.)*
- **Learner playback on the `QuizCard` word-block question** — a control plays *that sentence's* cue segment (resolved by `sentenceId`); MCQ word questions get no audio. *(DS01.)*
- **Silent degradation** — no `vttUrl` (or no cue for a sentence) ⟹ no control rendered; the surface works unchanged; audio never gates answering. *(DS01.)*
- The **marker-authoring tool** (`srs-demo`, env-gated route) — an **isolated, portable VTT-in/VTT-out component**: load the deck's bucket audio (+ existing VTT if present), scrub with slow-down, set/nudge per-sentence `[start,end]` from the play-head, segment-preview, and **commit as WebVTT via the gated server endpoint**. Downloadable + overwritable. *(DS02.)*
- **Gated VTT server-write** — a curator endpoint accepts VTT upload/overwrite/download, validates the `NOTE audio-sha256` stamp against the binary, and writes **both** the `audio.vtt` DB column and the durable bucket `.vtt`. Single pass — no seed/import step. *(DS02.)*

**Out of scope**:

- Any storage/schema change to the `audio` table itself — EP42 owns the table + `vtt` column + wire. This epic *fills, serves, and reads* the VTT.
- **Bespoke JSON marker map + `apply-markers` CLI** — removed (superseded by the WebVTT server-write). The `DeckMarker`/`DeckMarkerMap` schemas are dropped.
- Word-level marking UI — the cue-ID namespace *reserves* `sentenceId#wordIndex`, but no word-level authoring/highlighting UI is built.
- Automated marker derivation (forced alignment / silence detection), TTS generation.
- The **separate `apps/curator` app** and curator auth — the marker component *mounts* gated in `srs-demo`; a dedicated curator surface + auth are a later concern (the component is built portable so it can move there).
- Audio-replacement approval/permission flow — deferred (asset-model ADR).
- iOS audio-session unlock / autoplay hardening beyond tap-to-play — tracked, not a beta blocker.

---

## Stories

### Phase 1: Learner audio playback (EP43-PH01) — DS01

### EP43-ST01: Shared audio-player primitive + prominent speed control + VTT track

**Scope**: `apps/srs-demo` — `useSegmentPlayer` (transport, scrubber, `mm:ss.cs` readout, `seek → play → pause-at-end`, 1×/0.75×/0.5×) + `AudioPlayer.vue`. Extended for VTT: accept an optional `vttUrl`, attach it as a `<track kind="metadata">`, expose the active cue and a `playCue(sentenceId)` that seeks to the matching cue and pauses at its end. Learner-agnostic — DS01's surfaces and DS02's marker tool mount it unchanged. **Design spec: [EP43-DS01](../../changelogs/EP43--audio-playback-and-marking/20260713T232015Z-EP43-DS01-learner-audio-playback-ui.md).**

### EP43-ST02: `DeckOverview` conversation + per-sentence (cue-driven) playback

**Scope**: `apps/srs-demo` — mount `AudioPlayer(:src=deck.audioUrl :vttUrl=deck.vttUrl)`; play the whole conversation; click a sentence → `playCue(sentenceId)`; highlight the sentence whose cue is active (`cuechange`). Absent `vttUrl` ⟹ whole-file play only, no per-sentence segmenting; absent `audioUrl` ⟹ no player. **Design spec: [EP43-DS01](../../changelogs/EP43--audio-playback-and-marking/20260713T232015Z-EP43-DS01-learner-audio-playback-ui.md).**

### EP43-ST03: `QuizCard` word-block segment playback (cue-driven)

**Scope**: `apps/srs-demo` — a play-segment control on the word-block sentence question; `App.vue` resolves `{ audioUrl, vttUrl }` for the current question's deck and passes it as an optional prop; the embedded player calls `playCue(sentenceId)`. MCQ questions get no audio; no cue for the sentence ⟹ no control. **Design spec: [EP43-DS01](../../changelogs/EP43--audio-playback-and-marking/20260713T232015Z-EP43-DS01-learner-audio-playback-ui.md).**

### Phase 2: Marker-authoring tool — WebVTT (EP43-PH02) — DS02

### EP43-ST04: Isolated VTT-in/VTT-out marker component + gated route

**Scope**: `apps/srs-demo` — a `VITE_CURATOR_MODE`-gated screen mounting a self-contained marker component (salvaged from `MarkAudio.vue` + `useMarkerAuthoring.ts`, retargeted): pick a curated deck, load its `audioUrl` via DS01's `AudioPlayer` and its existing VTT if present, capture in/out per sentence from the play-head (keyboard nudge), segment-preview, and emit **WebVTT** (cue-ID = `sentenceId`, `NOTE audio-sha256` stamp). VTT-in / VTT-out at its edges — no reach into app internals. **Design spec: [EP43-DS02](../../changelogs/EP43--audio-playback-and-marking/20260713T232015Z-EP43-DS02-marker-authoring-tool.md).**

### EP43-ST05: Gated VTT server-write endpoint (DB `audio.vtt` + bucket `.vtt`)

**Scope**: `apps/server` — a `GLL_CURATOR_MODE`-gated endpoint that accepts a VTT commit for a deck's current `audio` row: validate the hash stamp against the binary, write the `audio.vtt` DB column (live projection) **and** flush the durable bucket `.vtt` (system-of-record) via `putObject` (`text/vtt`). Supports overwrite + download. Replaces the bespoke-JSON `apply-markers` seed step. **Design spec: [EP43-DS02](../../changelogs/EP43--audio-playback-and-marking/20260713T232015Z-EP43-DS02-marker-authoring-tool.md).**

---

## Overall Acceptance Criteria

- [ ] On a curated deck whose current `audio` row has a VTT, a learner on `DeckOverview` can play the whole conversation and click any sentence to hear just its cue segment, with the active sentence highlighted and a visible 1×/0.75×/0.5× speed control.
- [ ] On a word-block question for a sentence with a cue, a learner can play that sentence's segment; MCQ word questions render no audio control.
- [ ] A deck with no `vttUrl`, or a sentence with no matching cue, renders no per-sentence control and works exactly as today — audio never blocks answering.
- [ ] The speed control (1×/0.75×/0.5×) is a primary, always-visible affordance, the *same* component on learner and curator surfaces.
- [ ] A curator can mark every sentence in a curated deck — set start/end, scrub, nudge, preview — without leaving the browser, and **commit as WebVTT**; the committed VTT is downloadable.
- [ ] Committing writes **both** the `audio.vtt` DB column and the durable bucket `.vtt`; `GET /api/decks` then surfaces `vttUrl` and the learner surfaces play the authored segments — no manual DB or file editing, no `apply-markers` step.
- [ ] The committed VTT carries `NOTE audio-sha256:<hash>` of the binary; re-uploading the audio (new `audio` row, new key) leaves the old VTT behind — never silently mismatched.
- [ ] No schema change beyond EP42's `audio` table; the marker screen + nav are gated by `VITE_CURATOR_MODE`/`GLL_CURATOR_MODE` and DCE'd from prod builds; `pnpm -r typecheck` and the suite pass with no `DeckMarker`/`apply-markers` references.

---

## Dependencies

- [EP42 - Deck Audio Storage & Retrieval](EP42-deck-audio-storage-and-retrieval.md) — provides the `audio` table + `vtt` column, `audioUrl`/`vttUrl` on the wire, and the curator upload page. **Hard dependency.**
- [WebVTT Timing ADR](../../product-documentation/architecture/20260714T123438Z-engineering-audio-timing-webvtt.md) — **the governing ADR**: §1 format/cue-ID, §2 two-tier storage, §4 hash-stamp, §6 Option-C consume (DS01), §7 marker component, §8 single-pass server-write (DS02).
- [Playback Model ADR](../../product-documentation/architecture/20260713T140218Z-engineering-audio-playback-model.md) — §3 surfaces, §4 segment + rate, §6 silent degrade **(consume mechanism amended to Option C)**.
- [Audio Asset Model ADR](../../product-documentation/architecture/20260714T123409Z-engineering-audio-asset-model.md) — where `audio.vtt` lives.
- [Audio Marker Tool PRD](../../product-documentation/prds/20260713T140217Z-audio-marker-tool.md) — the curator experience DS02 realizes.
- [Marking (Authoring) ADR](../../product-documentation/architecture/20260713T140219Z-engineering-audio-marking-authoring.md) — **Superseded** by the WebVTT ADR (kept for its rejected-alternative record).

## Next Steps

1. Review and approve the redefinition.
2. DS01 (learner playback — ST01/ST02/ST03) → retrofit the shipped code to the VTT `TextTrack`/`cuechange` consume path; drop per-line `audioStart`/`audioEnd` reads.
3. DS02 (marker authoring — ST04/ST05) → rebuild `MarkAudio.vue`/`useMarkerAuthoring.ts` as an isolated VTT-in/out component + the gated VTT server-write; drop `apply-markers.ts` + `DeckMarker`/`DeckMarkerMap`.
