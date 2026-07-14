# EP43-DS03: wavesurfer.js Implementation Swap (Learner Playback + Curator Marking) Specification

**Date**: 20260715T000417Z
**Status**: Accepted
**Epic**: [EP43 - Audio Playback & Marking UI](../../plans/epics/EP43-audio-playback-and-marking.md)

**Architecture**:
- [wavesurfer.js Pivot ADR](../../../product-documentation/architecture/20260714T234735Z-engineering-audio-wavesurfer-pivot.md) — Accepted. **The governing ADR**: native `<audio>` → wavesurfer.js (`backend: 'WebAudio'`) on both surfaces; Regions plugin for curator marking; WebVTT format/storage/cue-ID unchanged (only the consume mechanism changes).
- [WebVTT Timing ADR](../../../product-documentation/architecture/20260714T123438Z-engineering-audio-timing-webvtt.md) — Accepted (amended). §6's native `TextTrack`/`cuechange` consume path is replaced by manual VTT parsing (`parseVtt`) + wavesurfer's own timing (see Decision §2 below).
- [Playback Model ADR](../../../product-documentation/architecture/20260713T140218Z-engineering-audio-playback-model.md) — Accepted (amended twice). §4's one-`<audio>`-per-surface model is replaced; behaviour (seek → play → pause-at-end, speed control) is preserved.

**Depends on**: [EP43-DS01](20260713T232015Z-EP43-DS01-learner-audio-playback-ui.md) (the `SegmentPlayer`/`AudioPlayer.vue` public contract this DS keeps stable) + [EP43-DS02](20260713T232015Z-EP43-DS02-marker-authoring-tool.md) (`useMarkerAuthoring`/`MarkAudio.vue`, `buildVtt`/`parseVtt` in `@gll/api-contract`) + the EP43-BUG01 diagnosis and `PrototypeWavesurfer.vue` spike (commits `8aa9efd`, `db7a9f3`, `b7c51e2`).

---

## 1. Feature Overview

DS01/DS02 shipped a native-`<audio>` player. EP43-BUG01 found that native `<audio>`'s WAV seek is imprecise — independent of any stop-logic fix — and a dev-only prototype validated that wavesurfer.js's `WebAudio` backend (decode-to-`AudioBuffer`, play via `AudioBufferSourceNode`) fixes it, with a native `stopAt()` replacing all `timeupdate`/`requestAnimationFrame` polling. The Pivot ADR accepted this; this DS is the implementation swap.

Two surfaces, one shared engine change:

- **Learner playback** (`AudioPlayer.vue`/`useSegmentPlayer.ts`) — the **public `SegmentPlayer` contract is unchanged** (`currentTime`/`duration`/`playing`/`rate`/`activeCueId`/`play`/`pause`/`seek`/`setRate`/`playSegment`/`playCue`), so `DeckOverview.vue` and `QuizCard.vue` (DS01 ST02/ST03) need **no changes at all**. Only the composable's internals move from an `HTMLAudioElement` to a `WaveSurfer` instance. No waveform is rendered on this surface — the container exists (wavesurfer needs one to run its decode/playback engine) but stays visually collapsed.
- **Curator marking** (`MarkAudio.vue`/`useMarkerAuthoring.ts`) — gains a **visible waveform** with the Regions plugin: each fully-marked sentence renders as a draggable region, two-way synced with the existing marker table (Set In/Out buttons + keyboard nudge stay — the waveform augments them, per the ADR, it doesn't replace them). `useMarkerAuthoring` also gains the requested **auto-populate** improvement: committing a sentence's *out* point pre-fills the *next* sentence's *in* point with the same time, if that next row has no start yet.

Boundary preserved from DS01/DS02: `AudioPlayer.vue` stays curator-agnostic. It exposes the raw `WaveSurfer` instance (for `MarkAudio.vue` to register the Regions plugin on) but never imports or knows about Regions/markers itself.

**What is reused, not rebuilt:** the `SegmentPlayer` interface and its consumers (`DeckOverview.vue`, `QuizCard.vue`); the marker state model (`markers`/`setIn`/`nudge`/`isComplete`/`quantize`, ±0.05/±0.01 nudge); `buildVtt`/`parseVtt` (`@gll/api-contract`); `commitDeckVtt`/`fetchDeckVtt`; the `env.curatorMode`/`GLL_CURATOR_MODE` gates; `wavesurfer.js@7.12.10` + its Regions plugin (already a dependency, validated by the prototype).

**Not in this DS:** any change to the WebVTT format, storage, hash-stamp, or server-write endpoint (WebVTT Timing ADR, DS02 ST05 — untouched); the server-side VTT round-trip; word-level marking; a dedicated `apps/curator` app.

## 2. Core Requirements

| Requirement | Decision | Rationale |
| --- | --- | --- |
| Engine | `WaveSurfer.create({ container, url: src, backend: 'WebAudio' })` inside `useSegmentPlayer`/`AudioPlayer.vue`, replacing the `<audio>` element entirely | Pivot ADR §1; sample-accurate seek + native `stopAt()` |
| `SegmentPlayer` public contract | **Unchanged** — same fields/methods, same call sites in `DeckOverview.vue`/`QuizCard.vue`/`MarkAudio.vue` | Confines the pivot to two files; zero ripple into DS01 ST02/ST03 |
| Segment stop | `playSegment(start, end)`/`playCue(sentenceId)` call `ws.play(start, end)`; wavesurfer schedules its own precise stop (`WebAudioPlayer.stopAt()`, Web-Audio-clock-scheduled) | Validated by the prototype (commit `b7c51e2`); replaces the rAF stopgap entirely — see Consequences |
| Cue source | VTT is fetched (`fetch(vttUrl)`) and parsed with `parseVtt` (`@gll/api-contract`) into an in-memory `{id,start,end}[]`, **not** a native `<track>`/`TextTrack` | `WebAudio` backend plays via `AudioBufferSourceNode` outside any `<audio>` element — there is no element for `<track>` to attach to (WebVTT Timing ADR §6 amendment) |
| Active-cue highlight | Recomputed on wavesurfer's own `timeupdate` event: linear scan of the parsed cues for the one containing `currentTime` | Replaces native `cuechange`; a deck's cue list is small (tens of sentences), scan cost is negligible |
| Rate control | `ws.setPlaybackRate(rate, true)` (`preservePitch = true`) | Matches native `<audio>`'s default pitch-preserving behaviour that DS01 shipped with |
| Scrubbing | `ws.setTime(t)` (seek), `ws.getCurrentTime()`/`ws.getDuration()` (readout) | Same API the prototype validated |
| Learner waveform visibility | **None rendered.** `AudioPlayer.vue` keeps a container `<div>` in normal flow (non-zero width, `height: 0; overflow: hidden`) — wavesurfer needs a mounted container to run, but nothing is shown | Pivot ADR: learner surface is "media controls only, no waveform"; a zero-width/`display:none` container risks wavesurfer failing to size its internal canvas |
| Curator waveform visibility | `AudioPlayer.vue` gains a `showWaveform?: boolean` prop toggling the container to a real height (~80px, matching the prototype) | Pivot ADR: curator surface needs a visible waveform |
| Curator-agnostic boundary | `AudioPlayer.vue` exposes the raw `WaveSurfer` instance via `defineExpose`; it does **not** import or register the Regions plugin itself — `MarkAudio.vue` registers Regions on the exposed instance | Preserves the DS01/DS02 rule that the shared primitive knows nothing about curator/deck concepts (grep-checked) |
| Region ↔ marker sync | A row becomes a draggable `Region` once `isComplete`; dragging (`region-updated`) calls the *same* `authoring.setIn`/`setOut` the table buttons call; programmatic marker changes reconcile regions via `region.setOptions()` (not re-created) | One source of truth (`authoring.markers`); avoids fighting the user mid-drag |
| Auto-populate next start | `setOut(sentenceId, time)` looks up the *next* sentence (by the order passed to `seed`); if that row's `start` is still `null`, it is auto-set to the same (quantised) time — never overwrites an already-set start | Requested marker-UX improvement (current-focus.md); removes the "click the same point twice" toil while staying non-destructive |
| Full-file decode | The `WebAudio` backend fetches + decodes the **entire** binary before playback can start (no HTTP range streaming, unlike `MediaElement`) | Accepted tradeoff — deck conversation files are short and served with `Cache-Control: immutable` (Playback ADR §7), so this cost is paid once per session, not per play |
| Test strategy | Unit tests mock `wavesurfer.js`'s `WaveSurfer.create` (a fake instance exposing `on`/`play`/`pause`/`setTime`/`setPlaybackRate`/`getDuration`/`getCurrentTime`/`destroy`) | jsdom has no Web Audio decode; the real library can't run in the existing Vitest environment, same constraint DS01 accepted for `HTMLAudioElement` |
| Retirement | `PrototypeWavesurfer.vue`, its `env.debugMode`-gated nav entry, and the `'ws-proto'` screen (`App.vue`/`types.ts`) are deleted; the EP43-BUG01 rAF `playSegment` polling loop and its `[AUDIO]` diagnostic `console.log`s are removed (superseded by native `stopAt()`, not kept as defense-in-depth) | The prototype's job is done; polling is now provably unnecessary; the BUG01 logs targeted a bug this pivot fixes structurally |

## 3. Data Structures

```typescript
// ── ST06: SegmentPlayer — PUBLIC CONTRACT UNCHANGED (apps/srs-demo/src/composables/useSegmentPlayer.ts)
export interface SegmentPlayer {
  currentTime: Ref<number>;
  duration: Ref<number>;
  playing: Ref<boolean>;
  rate: Ref<1 | 0.75 | 0.5>;
  activeCueId: Ref<string | null>;
  play(): void;
  pause(): void;
  seek(t: number): void;
  setRate(r: 1 | 0.75 | 0.5): void;
  playSegment(start: number, end: number): void;
  playCue(sentenceId: string): void;
}

// Signature changes: wavesurfer needs a container + a URL at creation time,
// not a pre-existing <audio> element with a `src` attribute.
export function useSegmentPlayer(
  container: Ref<HTMLElement | null>,
  src: Ref<string>,
  vttUrl?: Ref<string | undefined>,
): SegmentPlayer & {
  /** Exposed so AudioPlayer.vue can pass it up to MarkAudio.vue for Regions. Null until created. */
  wavesurfer: Ref<WaveSurfer | null>;
};
// Internally: creates WaveSurfer once `container.value` mounts; `backend: 'WebAudio'`.
// Watches `src` → ws.load(newSrc) on deck switch. Watches `vttUrl` → fetch + parseVtt,
// store `cues: {id,start,end}[]`; recompute `activeCueId` on the 'timeupdate' event by
// scanning `cues` for one containing `currentTime`. `playCue`/`playSegment` both resolve
// to `ws.play(start, end)`. `destroy()` on unmount.

// ── ST06: AudioPlayer.vue ──────────────────────────────────────────────────────
// <AudioPlayer :src="audioUrl" :vttUrl="vttUrl" :show-waveform="false" ref="player" />
//   <div ref="waveformEl" class="waveform-container" :class="{ visible: showWaveform }"></div>
//   … transport (play/pause/scrubber/mm:ss.cs) + speed control UNCHANGED …
// defineExpose<SegmentPlayer & { wavesurfer: WaveSurfer | null }>(player)
// .waveform-container      { height: 0; overflow: hidden; }   /* learner: present but invisible */
// .waveform-container.visible { height: 80px; overflow: visible; margin-bottom: 8px; }

// ── ST07: MarkerAuthoring — auto-populate addition (apps/srs-demo/src/composables/useMarkerAuthoring.ts)
export interface MarkerAuthoring {
  markers: Ref<Record<string, MarkerDraft>>;
  seed(sentenceIds: string[], existingVtt?: string): void;   // now also stores sentenceIds as `order`
  setIn(sentenceId: string, time: number): void;
  /** Sets this row's end. If the NEXT sentence in `order` has start === null,
   *  it is auto-set to this same (quantised) time. Never overwrites an existing start. */
  setOut(sentenceId: string, time: number): void;
  nudge(sentenceId: string, edge: 'start' | 'end', delta: number): void;
  isComplete(sentenceId: string): boolean;
  buildVtt(audioSha256: string): string;
}

// ── ST07: MarkAudio.vue — Regions wiring (registered on the exposed instance) ──
// import RegionsPlugin from 'wavesurfer.js/plugins/regions';
// const regions = player.value!.wavesurfer!.registerPlugin(RegionsPlugin.create());
// Reconciliation: watch(authoring.markers, syncRegions, { deep: true })
//   for each sentenceId: isComplete → addRegion({id, start, end, drag:true, resize:true})
//                          if a region already exists → region.setOptions({start, end})
//                         !isComplete → remove any existing region for that id
// regions.on('region-updated', (region) => {
//   authoring.setIn(region.id, region.start);
//   authoring.setOut(region.id, region.end);   // may auto-populate the NEXT row's start
// });
// Clicking a region: player.value!.playSegment(region.start, region.end);
```

## 4. User Workflows

```
# Learner (DeckOverview / QuizCard word-block) — behaviour UNCHANGED from DS01
open overview → AudioPlayer(:src=deck.audioUrl :vttUrl=deck.vttUrl, showWaveform=false)
  → ▶ Play          → whole conversation from currentTime (ws.play())
  → click sentence  → playCue(sentenceId) → ws.play(cue.start, cue.end), native stopAt()
  → active cue      → timeupdate scan of parsed cues → activeCueId → highlight row
  → speed [0.5×]    → ws.setPlaybackRate(0.5, true)
  (no visible waveform on this surface; container is present but height:0)

# Curator (MarkAudio.vue) — waveform + regions augment the existing table
open "Mark audio" → pick deck → AudioPlayer(:src :showWaveform=true) renders a waveform
  → seed() hydrates the table AND draws a Region for every already-complete row (from existing VTT)
  → per sentence: Set In / Set Out buttons (unchanged) OR drag a region's handles on the waveform
  → Set Out (button or drag) on sentence N
       → if sentence N+1's start is unset → auto-fills it to the same time
       → curator can still override N+1's start manually (button or drag) — never re-clobbered
  → Preview → click the region, or the existing Preview button → playSegment(start, end)
  → Commit → buildVtt(audioHash) → PUT .../audio/vtt (unchanged from DS02 ST05)

# Degrade / risk paths
container fails to size before ws.create() → wavesurfer errors → surfaced via existing 'error' handling (no play control, same silent-degrade posture as a missing audioUrl)
vttUrl fetch/parse fails               → cues = [] → playCue no-ops for every sentence (same as "no cue" in DS01)
region-updated fires from a PROGRAMMATIC setOptions() (not user drag) → would create a sync loop
  → verified against the Regions plugin: setOptions() does not re-emit 'region-updated' (interaction-only event) — confirmed as an acceptance criterion, not assumed
```

## 5. Stories

### EP43-ST06: Learner audio-player primitive on wavesurfer.js (WebAudio backend) *(Done)*

**Scope**: `apps/srs-demo` — rewrite `useSegmentPlayer.ts` internals + `AudioPlayer.vue`'s template around a `WaveSurfer` instance. `SegmentPlayer`'s public shape does not change.
**Read List**: current `useSegmentPlayer.ts`, `AudioPlayer.vue`, `PrototypeWavesurfer.vue` (the validated `backend: 'WebAudio'` config + `ws.play(start,end)` usage), `packages/api-contract/src/vtt.ts` (`parseVtt`), existing `useSegmentPlayer.test.ts`.
**Tasks**:

- [x] Replace the `<audio>` element with `WaveSurfer.create({ container, url: src, backend: 'WebAudio' })`; watch `src` for deck switches (`ws.load`).
- [x] Fetch + `parseVtt(vttUrl)` into `cues`; drive `activeCueId` off wavesurfer's `timeupdate` (scan `cues`), not a native `TextTrack`.
- [x] `playSegment`/`playCue` call `ws.play(start, end)`; delete the rAF polling loop (`cancelPendingSegment`, `requestAnimationFrame` tick) — no longer needed.
- [x] `seek`/`setRate`/`play`/`pause` map to `ws.setTime`/`ws.setPlaybackRate(r, true)`/`ws.play`/`ws.pause`; `duration`/`currentTime`/`playing` update from wavesurfer's `ready`/`timeupdate`/`play`/`pause` events.
- [x] `AudioPlayer.vue`: add the (visually collapsed) waveform container div; add the `showWaveform` prop (default `false`) controlling its height; `defineExpose` the `WaveSurfer` instance alongside the existing `SegmentPlayer` fields.
- [x] Remove the `[AUDIO]`-tagged `console.log` diagnostic instrumentation added for EP43-BUG01.
- [x] Update `useSegmentPlayer.test.ts` to mock `wavesurfer.js`'s default export instead of a real/mocked `HTMLAudioElement`.

**Acceptance Criteria**:

- [x] `DeckOverview.vue` and `QuizCard.vue` require **no code changes** (grep confirms no edits beyond this DS's two files' internals).
- [x] `playCue('S1')` seeks to S1's cue start, plays, and stops at its end via wavesurfer's own scheduling (mocked instance asserts `ws.play(start, end)` was called with the parsed cue's bounds — no polling/`requestAnimationFrame` call present).
- [x] Speed control still shows all three rates, active highlighted, and calls `setPlaybackRate` with `preservePitch = true`.
- [x] With `showWaveform=false` (default), no waveform is visually rendered (container height 0); with `showWaveform=true`, the container has a visible non-zero height.
- [x] A grep confirms no remaining `requestAnimationFrame`/`cancelAnimationFrame` or `[AUDIO]` console logging in `useSegmentPlayer.ts`.

Manually tested and confirmed by PO (deck `73db8f50-a174-433b-93bf-88695038e57c`, commit `10959f2`).

### EP43-ST07: Curator waveform + Regions plugin + auto-populate-next-start

**Scope**: `apps/srs-demo` — `MarkAudio.vue` mounts `AudioPlayer` with `showWaveform`, registers the Regions plugin on the exposed instance, and two-way syncs regions with `authoring.markers`; `useMarkerAuthoring.ts` gains the auto-populate rule.
**Read List**: current `MarkAudio.vue`, `useMarkerAuthoring.ts`, `PrototypeWavesurfer.vue` (Regions registration + the `region-out` pitfall already documented there), `useMarkerAuthoring.test.ts`.
**Tasks**:

- [ ] `MarkAudio.vue`: `<AudioPlayer ref="player" :src="deck.audioUrl!" :show-waveform="true" />`; on mount, `registerPlugin(RegionsPlugin.create())` on `player.value.wavesurfer`.
- [ ] `useMarkerAuthoring.seed(sentenceIds, existingVtt?)`: also store `sentenceIds` as the row order used by the auto-populate lookup.
- [ ] `useMarkerAuthoring.setOut`: after setting this row's end, look up the next id in `order`; if its `start === null`, set it to the same quantised time.
- [ ] Region reconciliation: a `watch(authoring.markers, …, { deep: true })` that adds/updates/removes one `Region` per row keyed on `isComplete`, using `region.setOptions()` for updates (not remove+recreate).
- [ ] `region-updated` handler calls `authoring.setIn`/`setOut` with the region's post-drag `start`/`end` — the same setters the table buttons use.
- [ ] Clicking a region previews it (`player.value.playSegment(region.start, region.end)`).
- [ ] Keep the existing table (Set In/Out buttons, keyboard nudge, Preview, Commit, Download, Reset) working unchanged alongside the waveform.

**Acceptance Criteria**:

- [ ] Marking sentence N's out point (button or drag) with sentence N+1's start currently unset auto-fills N+1's start to the same time; if N+1's start was already set, it is left untouched.
- [ ] Dragging a region's handle updates the corresponding table row's in/out values; editing a row's in/out via button+nudge updates (not recreates) that row's region.
- [ ] Programmatically updating a region via `setOptions()` does **not** re-fire `region-updated` (verified against the installed `wavesurfer.js@7.12.10` Regions plugin) — no sync loop.
- [ ] Seeding a deck with an existing VTT draws a region for every already-complete row before any interaction.
- [ ] `useMarkerAuthoring`'s auto-populate behaviour is covered by a unit test with no DOM/wavesurfer dependency.

### EP43-ST08: Retire the wavesurfer prototype and the superseded rAF stopgap

**Scope**: `apps/srs-demo` — delete now-redundant dev-only/diagnostic code once ST06/ST07 land.
**Read List**: `App.vue`/`types.ts` (`'ws-proto'` screen + `env.debugMode` nav entry), `PrototypeWavesurfer.vue`.
**Tasks**:

- [ ] Delete `PrototypeWavesurfer.vue` and its `env.debugMode`-gated "🌊 WS proto" nav button + `'ws-proto'` screen wiring in `App.vue`/`types.ts`.
- [ ] Confirm (via ST06's grep AC) that the EP43-BUG01 rAF polling loop is gone from `useSegmentPlayer.ts` — this story is the cleanup checkpoint, not new removal work.

**Acceptance Criteria**:

- [ ] No references to `PrototypeWavesurfer` or `'ws-proto'` remain in `apps/srs-demo/src`.
- [ ] `pnpm -r typecheck` passes with the prototype removed.

## 6. Success Criteria

1. Learner playback behaves exactly as DS01 specified (whole-conversation play, click-to-play-cue-segment, speed control, silent degrade) but is backed by wavesurfer.js's `WebAudio` backend — `DeckOverview.vue`/`QuizCard.vue` are untouched.
2. EP43-BUG01 cannot recur structurally: no polling drives segment stop anywhere in the codebase; wavesurfer's native `stopAt()` is the only stop mechanism.
3. The curator marking tool shows a visible, interactive waveform (drag-to-adjust regions) *in addition to* the existing table/keyboard workflow, and auto-populates the next sentence's start from the previous sentence's committed end.
4. `AudioPlayer.vue` remains curator-agnostic (no Regions/marker imports); `MarkAudio.vue` owns all Regions wiring.
5. `PrototypeWavesurfer.vue` and the EP43-BUG01 rAF stopgap are deleted; `pnpm -r typecheck` and the test suite pass.
