# ADR: Conversation Audio — wavesurfer.js Playback Engine (Pivot from Native `<audio>`)

**Status:** Accepted

**Date:** 2026-07-14

**Deciders:** PO (solo founder)

**Epic:** EP43 (post-DS01/DS02, triggered by EP43-BUG01)

**Amends:** [Playback Model ADR](20260713T140218Z-engineering-audio-playback-model.md) — §4 ("one `<audio>` element per surface … set `currentTime` … pause when `currentTime >= audioEnd`") is replaced by a wavesurfer.js `WebAudio`-backend player; the *behaviour* (seek → play → pause-at-end, per-sentence highlight, playback-rate control) is unchanged, only the underlying engine changes. **Amends:** [WebVTT Timing ADR](20260714T123438Z-engineering-audio-timing-webvtt.md) — §6 ("consume path = serve raw VTT; the browser parses it natively via `TextTrack`/`cuechange`") no longer applies as written for the segment-stop mechanism; see Decision §3. **Amends:** [Marking (Authoring) ADR](20260713T140219Z-engineering-audio-marking-authoring.md)'s surviving marker-tool UI premise (already superseded on data format, not UI) — the curator scrub-and-nudge interaction is replaced by a rendered waveform + draggable regions. **Relates:** [Audio Asset Model ADR](20260714T123409Z-engineering-audio-asset-model.md) (unaffected — this ADR does not touch storage).

**Scope:** Which library/engine renders and drives conversation audio playback, for **both** learner-facing playback (`AudioPlayer.vue` / `useSegmentPlayer.ts`) and curator marking (`MarkAudio.vue` / `useMarkerAuthoring.ts`). This is an *implementation-mechanism* decision — it does not change the WebVTT data contract, storage model, or cue-ID scheme.

---

## Context

DS01 (learner playback) and DS02 (marker authoring) shipped against the Playback Model ADR's design: one native `<audio>` element per surface, `currentTime` seek + `timeupdate`-driven stop-at-`audioEnd`.

**EP43-BUG01** surfaced a real defect on a live deck (`73db8f50-a174-433b-93bf-88695038e57c`): audio played past a sentence's marked end into the next sentence. Full diagnosis: `.agents/changelogs/EP43--audio-playback-and-marking/20260714T222419Z-EP43-BUG01-audio-playback-marker-timing.md`.

1. **First-order cause**: the stop-at-`end` check relied solely on the native `timeupdate` event, which fires at an irregular ~4Hz. Observed overshoot ranged 0.22s–2.15s. Stopgap fix (commit `db7a9f3`): replaced the `timeupdate` check with `requestAnimationFrame` polling (~60Hz) in `useSegmentPlayer.ts`, cutting overshoot to single-digit milliseconds.
2. **Second-order, deeper cause**: the user then reported that the *plain scrubber* (manual dragging, unrelated to markers) also lands on the wrong audio content. This cannot be a polling problem — polling only affects *when playback is told to stop*, not *where a seek lands*. Root cause: HTML5 `<audio>`'s native seek is imprecise for this deck's WAV file, independent of any stop logic. No amount of JS-side event polling can fix a seek that has already landed in the wrong place.

A dev-only prototype (commit `b7c51e2`, `PrototypeWavesurfer.vue`, gated behind `env.debugMode`) validated that wavesurfer.js configured with `backend: 'WebAudio'` fixes **both** symptoms: it decodes the file into an `AudioBuffer` up front and plays it via `AudioBufferSourceNode`, giving sample-accurate seeking, plus a native `stopAt()` for segment stop — no polling required at all. (Two prototype-only bugs were found and fixed during validation: the default backend is `'MediaElement'`, i.e. the same native `<audio>` under the hood, so `backend: 'WebAudio'` must be set explicitly; and an early `region-out` handler paused on *any* region's exit rather than only the region being played.)

Separately, the curator marking tool (`MarkAudio.vue`) has always been a **blind** scrub-and-nudge interface — no waveform, no visual feedback for where in/out points land. wavesurfer's Regions plugin renders a waveform with draggable start/end handles and built-in region playback, which is purpose-built for this workflow.

### Alternative considered: Howler.js

Howler's `sprite` API fits pre-defined markers well and is lighter (~8KB gzip vs. wavesurfer core's ~12KB, ~17KB with the Regions plugin). It was rejected because it has no waveform/region UI primitive — the curator tool would still need to be hand-rolled either way, and the seek-precision root cause (native `<audio>`/`MediaElement` seeking) is not addressed by Howler's default `html5` mode. wavesurfer's Regions plugin serves both surfaces with one library and one mental model; the ~9KB extra gzip on the learner-facing player (which itself needs no waveform) was judged an acceptable tradeoff to avoid a second library for the curator side.

---

## Decision

### 1. wavesurfer.js (`WebAudio` backend) replaces native `<audio>` on both surfaces

- **Learner playback** (`AudioPlayer.vue` / `useSegmentPlayer.ts`): wavesurfer instance configured with `backend: 'WebAudio'`, **no waveform rendered** — the visible UI (play/pause, scrubber, speed control) is replicated as-is; only the engine underneath changes. Playback-rate control stays a primary, always-visible control per the Playback Model ADR §4.
- **Curator marking** (`MarkAudio.vue` / `useMarkerAuthoring.ts`): wavesurfer instance **with a rendered waveform** and the **Regions plugin**, replacing the blind scrub-and-nudge UI with draggable start/end region handles and built-in region playback.
- Version pinned: `wavesurfer.js@7.12.10` (`apps/srs-demo/package.json`).

### 2. Segment stop uses wavesurfer's native region/`stopAt()` mechanism, not event polling

The `WebAudio` backend's sample-accurate seek plus native stop-at-position eliminates the class of bug in EP43-BUG01 at the source, rather than papering over it with faster polling. The EP43-BUG01 rAF stopgap in `useSegmentPlayer.ts` is superseded by this pivot; whether it is deleted or left as defense-in-depth is an implementation decision for the follow-up work, not decided here.

### 3. WebVTT remains the timing source of truth; the *consume mechanism* for segment-stop changes

The WebVTT Timing ADR's format, storage, and cue-ID scheme (§1–§5, §7–§8) are unaffected — VTT is still authored, stored, and travels with the audio binary exactly as decided there. What changes is §6's specific claim that the browser's native `TextTrack`/`cuechange` machinery drives segment behaviour: with a wavesurfer `WebAudio`-backend player, the audio is decoded and played outside the native `<audio>` element, so the native `TextTrack`/`cuechange` API no longer has a `<video>`/`<audio>` element to attach to for that purpose. Sentence-highlight/segment-bound driving moves to wavesurfer's own APIs (cues parsed from the same served `.vtt` and mapped to `stopAt()` calls or Regions), sourcing from the identical VTT payload. This is an implementation detail to be resolved in DS03; this ADR fixes only that the mechanism changes, not the replacement's exact shape.

### 4. Package size accepted

Core wavesurfer: ~12KB gzip. Core + Regions plugin (needed for the curator surface): ~17KB gzip. This is ~9KB heavier than Howler for the learner-only surface, accepted per the tradeoff above.

---

## Consequences

**Positive:**

- Fixes EP43-BUG01 at the root (imprecise native seek), not just its symptom (imprecise stop timing) — the earlier rAF stopgap was a partial fix that could not have addressed the scrubber-seek defect.
- One library, one mental model for both learner playback and curator marking, instead of a lightweight player library plus a hand-rolled waveform component.
- The Regions plugin is purpose-built for the marking workflow, addressing the curator tool's blind-editing usability gap as a side effect of the pivot, not a separate project.
- WebVTT's role as the durable, portable timing format (WebVTT Timing ADR) is untouched — this pivot is confined to the playback/authoring engine.

**Negative:**

- ~9KB extra gzip on the learner-facing player versus the rejected Howler alternative, for a waveform capability that surface does not use.
- The native `TextTrack`/`cuechange` consume path decided in the WebVTT Timing ADR §6 must be re-implemented against wavesurfer's own cue/region APIs — added implementation work, deferred to DS03.
- Two more files to rebuild beyond the prototype: `useSegmentPlayer.ts`/`AudioPlayer.vue` (learner) and `useMarkerAuthoring.ts`/`MarkAudio.vue` (curator), plus retiring the dev-only `PrototypeWavesurfer.vue` once the real swap lands.

**Neutral:**

- `decks.audio_key` / bucket storage (Asset Model ADR) and the WebVTT format/hash-stamp/two-tier storage (WebVTT Timing ADR §1–§5, §7–§8) are unchanged.
- The visible learner UI/UX (play/pause, scrubber, speed control) is unchanged by design — only the engine underneath differs.

---

## Open Questions (→ EP43-DS03)

| Question | Owner |
| -------- | ----- |
| Exact mechanism for sourcing per-sentence cues into wavesurfer (parsed VTT → Regions vs. `stopAt()` calls) | Dev (DS03) |
| Marker-authoring UX improvement: auto-populate sentence N+1's start from sentence N's committed end | Dev (DS03) |
| Whether the EP43-BUG01 rAF stopgap in `useSegmentPlayer.ts` is deleted (superseded) or kept as defense-in-depth | Dev (DS03) |
| Whether `PrototypeWavesurfer.vue` is deleted once the real swap lands, or kept briefly for reference | Dev (DS03) |
