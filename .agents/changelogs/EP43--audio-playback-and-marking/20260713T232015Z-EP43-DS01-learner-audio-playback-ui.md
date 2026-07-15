# EP43-DS01: Learner Audio Playback UI (WebVTT consume) Specification

**Date**: 20260713T232015Z
**Redefined**: 20260714 — consume timing from a served `.vtt` via the browser's native `TextTrack`/`cuechange` (Option C), not per-line `audioStart`/`audioEnd`.
**Status**: Draft (retrofit; DS01 v1 shipped against per-line numbers)
**Epic**: [EP43 - Audio Playback & Marking UI](../../plans/epics/EP43-audio-playback-and-marking.md)

**Architecture**:
- [WebVTT Timing ADR](../../../product-documentation/architecture/20260714T123438Z-engineering-audio-timing-webvtt.md) — Accepted. **§6 Option C governs this DS's consume path**: the browser attaches the served `.vtt` as a `TextTrack`; `cuechange` (cue-ID = `sentenceId`) drives sentence highlighting + segment bounds. No per-line numbers, no server-side parse.
- [Playback Model ADR](../../../product-documentation/architecture/20260713T140218Z-engineering-audio-playback-model.md) — Accepted (consume mechanism amended to Option C). §3 two surfaces, §4 one `<audio>`/surface + rate control, §5 engine stays audio-free, §6 silent degrade.

**Depends on**: [EP42-DS01](../EP42--deck-audio-storage-and-retrieval/20260713T005450Z-EP42-DS01-deck-audio-storage-and-retrieval.md) (`audioUrl`/`vttUrl` wire fields) + [EP42-DS02](../EP42--deck-audio-storage-and-retrieval/20260713T222600Z-EP42-DS02-curator-audio-upload-ui.md) (a curated binary) + a VTT authored by [EP43-DS02](20260713T232015Z-EP43-DS02-marker-authoring-tool.md).

---

## 1. Feature Overview

EP42 emits `AppDeckPayload.audioUrl` + `vttUrl` on `GET /api/decks`, but `srs-demo` renders **no `<audio>` anywhere**. This DS mounts audio on the two learner surfaces the playback ADR §3 fixes — and sources **all per-sentence timing from the served VTT track**, not from wire numbers (which no longer exist).

The design is a **primitive + two thin mounts**, turning on two boundaries:

- **Timing is a browser concern (WebVTT ADR §6).** The `AudioPlayer` attaches `vttUrl` as a `<track kind="metadata">`. The browser parses it; `cuechange` fires as the play-head crosses cue boundaries; a cue's ID is the `sentenceId` and its `[startTime, endTime]` are the segment bounds. We compute no "which sentence is playing" — the subtitle engine does.
- **Audio stays out of the engine (playback ADR §5).** `QuizQuestion`/`SentenceQuestion` gain no audio field; `ReviewQuestionType` stays `'mcq' | 'word-block'`. The Vue layer resolves a sentence's *deck* audio (`audioUrl` + `vttUrl`) from the `appDecks` payload it already holds and asks the player to `playCue(sentenceId)`.

Three parts:

- **Shared player primitive (ST01)** — `useSegmentPlayer` (transport: `play`/`pause`/`seek`/`setRate`, a `timeupdate` auto-pause, `mm:ss.cs` readout) + `AudioPlayer.vue` (one `<audio>` + optional `<track :src=vttUrl>`, scrubber, a **primary always-visible** 1×/0.75×/0.5× control). New for VTT: `playCue(sentenceId)` (find the cue by id, seek to `startTime`, play, pause at `endTime`) and `activeCueId` (the current cue's id, from `cuechange`). Knows nothing about decks — just `src`, `vttUrl`, and cue ids. DS02's marker tool is its third mount.
- **`DeckOverview` mount (ST02)** — mount `AudioPlayer(:src=deck.audioUrl :vttUrl=deck.vttUrl)`; ▶ plays the whole conversation; clicking a sentence row → `playCue(sentenceId)`; the row whose cue is `activeCueId` gets a "playing" highlight. Absent `vttUrl` ⟹ whole-file play only (rows not click-to-segment); absent `audioUrl` ⟹ no player.
- **`QuizCard` word-block mount (ST03)** — `App.vue` resolves the current question's `sentenceId` → its deck's `{ audioUrl, vttUrl }` and passes it as an optional prop; present ⟹ a "▶ Play sentence" control calling `playCue(sentenceId)`. MCQ never gets audio.

**Silent degradation stays first-class (playback ADR §6):** no `audioUrl` ⟹ no player; no `vttUrl` ⟹ no per-sentence segmenting; a `sentenceId` with no matching cue ⟹ `playCue` no-ops (no control shown when we can't know a cue exists is handled by the "deck has vttUrl" guard — a missing cue simply does nothing, never errors). Audio never gates answering.

**What is reused, not built:** `AppDeckPayload.audioUrl`/`vttUrl` (EP42 wire); the boot-time `appDecks` in `App.vue`; `DeckOverview`'s per-sentence rendering + `:deck` prop; `QuizCard`'s `SentenceQuestion` word-block branch; the scoped-style + `defineProps`/`defineExpose` idiom.

**Not in this DS:** the marker tool + VTT server-write (EP43-DS02); any storage/wire/schema change (EP42 owns it); word-level cue highlighting (namespace reserved, not built); MCQ audio; iOS session-unlock hardening beyond tap-to-play.

## 2. Core Requirements

| Requirement | Decision | Rationale |
| --- | --- | --- |
| Player primitive | One `AudioPlayer.vue` wrapping one `<audio>` + optional `<track kind="metadata" :src=vttUrl>`, backed by `useSegmentPlayer`; learner-agnostic | Playback ADR §4; ADR mandates one shared component across surfaces |
| Timing source | The served VTT `TextTrack` — cues keyed by `sentenceId` | WebVTT ADR §6 Option C; browser parses, no wire numbers, no server parse |
| Segment playback | `playCue(sentenceId)`: find the cue by id in `track.cues`, `seek(cue.startTime)` → play → pause at `cue.endTime` (a `timeupdate` listener cleared on pause/seek/rate-change) | ADR §4 primitive re-sourced to cues; auto-pause must not survive a scrub-away |
| Active sentence | `activeCueId` updated on the track's `cuechange` (first active cue's id) | Browser subtitle engine drives highlight; no manual `currentTime ∈ [s,e]` compute |
| Track mode | `track.mode = 'hidden'` (metadata; cues fire `cuechange` without rendering captions) | We want cue events + programmatic access, not visible subtitles |
| Speed control | Segmented `[1× | 0.75× | 0.5×]`, primary + always visible; sets `audio.playbackRate` | Playback ADR §4 + PRD; same control the curator uses |
| Audio resolution | Vue-layer `resolveSentenceAudio(appDecks, sentenceId) → { audioUrl, vttUrl } | null`; **no engine/question change** | Playback ADR §5; deck-level audio, sentence targeting via `playCue` |
| `DeckOverview` audio | `AudioPlayer(:src=deck.audioUrl :vttUrl=deck.vttUrl)`; click sentence → `playCue(sentenceId)`; highlight `activeCueId` | Playback ADR §3 surface 1 |
| `QuizCard` audio | Optional `audio?: { audioUrl; vttUrl; sentenceId }` prop; word-block + present ⟹ a play-segment control → `playCue(sentenceId)` | Playback ADR §3 surface 2; `QuizCard` stays dumb |
| MCQ audio | None — control renders only for `kind === 'word-block'` with resolved deck audio | Playback ADR §3 |
| Missing audio | No `audioUrl` ⟹ no player; no `vttUrl` ⟹ no per-sentence segmenting; no cue ⟹ `playCue` no-ops | Playback ADR §6 silent degrade |
| Engine / wire / schema | **No change** — read-only consumption of EP42's `audioUrl`/`vttUrl` | Additive UI only |

## 3. Data Structures

```typescript
// ── ST01: segment-player primitive (apps/srs-demo/src/composables/useSegmentPlayer.ts)
export interface SegmentPlayer {
  currentTime: Ref<number>;
  duration: Ref<number>;
  playing: Ref<boolean>;
  rate: Ref<1 | 0.75 | 0.5>;
  activeCueId: Ref<string | null>;   // from the track's cuechange (first active cue id)
  play(): void;
  pause(): void;
  seek(t: number): void;
  setRate(r: 1 | 0.75 | 0.5): void;
  /** Find the cue whose id === sentenceId; seek to its startTime, play,
   *  pause when currentTime >= its endTime. No-op if the cue is absent. */
  playCue(sentenceId: string): void;
}
export function useSegmentPlayer(
  el: Ref<HTMLAudioElement | null>,
  track: Ref<TextTrack | null>,   // the metadata track once loaded
): SegmentPlayer;

// ── ST01: AudioPlayer.vue ─────────────────────────────────────────────────────
// <AudioPlayer :src="audioUrl" :vttUrl="vttUrl" ref="player" />
//   renders <audio :src><track v-if="vttUrl" kind="metadata" :src="vttUrl" default></audio>,
//   sets the loaded track's mode='hidden', wires cuechange → activeCueId,
//   play/pause, scrubber (currentTime/duration), mm:ss.cs readout, and a PRIMARY
//   always-visible segmented [1×|0.75×|0.5×] control. defineExpose(SegmentPlayer).

// ── ST03: Vue-layer audio resolution (apps/srs-demo/src/composables/useAudio.ts) ──
export interface DeckAudio { audioUrl: string; vttUrl: string }
// Finds the deck containing sentenceId; returns { audioUrl, vttUrl } only when the
// deck has BOTH (segmentable). Absent vttUrl ⟹ null (no per-sentence control).
export function resolveSentenceAudio(
  decks: AppDeckPayload[],
  sentenceId: string,
): DeckAudio | null;

// ── ST03: QuizCard optional prop (apps/srs-demo/src/components/QuizCard.vue) ──
// defineProps<{ …existing…; audio?: { audioUrl: string; vttUrl: string; sentenceId: string } }>();
// Rendered only when question.kind === 'word-block' && props.audio — a "▶ Play sentence"
// control calling the embedded AudioPlayer's playCue(props.audio.sentenceId).
```

## 4. User Workflows

```
# DeckOverview (learner, curated + VTT-marked deck)
open overview → AudioPlayer(:src=deck.audioUrl :vttUrl=deck.vttUrl)
  → ▶ Play          → whole conversation from currentTime
  → click sentence  → playCue(sentenceId)  (find cue → seek→play→pause at cue end)
  → active cue      → cuechange → activeCueId → highlight that sentence row
  → speed [0.5×]    → audio.playbackRate = 0.5, persists across plays
  (deck.audioUrl absent → no player; deck.vttUrl absent → whole-file play only, rows not click-to-segment)

# QuizCard word-block question (Learning or Review)
question (kind='word-block', sentenceId=S)
  App.vue: audio = resolveSentenceAudio(appDecks, S)   // null ⟹ no control
  → if audio: "▶ Play sentence" → playCue(S)
  → MCQ question → never any audio control

# Degrade matrix (none is an error)
deck.audioUrl absent        → no player / no quiz control
deck.vttUrl absent          → whole-file play only; no per-sentence segmenting
cue for S absent            → playCue no-ops
GLL_AUDIO_PUBLIC_URL unset  → EP42 emits no audioUrl/vttUrl → same as absent everywhere
```

## 5. Stories

### EP43-ST01: Shared audio-player primitive + speed control + VTT track  *(retrofit)*

**Scope**: `apps/srs-demo` — extend `useSegmentPlayer`/`AudioPlayer.vue` from `playSegment(start,end)` to a `<track>`-driven `playCue(sentenceId)` + `activeCueId`. No surface wiring here.
**Read List**: existing `useSegmentPlayer.ts`/`AudioPlayer.vue`, `QuizCard.vue` (idiom), WebVTT ADR §6.
**Tasks**:

- [ ] `AudioPlayer.vue`: render an optional `<track kind="metadata" :src="vttUrl" default>`; on load set `track.mode='hidden'`; expose the `TextTrack` to `useSegmentPlayer`.
- [ ] `useSegmentPlayer(el, track)`: keep transport/rate/scrubber/`mm:ss.cs`; add `activeCueId` (from `cuechange`) and `playCue(sentenceId)` (cue lookup by id → seek→play→pause at `endTime`; tear down the auto-pause on pause/seek/setRate).
- [ ] Keep it learner-agnostic (no deck/sentence/curator concepts beyond a cue id) so ST02/ST03 + DS02 mount it unchanged.

**Acceptance Criteria**:

- [ ] `playCue('S1')` seeks to S1's cue start, plays, and pauses within one frame of its end (mocked `HTMLAudioElement` + a fake `TextTrack`/cues).
- [ ] `cuechange` to S2's cue sets `activeCueId='S2'`.
- [ ] Speed control shows all three rates, active highlighted; `0.5×` sets `playbackRate` and persists; seeking/rate-change disarms a pending auto-pause.
- [ ] A grep confirms `AudioPlayer.vue`/`useSegmentPlayer.ts` import nothing deck/curator-specific.

### EP43-ST02: `DeckOverview` conversation + cue-driven per-sentence playback  *(retrofit)*

**Scope**: `apps/srs-demo` — mount `AudioPlayer` with `vttUrl`; wire clicks to `playCue`; highlight `activeCueId`.
**Read List**: `DeckOverview.vue` (`:deck`, sentence rendering + click handlers), `AudioPlayer.vue`, `packages/api-contract/src/content.ts` (`audioUrl`/`vttUrl`).
**Tasks**:

- [ ] `deck.audioUrl` present ⟹ render `<AudioPlayer :src :vttUrl>`; absent ⟹ nothing.
- [ ] Sentence click → `playCue(sentenceId)` when `deck.vttUrl` present; else keep current non-audio behaviour.
- [ ] Highlight the row whose `sentenceId === activeCueId`.

**Acceptance Criteria**:

- [ ] Curated+VTT deck: ▶ plays whole conversation; clicking a sentence plays just its cue and stops at cue end; speed slows it; the active sentence highlights.
- [ ] `audioUrl` absent ⟹ overview identical to today. `vttUrl` absent ⟹ whole-file play works, sentence clicks don't segment, no error.

### EP43-ST03: `QuizCard` word-block segment playback  *(retrofit)*

**Scope**: `apps/srs-demo` — optional `audio` prop, a word-block play control, `App.vue` resolution from `appDecks`. Engine untouched.
**Read List**: `QuizCard.vue` (word-block branch, `defineProps`), `App.vue` (`appDecks`, current/review question), `useAudio.ts`.
**Tasks**:

- [ ] `resolveSentenceAudio(decks, sentenceId)` → the sentence's deck `{ audioUrl, vttUrl }` when both present, else `null`.
- [ ] `App.vue`: compute audio for the current word-block question (Learning + Review), pass `{ audioUrl, vttUrl, sentenceId }` as `:audio`; MCQ passes nothing.
- [ ] `QuizCard`: `audio?` prop; render "▶ Play sentence" only for `word-block` + `audio`; drives an embedded `AudioPlayer`/`playCue(sentenceId)`.

**Acceptance Criteria**:

- [ ] A word-block question for a deck with a VTT shows a play control that plays that sentence's cue; same in Review.
- [ ] MCQ renders no control; a word-block question whose deck has no `vttUrl` renders no control.
- [ ] `resolveSentenceAudio` returns `null` for a deck without `vttUrl` and for an unknown `sentenceId`; `ReviewQuestionType` unchanged.

## 6. Success Criteria

1. A learner on a curated + VTT-marked deck hears the whole conversation and any single sentence's cue segment on `DeckOverview`, and a single sentence's cue on the word-block question — with a primary 1×/0.75×/0.5× speed control everywhere.
2. All per-sentence timing comes from the served VTT via the browser's `TextTrack`/`cuechange`; **no per-line numbers on the wire**, no server parse; the engine + question types are unchanged (playback ADR §5).
3. Every missing-audio path (no `audioUrl`, no `vttUrl`, no cue, unset storage env) degrades silently; audio never gates answering (playback ADR §6).
4. `AudioPlayer`/`useSegmentPlayer` are learner-agnostic and reused unchanged by EP43-DS02's marker tool.
5. No storage/wire/schema/engine change; `pnpm -r typecheck` + suite pass.
