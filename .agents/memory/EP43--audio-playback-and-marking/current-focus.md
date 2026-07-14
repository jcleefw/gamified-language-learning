# Current Focus — EP43: wavesurfer.js pivot (post-BUG01)

**Status**: EP42/EP43 (audio-table + WebVTT) shipped and committed on this branch. A real playback bug
(EP43-BUG01) was found, diagnosed, stopgap-fixed, and root-caused deeper than the stopgap — **decision made
to pivot the player to wavesurfer.js**. **ADR written and accepted**: [wavesurfer.js Pivot ADR](../../../product-documentation/architecture/20260714T234735Z-engineering-audio-wavesurfer-pivot.md).
Next deliverable: **EP43-DS03** design spec (not yet written).
**Branch**: `EP42--create-bucket-for-audio` (still unmerged to main).
**Last updated**: 20260714

---

## EP43-BUG01 — what happened, in order

1. **Reported**: learner audio didn't follow WebVTT marker boundaries on deck
   `73db8f50-a174-433b-93bf-88695038e57c` — clicking a sentence sometimes played into the next one.
2. **Diagnosed** (full writeup: `.agents/changelogs/EP43--audio-playback-and-marking/20260714T222419Z-EP43-BUG01-audio-playback-marker-timing.md`):
   added `[AUDIO]`-tagged logging across `useSegmentPlayer.ts`/`AudioPlayer.vue`/`QuizCard.vue`/`DeckOverview.vue`.
   Live trace showed VTT cues and cue-lookup were correct; the actual defect was `playSegment()`'s stop-at-`end`
   check relying solely on the native `timeupdate` event (~4Hz, irregular) — observed overshoot ranged from
   0.22s up to 2.15s (played straight through the next marked sentence).
3. **Stopgap fix** (commit `db7a9f3`): replaced the `timeupdate` check with `requestAnimationFrame` polling
   (~60Hz) in `useSegmentPlayer.ts`. Cut overshoot to single-digit milliseconds.
4. **Bigger problem surfaced**: user reported the *plain scrubber* (dragging, unrelated to markers) also lands
   on the wrong audio content — an rAF-based JS check can't fix a seek that already lands in the wrong place.
   Root cause: HTML5 `<audio>`'s native WAV seeking is imprecise for this deck's file, independent of our stop
   logic entirely.
5. **wavesurfer.js prototype** (commit `b7c51e2`, dev-only behind `env.debugMode`, "WS proto" nav button →
   `PrototypeWavesurfer.vue`): validated that wavesurfer.js's `backend: 'WebAudio'` (decodes to an `AudioBuffer`,
   plays via `AudioBufferSourceNode`, sample-accurate seek + a native `stopAt()` — no polling at all) fixes
   **both** symptoms. Confirmed live against the same deck after two prototype-only bugs were fixed (missing
   `backend: 'WebAudio'` — default is `'MediaElement'`, i.e. the same native `<audio>` under the hood; and a
   `region-out` handler that paused on *any* region's exit, not just the one being played).

**Decision**: pivot the real player (`useSegmentPlayer.ts`/`AudioPlayer.vue`) and the curator marking tool
(`useMarkerAuthoring.ts`/`MarkAudio.vue`) to wavesurfer.js. Package size measured: core ~12KB gzip,
core+Regions plugin ~17KB gzip (vs. Howler's ~8KB, which was considered and rejected — see below).

## Why wavesurfer over Howler (considered and rejected)

Howler's `sprite` API fits pre-defined markers well and is lighter (~8KB), but has no waveform/region UI
primitive — the curator tool would still be hand-rolled either way. wavesurfer's Regions plugin is
purpose-built for the marking workflow (draggable start/end handles on a rendered waveform, built-in
region playback) and can serve both surfaces with one library and mental model. The ~9KB extra gzip on the
learner-facing player (which doesn't need a waveform) was judged an acceptable tradeoff for that.

## Next steps (not started — this is the recorded plan, not a commit)

1. **Write an ADR** for the pivot to wavesurfer.js (supersedes/amends the existing playback ADR's assumption
   of native `<audio>` + `TextTrack`/`cuechange`).
2. **Write EP43-DS03 design spec** — "implement wavesurfer.js into the codebase" — covering:
   - **Learner view** (`AudioPlayer.vue`): media controls only, **no waveform** — replicate the current
     play/pause/scrubber/speed-control UI/UX as-is, just backed by wavesurfer's `WebAudio` backend instead of
     a native `<audio>` element. Playback speed must stay easy to reach (it's a primary, always-visible
     control today — ADR §4).
   - **Curator view** (`MarkAudio.vue`): **waveform should be visible** (via wavesurfer + Regions plugin),
     replacing/augmenting the current blind scrub-and-nudge marking UI.
   - **Marker UX improvement**: today the curator must click sentence N's end, then separately click
     sentence N+1's start at the *same* point — request: auto-populate the next sentence's start from the
     previous sentence's committed end (or a better UX than manual duplication). Needs a UX proposal in the
     design spec, not just a code note.
3. Only after the ADR + DS03 are written and reviewed: implement the real swap in `useSegmentPlayer.ts`/
   `AudioPlayer.vue`/`useMarkerAuthoring.ts`/`MarkAudio.vue`, retire `PrototypeWavesurfer.vue`, and consider
   whether the EP43-BUG01 rAF stopgap should be deleted (superseded) or left as defense-in-depth.

## Reference

- Prototype: `apps/srs-demo/src/components/PrototypeWavesurfer.vue`, reached via the "🌊 WS proto" button
  (shows only under `env.debugMode`, i.e. any `pnpm dev` run) — `screen = 'ws-proto'` in `App.vue`/`types.ts`.
- BUG report: `.agents/changelogs/EP43--audio-playback-and-marking/20260714T222419Z-EP43-BUG01-audio-playback-marker-timing.md`.
- wavesurfer.js version pinned: `7.12.10` (`apps/srs-demo/package.json`).
