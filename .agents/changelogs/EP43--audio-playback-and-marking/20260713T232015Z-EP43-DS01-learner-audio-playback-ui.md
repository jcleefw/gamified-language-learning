# EP43-DS01: Learner Audio Playback UI Specification

**Date**: 20260713T232015Z
**Status**: Completed (20260714)
**Epic**: [EP43 - Audio Playback & Marking UI](../../plans/epics/EP43-audio-playback-and-marking.md)

**Architecture**:
- [Conversation Audio — Playback Model & Data Contract](../../../product-documentation/architecture/20260713T140218Z-engineering-audio-playback-model.md) — Accepted. This DS is the **runtime UI half** of that ADR: §3 (two surfaces — `DeckOverview` whole-conversation + per-sentence seek; `QuizCard` word-block segment; MCQ gets none), §4 (one `<audio>` per surface, `currentTime = audioStart` → play → pause at `audioEnd`; a 1× / 0.75× / 0.5× rate control), §5 (the engine stays audio-free — the Vue client resolves `sentenceId → (audioUrl, audioStart, audioEnd)` from the payload it already holds), §6 (missing audio degrades silently, never gates answering).
- [Marking/Authoring ADR](../../../product-documentation/architecture/20260713T140219Z-engineering-audio-marking-authoring.md) — Accepted. The playback-rate control this DS builds is the one the ADR says the marker tool reuses; DS01 builds the shared primitive, [EP43-DS02](20260713T232015Z-EP43-DS02-marker-authoring-tool.md) is its second consumer.

**Depends on**: [EP42-DS01](../EP42--deck-audio-storage-and-retrieval/20260713T005450Z-EP42-DS01-deck-audio-storage-and-retrieval.md) (the `audioUrl`/`audioStart`/`audioEnd` wire fields) + [EP42-DS02](../EP42--deck-audio-storage-and-retrieval/20260713T222600Z-EP42-DS02-curator-audio-upload-ui.md) (a curated binary so `audioUrl` resolves).

---

## 1. Feature Overview

EP42 emits everything a learner needs to hear audio — `AppDeckPayload.audioUrl` and per-line `audioStart`/`audioEnd` on `GET /api/decks` — but `srs-demo` renders **no `<audio>` anywhere**, so the fields are dead on arrival. This DS mounts audio on the two learner surfaces the playback ADR §3 fixes, reading those existing fields and **degrading silently** when they're absent.

The design is a **primitive + two thin mounts**, and it turns on the playback ADR §5 boundary — *the engine and the questions stay pure text; the Vue client resolves audio from the deck payload it already holds*:

- **Shared player primitive (ST01)** — `useSegmentPlayer` (a composable owning the one non-trivial behaviour: `seek(start) → play → pause exactly at end`) + `AudioPlayer.vue` (transport, scrubber, `mm:ss.cs` readout, and a **primary always-visible** 1× / 0.75× / 0.5× control). It knows nothing about decks, sentences, or curation — just an audio `src` and segments. This is the single component the ADR mandates be shared across surfaces; the marker tool (DS02) is its third mount.
- **`DeckOverview` mount (ST02)** — the overview already receives the whole `AppDeckPayload` as `:deck`, so it has `audioUrl` + `lines[].audioStart/audioEnd` directly. Mount `AudioPlayer` for whole-conversation play; wire each sentence row's click to `playSegment(audioStart, audioEnd)`. No new data flow.
- **`QuizCard` word-block mount (ST03)** — `QuizCard` receives only a pure `SentenceQuestion` (`sentenceId`, `tiles`), never audio (ADR §5). So `App.vue` — which holds the boot-time `appDecks` — resolves the current question's `sentenceId → { audioUrl, audioStart, audioEnd }` and passes it as an **optional prop**. Present + marked ⟹ a play-segment control; absent ⟹ nothing. MCQ word questions never get audio.

**The critical boundary decision — audio is resolved in the Vue layer from `appDecks`, never threaded through the engine.** `QuizQuestion`/`SentenceQuestion` gain no URL field; `ReviewQuestionType` stays `'mcq' | 'word-block'`. A tiny `resolveSentenceAudio(appDecks, sentenceId)` helper does the lookup where the payload already lives (`App.vue`), keeping the ADR §5 "engine audio-free" invariant intact and this DS a pure additive-UI change.

**Silent degradation is a first-class requirement, not an afterthought** (ADR §6): every mount is behind a "has audio?" guard. No `audioUrl`, no markers, or unset storage env (⟹ no `audioUrl` from EP42's crash-proof read path) all resolve to *no control rendered* — the overview and quiz behave exactly as today. Audio never blocks answering.

**What is reused, not built:** `AppDeckPayload.audioUrl` / `AppLinePayload.{sentenceId,audioStart,audioEnd}` (EP42 wire); the boot-time `appDecks` list in `App.vue`; `DeckOverview`'s existing per-sentence rendering + `:deck` prop; `QuizCard`'s `SentenceQuestion` word-block branch; the scoped-style + `defineProps`/`defineEmits` idiom throughout `srs-demo`.

**Not in this DS:** the marker-authoring tool + marker ingest (EP43-DS02); any storage/wire/schema change (EP42 owns all of it); Pass 2 curator/R2 concerns; word-level audio; MCQ-question audio (ADR §3 excludes it); iOS session-unlock hardening beyond tap-to-play (playback-ADR open question, tracked not built).

## 2. Core Requirements

| Requirement | Decision | Rationale |
| --- | --- | --- |
| Player primitive | One `AudioPlayer.vue` wrapping a single `<audio>`, backed by `useSegmentPlayer`; learner-agnostic | Playback ADR §4 "one `<audio>` element per surface"; the ADR mandates one shared component across learner + curator |
| Segment playback | `playSegment(start,end)`: `seek(start)` → play → pause when `currentTime >= end` (a `timeupdate` listener cleared on pause/seek/rate-change) | Playback ADR §4 primitive; the auto-pause must not survive a scrub/seek away |
| Speed control | Segmented `[1× \| 0.75× \| 0.5×]`, **primary + always visible**, active rate highlighted; sets `audio.playbackRate` | Playback ADR §4 + PRD; learners slow audio to hear pronunciation — one tap away, same control the curator uses |
| Audio resolution | Vue-layer `resolveSentenceAudio(appDecks, sentenceId) → { audioUrl, audioStart, audioEnd } \| null`; **no engine/question type change** | Playback ADR §5 — engine + questions stay pure text; the client resolves from the payload it holds |
| `DeckOverview` audio | Mount `AudioPlayer(:src=deck.audioUrl)`; whole-conversation play + click-sentence → `playSegment(line.audioStart, line.audioEnd)` | Playback ADR §3 surface 1; the overview already holds the full `AppDeckPayload` |
| `QuizCard` audio | Optional `audio?: { url; start; end }` prop; when present on a word-block question, render a play-segment control | Playback ADR §3 surface 2; keeps `QuizCard` dumb — `App.vue` does the resolution |
| MCQ audio | None — the control renders only for `kind === 'word-block'` with resolved audio | Playback ADR §3 "MCQ word questions get no audio" (word-level audio deferred) |
| Missing audio | No `audioUrl`, no markers, or unset storage env ⟹ **no control rendered**, surfaces unchanged, answering unaffected | Playback ADR §6 silent degrade; audio is an adornment, never a gate |
| Partial markers | A sentence with only one of `audioStart`/`audioEnd` ⟹ treated as no segment (no control) | A half-marker has no valid `[start,end]`; safer than playing to the file end |
| Review vs. Learning | The word-block control is identical in Learning and Review (same `QuizCard`) | `QuizCard` is the shared quiz component; audio is a per-sentence adornment, not phase-specific |
| Engine / wire / schema | **No change** — read-only consumption of EP42's fields | This DS is additive UI only; EP42 already added every field |

## 3. Data Structures

```typescript
// ── ST01: segment-player primitive (apps/srs-demo/src/composables/useSegmentPlayer.ts)
// Owns seek→play→pause-at-end (playback ADR §4). No deck/sentence concepts.
export interface SegmentPlayer {
  currentTime: Ref<number>;      // live play-head, seconds
  duration: Ref<number>;         // total, seconds (scrubber max)
  playing: Ref<boolean>;
  rate: Ref<1 | 0.75 | 0.5>;     // playbackRate
  play(): void;                  // whole-file play from currentTime
  pause(): void;
  seek(t: number): void;
  setRate(r: 1 | 0.75 | 0.5): void;
  /** seek(start), play, pause when currentTime >= end. Clears any prior auto-pause. */
  playSegment(start: number, end: number): void;
}
export function useSegmentPlayer(el: Ref<HTMLAudioElement | null>): SegmentPlayer;

// ── ST01: AudioPlayer.vue — transport + prominent speed control ───────────────
// <AudioPlayer :src="audioUrl" ref="player" />  // wraps one <audio>, exposes SegmentPlayer
// Renders play/pause, a scrubber bound to currentTime/duration, a mm:ss.cs readout,
// and a PRIMARY always-visible segmented [1× | 0.75× | 0.5×] control (active rate highlighted).
// defineExpose(): the SegmentPlayer surface so a parent can call playSegment()/seek() imperatively.

// ── ST03: Vue-layer audio resolution (apps/srs-demo, e.g. composables/useAudio.ts) ──
// Engine stays audio-free (playback ADR §5); resolve from the payload App.vue already holds.
export interface SentenceAudio { url: string; start: number; end: number }
export function resolveSentenceAudio(
  decks: AppDeckPayload[],
  sentenceId: string,
): SentenceAudio | null;
// Finds the line by sentenceId across decks; returns null unless the deck has audioUrl
// AND the line has BOTH audioStart and audioEnd (a half-marker ⟹ null). Absent ⟹ no control.

// ── ST03: QuizCard optional prop (apps/srs-demo/src/components/QuizCard.vue) ──
// defineProps<{ …existing…; audio?: SentenceAudio }>();
// Rendered only when props.question.kind === 'word-block' && props.audio — a "▶ Play sentence"
// control calling the embedded AudioPlayer's playSegment(props.audio.start, props.audio.end).
```

## 4. User Workflows

```
# DeckOverview (learner, curated+marked deck)
open a deck's overview → AudioPlayer mounted on deck.audioUrl
  → ▶ Play          → plays the whole conversation from currentTime
  → click sentence  → playSegment(line.audioStart, line.audioEnd)  (seek→play→pause at end)
  → speed [0.5×]    → audio.playbackRate = 0.5, persists across plays
  (deck.audioUrl absent → no player rendered; overview identical to today)

# QuizCard word-block question (Learning or Review)
question served (kind='word-block', sentenceId=S)
  App.vue: audio = resolveSentenceAudio(appDecks, S)   // null ⟹ no control
  → if audio: "▶ Play sentence" → playSegment(audio.start, audio.end)
  → MCQ question → never any audio control
  (sentence unmarked, or deck uncurated → audio=null → no control; answering unaffected)

# Degrade matrix (playback ADR §6 — none is an error)
deck.audioUrl absent          → no player on overview; audio=null in quiz
line has no markers           → sentence not clickable-to-play; quiz control absent
line half-marked (start only)  → treated as no segment → no control
GLL_AUDIO_PUBLIC_URL unset     → EP42 emits no audioUrl → same as "absent" everywhere
```

## 5. Stories

### Phase 1: Learner audio playback (EP43-PH01)

### EP43-ST01: Shared audio-player primitive + prominent speed control *(Done)*

**Scope**: `apps/srs-demo` — one composable (`useSegmentPlayer`) + one presentational component (`AudioPlayer.vue`). No surface wiring here; ST02/ST03 mount it. Built first because both mounts and DS02 embed it.
**Read List**: `apps/srs-demo/src/components/QuizCard.vue` (component/style idiom, `defineExpose` if used), `apps/srs-demo/src/composables/useStore.ts` (composable idiom), `product-documentation/architecture/20260713T140218Z-engineering-audio-playback-model.md` (§4 segment + rate contract)
**Tasks**:

- [x] Add `useSegmentPlayer(el)`: wraps one `<audio>` ref; exposes `currentTime`/`duration`/`playing`/`rate` refs and `play`/`pause`/`seek`/`setRate`/`playSegment`. `playSegment(start,end)` seeks to `start`, plays, and pauses on a `timeupdate` when `currentTime >= end`; the listener is torn down on `pause`/`seek`/`setRate` so a stale auto-pause never fires after the user scrubs away.
- [x] Add `AudioPlayer.vue` (`:src`): one `<audio :src>`; play/pause; a scrubber bound to `currentTime`/`duration`; a `mm:ss.cs` readout; a **primary, always-visible** segmented `[1× | 0.75× | 0.5×]` control with the active rate clearly highlighted.
- [x] `defineExpose` the `SegmentPlayer` surface so a parent reads `currentTime`/`duration` and calls `seek`/`playSegment` imperatively.
- [x] Keep it learner-agnostic — no deck/sentence/curator concepts — so ST02, ST03, and DS02 mount it unchanged.
      **Acceptance Criteria**:
- [x] `playSegment(1.0, 2.0)` seeks to 1.0 s, plays, and pauses within one frame of 2.0 s — not earlier, not past — verified with a mocked `HTMLAudioElement` (`currentTime`/`play`/`pause`/`timeupdate`). (`useSegmentPlayer.test.ts`)
- [x] The speed control shows all three rates at once with the active one distinguished; clicking `0.5×` sets `audio.playbackRate = 0.5` and it persists across play/pause. (`useSegmentPlayer.test.ts`)
- [x] Seeking or changing rate mid-segment disarms the pending auto-pause (no "pauses at the old end after I scrub away"). (`useSegmentPlayer.test.ts`)
- [x] A grep confirms `AudioPlayer.vue`/`useSegmentPlayer.ts` import nothing deck/sentence/curator-specific.

### EP43-ST02: `DeckOverview` conversation + per-sentence playback *(Done)*

**Scope**: `apps/srs-demo` — mount `AudioPlayer` on `DeckOverview` and wire sentence clicks to segment play. No new data flow (the overview already holds `:deck`).
**Read List**: `apps/srs-demo/src/components/DeckOverview.vue` (its `:deck` prop, `deck.lines` rendering L318+, existing sentence-click handlers), `apps/srs-demo/src/components/AudioPlayer.vue` (ST01), `packages/api-contract/src/content.ts` (`AppDeckPayload.audioUrl`, `AppLinePayload.audioStart/audioEnd`)
**Tasks**:

- [x] When `deck.audioUrl` is present, render `<AudioPlayer :src="deck.audioUrl">` at the top of the overview; when absent, render nothing (no empty player).
- [x] Make each sentence row a play affordance: on click, if the line has both `audioStart` and `audioEnd`, call the player's `playSegment(audioStart, audioEnd)`; otherwise the row keeps its current (non-audio) behaviour.
- [x] Show a subtle "playing" affordance on the active sentence (optional, non-blocking) driven by the player's `currentTime` within `[audioStart, audioEnd]`.
      **Acceptance Criteria**:
- [x] On a curated, marked deck: ▶ plays the whole conversation; clicking a marked sentence plays just its `[audioStart, audioEnd]` and stops at the end; the speed control slows playback. (verified by code inspection + `useSegmentPlayer` logic tests — no jsdom/vue-test-utils in this repo for a mounted-component test.)
- [x] A deck with `audioUrl` absent renders the overview exactly as today — no player, no regressions to sentence rendering/clicks. (`v-if="deck.audioUrl"` guard; **not** verified by an automated component test — no component-test harness exists in `apps/srs-demo`.)
- [x] Clicking an unmarked sentence does not start audio and does not error. (`onSentenceClick` early-returns when `audioStart`/`audioEnd` is undefined.)

### EP43-ST03: `QuizCard` word-block segment playback *(Done)*

**Scope**: `apps/srs-demo` — an optional `audio` prop on `QuizCard`, a play-segment control on the word-block branch, and the `App.vue`-side resolution from `appDecks`. Engine untouched.
**Read List**: `apps/srs-demo/src/components/QuizCard.vue` (word-block branch L95+/L171+, `SentenceQuestion` usage, `defineProps`), `apps/srs-demo/src/App.vue` (`appDecks`, `currentQuestion`/`reviewQuestion`, how `QuizCard` is passed `:question`), `packages/api-contract/src/content.ts` (payload fields)
**Tasks**:

- [x] Add `resolveSentenceAudio(decks, sentenceId)` (a small `useAudio.ts` composable): find the line across `appDecks`; return `{ url, start, end }` only when the deck has `audioUrl` **and** the line has both markers; else `null`.
- [x] In `App.vue`, compute the audio for the current word-block question (Learning and Review paths) and pass it as `:audio` to `QuizCard`; MCQ questions pass nothing.
- [x] In `QuizCard`, add `audio?: SentenceAudio`; render a "▶ Play sentence" control only when `question.kind === 'word-block' && audio`; it drives an embedded `AudioPlayer`/`playSegment(audio.start, audio.end)`.
- [x] Ensure the control never renders on MCQ questions and never gates answering (audio is an adornment).
      **Acceptance Criteria**:
- [x] A word-block question for a marked sentence shows a play control that plays exactly `[audioStart, audioEnd]`; the same works in Review (same `QuizCard`, both mounts pass `:audio`). (verified by code inspection — no component-test harness in this repo.)
- [x] An MCQ question renders no audio control; a word-block question whose sentence is unmarked or whose deck is uncurated renders no control. (`v-if="audio"` guard on the word-block branch, fed by `resolveSentenceAudio`; **not** verified by an automated component-mount test — no jsdom/vue-test-utils in `apps/srs-demo`.)
- [x] `resolveSentenceAudio` returns `null` for a half-marked line and for a `sentenceId` absent from `appDecks`; no engine/question type changed (`ReviewQuestionType` still `'mcq' | 'word-block'`). (`useAudio.test.ts`, 5 cases; verified by `pnpm -r typecheck`.)

## 6. Success Criteria

1. A learner on a curated, marked deck hears the whole conversation and any single sentence's segment on `DeckOverview`, and a single sentence's segment on the word-block question — with a primary, always-visible 1× / 0.75× / 0.5× speed control on every surface.
2. Audio is resolved entirely in the Vue layer from `appDecks`; the engine, `QuizQuestion`/`SentenceQuestion`, and `ReviewQuestionType` are unchanged (playback ADR §5).
3. Every missing-audio path (no `audioUrl`, no/half markers, unset storage env) renders no control and leaves the surface behaving exactly as today — audio never gates answering (playback ADR §6).
4. `AudioPlayer`/`useSegmentPlayer` are learner-agnostic and reused unchanged by EP43-DS02's marker tool.
5. No storage/wire/schema/engine type change; `pnpm -r typecheck` and the test suite pass.
