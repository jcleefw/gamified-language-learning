# EP43 - Audio Playback & Marking UI

**Created**: 20260713T232015Z

**Status**: Draft

<!-- Status: Draft | Accepted | In Progress | Impl-Complete | BDD Pending | Completed | Shelved | Withdrawn -->

**Type**: Epic Plan
**Depends on**: [EP42 - Deck Audio Storage & Retrieval](EP42-deck-audio-storage-and-retrieval.md) — consumes the wire fields EP42 emits (`AppDeckPayload.audioUrl`, `AppLinePayload.audioStart`/`audioEnd`) and the curated `decks.audio_key` binary; EP43 renders and authors against that path, it does not re-decide it.
**Parallel with**: N/A
**Predecessor**: N/A

> **Provenance (20260713T232015Z):** EP42 was rescoped to end at DS02 (storage + curator upload). Everything that *renders audio to a learner* or *authors markers in the browser* was pulled out into this epic. The marker-authoring tool spec previously drafted as EP42-DS03 is **moved here verbatim (re-homed) as [EP43-DS02](../../changelogs/EP43--audio-playback-and-marking/20260713T232015Z-EP43-DS02-marker-authoring-tool.md)**, with its shared audio-player story lifted into DS01 (where learner playback — the primitive's first mount — lives).

---

## Problem Statement

After EP42 ships, the full deck-audio data path exists and is *authored* end to end — a curator pairs a conversation binary with a deck ([EP42-DS02](../../changelogs/EP42--deck-audio-storage-and-retrieval/20260713T222600Z-EP42-DS02-curator-audio-upload-ui.md)), and `GET /api/decks` can emit `audioUrl` + per-sentence `audioStart`/`audioEnd` ([EP42-DS01](../../changelogs/EP42--deck-audio-storage-and-retrieval/20260713T005450Z-EP42-DS01-deck-audio-storage-and-retrieval.md)) — **but no learner can hear anything**: `srs-demo` has zero `<audio>` on any learning or review surface, so the wire fields go nowhere. And the markers those fields carry can still only be produced by hand-editing DB JSON — the toil the [Audio Marker Tool PRD](../../../product-documentation/prds/20260713T140217Z-audio-marker-tool.md) exists to remove.

Audio pronunciation is a **PO-declared beta-release blocker**. EP42 makes audio *storable and authorable*; this epic makes it *heard* and *ergonomically authorable*, closing the gap between "the data path works" and "a tester actually learns with audio."

This epic realizes the two authored ADRs' UI halves: the **playback** surfaces of the [Playback Model ADR](../../../product-documentation/architecture/20260713T140218Z-engineering-audio-playback-model.md) §3–§6, and **Pass 1** of the [Marking/Authoring ADR](../../../product-documentation/architecture/20260713T140219Z-engineering-audio-marking-authoring.md). It deliberately front-loads playback (DS01) so the shared audio-player primitive exists before the marker tool (DS02) that reuses it.

## Scope

**In scope**:

- A **shared audio-player primitive** (`AudioPlayer.vue` + `useSegmentPlayer`) — one `<audio>` wrapper owning the playback-ADR §4 segment behaviour (`seek → play → pause-at-end`) and a **primary, always-visible** 1× / 0.75× / 0.5× speed control. Built once, mounted on every audio surface (learner + curator). *(DS01.)*
- **Learner playback on `DeckOverview`** — play the whole conversation; clicking a sentence seeks to its `audioStart` and plays to `audioEnd` (playback ADR §3). *(DS01.)*
- **Learner playback on the `QuizCard` word-block question** — a control plays *that sentence's* `[audioStart, audioEnd]` segment; MCQ word questions get no audio (playback ADR §3). *(DS01.)*
- **Silent degradation** — no `audioUrl` (or no markers) ⟹ no control rendered; the question/overview work unchanged; audio never gates answering (playback ADR §6). *(DS01.)*
- The **marker-authoring tool — Pass 1** (`srs-demo`, env-gated route): scrub a curated deck's audio, set/nudge per-sentence `[start, end]` from the play-head, segment-preview, and **export a JSON marker map** for the seed/import pipeline — reusing DS01's `AudioPlayer`. No server write, no waveform, no auth beyond the route gate. *(DS02.)*
- **Marker-map ingest** — an `apply-markers` seed step that writes the exported map into `decks.doc.sentences[].audioStart/audioEnd` **in place by `sentenceId`**, idempotently (the ADR's seed/import half; not a mutating endpoint). *(DS02.)*

**Out of scope**:

- Any storage/wire/schema/engine change — EP42 already added `decks.audio_key`, the marker fields, and the `audioUrl`/`audioStart`/`audioEnd` wire; this epic only *reads and renders* them (and writes markers via the existing doc, through tooling). `ReviewQuestionType` stays `'mcq' | 'word-block'` (playback ADR §5).
- **Pass 2** of the marker tool — the separate `apps/curator` app, upload-first-to-R2, server→DB marker writes, curator auth (Marking/Authoring ADR Pass 2).
- Word-level audio/markers, automated marker derivation (forced alignment / silence detection), TTS generation — out for both this epic and the marker-tool passes per the ADR/PRD.
- iOS audio-session unlock / autoplay-policy hardening beyond a tap-to-play control — noted as a playback-ADR open question, tracked but not a blocker for the ~3-tester beta.

---

## Stories

### Phase 1: Learner audio playback (EP43-PH01) — DS01

### EP43-ST01: Shared audio-player primitive + prominent speed control

**Scope**: `apps/srs-demo` — one composable (`useSegmentPlayer`) + one presentational component (`AudioPlayer.vue`): transport, scrubber, `mm:ss.cs` readout, `seek → play → pause-at-end`, and a **primary always-visible** 1× / 0.75× / 0.5× control. Learner-agnostic so both DS01's learner surfaces and DS02's marker tool mount it unchanged. **Design spec: [EP43-DS01](../../changelogs/EP43--audio-playback-and-marking/20260713T232015Z-EP43-DS01-learner-audio-playback-ui.md).**

### EP43-ST02: `DeckOverview` conversation + per-sentence playback

**Scope**: `apps/srs-demo` — mount `AudioPlayer` on `DeckOverview` reading the deck's `audioUrl`; play the whole conversation, and click-a-sentence → `playSegment(audioStart, audioEnd)`. Absent `audioUrl` ⟹ no player (silent degrade). **Design spec: [EP43-DS01](../../changelogs/EP43--audio-playback-and-marking/20260713T232015Z-EP43-DS01-learner-audio-playback-ui.md).**

### EP43-ST03: `QuizCard` word-block segment playback

**Scope**: `apps/srs-demo` — a play-segment control on the word-block sentence question; `App.vue` resolves the current `sentenceId → { audioUrl, audioStart, audioEnd }` from the boot-time decks and passes it as an optional prop. MCQ questions get no audio; absent markers ⟹ no control. **Design spec: [EP43-DS01](../../changelogs/EP43--audio-playback-and-marking/20260713T232015Z-EP43-DS01-learner-audio-playback-ui.md).**

### Phase 2: Marker-authoring tool — Pass 1 (EP43-PH02) — DS02

### EP43-ST04: `srs-demo` gated marker-authoring route

**Scope**: `apps/srs-demo` — a new `env.curatorMode`-gated screen: pick a curated deck, load its `audioUrl` via DS01's `AudioPlayer`, capture in/out per sentence from the play-head (keyboard-nudge fine adjustment), segment-preview, and export a JSON marker map (`sentenceId → {start, end}`). No server write, no waveform. **Design spec: [EP43-DS02](../../changelogs/EP43--audio-playback-and-marking/20260713T232015Z-EP43-DS02-marker-authoring-tool.md).**

### EP43-ST05: Marker-map ingest — `apply-markers` seed step

**Scope**: `apps/cli-demo-db` — a CLI that reads the exported map and writes each sentence's `audioStart`/`audioEnd` into `decks.doc.sentences[]` **in place, matched by `sentenceId`** (does not re-import — re-import regenerates ids and would orphan the map). Idempotent; fails loudly on an unknown deck; unknown keys skipped-with-warning. Answers the Marking/Authoring ADR's open question "JSON marker-map schema + where it lands for seed ingest." **Design spec: [EP43-DS02](../../changelogs/EP43--audio-playback-and-marking/20260713T232015Z-EP43-DS02-marker-authoring-tool.md).**

---

## Overall Acceptance Criteria

- [ ] On a curated, marked deck, a learner opening `DeckOverview` can play the whole conversation and click any sentence to hear just its `[audioStart, audioEnd]` segment, with a visible 1× / 0.75× / 0.5× speed control.
- [ ] On a word-block question for a marked sentence, a learner can play that sentence's segment; MCQ word questions render no audio control.
- [ ] A deck with no `audioUrl`, or a sentence with no markers, renders no audio control and works exactly as today — audio never blocks answering (playback ADR §6).
- [ ] The speed control (1× / 0.75× / 0.5×) is a primary, always-visible affordance with the current rate clearly shown, one tap/click from wherever audio plays; it is the *same* component on learner and curator surfaces.
- [ ] A curator can mark every sentence in a curated deck — set start/end, scrub, nudge, preview — without leaving the browser, and export a JSON marker map.
- [ ] `apply-markers` ingests that map into `decks.doc.sentences[].audioStart/audioEnd` by `sentenceId`, idempotently, with no manual DB editing; `GET /api/decks` then surfaces the authored markers and the learner surfaces play them.
- [ ] No storage/wire/schema/engine type changes; the marker screen + its nav button are gated by `env.curatorMode` and DCE'd from prod builds; `pnpm -r typecheck` and the suite pass.

---

## Dependencies

- [EP42 - Deck Audio Storage & Retrieval](EP42-deck-audio-storage-and-retrieval.md) — provides `audioUrl`/`audioStart`/`audioEnd` on the wire, `decks.audio_key`, and the curator upload page. **Hard dependency**: no playback and no marking without a curated binary + the wire fields.
- [Conversation Audio — Playback Model & Data Contract](../../../product-documentation/architecture/20260713T140218Z-engineering-audio-playback-model.md) — §3 surfaces, §4 segment + rate, §6 silent degrade.
- [Conversation Audio — Marking (Authoring) Architecture](../../../product-documentation/architecture/20260713T140219Z-engineering-audio-marking-authoring.md) — Pass 1 (DS02); Pass 2 out.
- [Audio Marker Tool PRD](../../../product-documentation/prds/20260713T140217Z-audio-marker-tool.md) — the curator experience DS02 realizes.

## Next Steps

1. Review and approve plan.
2. DS01 (learner playback UI — ST01/ST02/ST03) is drafted and **implemented**: [EP43-DS01](../../changelogs/EP43--audio-playback-and-marking/20260713T232015Z-EP43-DS01-learner-audio-playback-ui.md). `useSegmentPlayer`/`AudioPlayer.vue` built (ST01); mounted on `DeckOverview` (ST02) and `QuizCard` word-block questions via `App.vue`'s `resolveSentenceAudio` (ST03). `pnpm -r typecheck` and the full `apps/srs-demo` suite (65 tests) pass.
3. DS02 (marker-authoring tool, Pass 1 — ST04/ST05) is drafted (re-homed from EP42-DS03): [EP43-DS02](../../changelogs/EP43--audio-playback-and-marking/20260713T232015Z-EP43-DS02-marker-authoring-tool.md).
4. DS01 done — implement DS02 next (it reuses DS01's `AudioPlayer`).
