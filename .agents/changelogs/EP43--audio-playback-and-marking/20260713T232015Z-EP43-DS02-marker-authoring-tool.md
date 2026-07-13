# EP43-DS02: Marker-Authoring Tool — Pass 1 Specification

**Date**: 20260713T232015Z
**Status**: Draft
**Epic**: [EP43 - Audio Playback & Marking UI](../../plans/epics/EP43-audio-playback-and-marking.md)

> **Re-homed (20260713T232015Z):** originally drafted as EP42-DS03; moved here when EP42 was rescoped to end at DS02 (storage + curator upload). The shared audio-player story that was ST12 in the draft is now [EP43-DS01 ST01](20260713T232015Z-EP43-DS01-learner-audio-playback-ui.md) (built with learner playback, the primitive's first mount); this DS **reuses** it rather than building it.

**Architecture**:
- [Conversation Audio — Marking (Authoring) Architecture](../../../product-documentation/architecture/20260713T140219Z-engineering-audio-marking-authoring.md) — Accepted. This DS builds **Pass 1** verbatim: a **gated route inside `srs-demo`** (not a new app), the tool **exports a JSON marker map** (`sentenceId → {start, end}`) that the **seed/import pipeline** ingests into `DeckDoc.sentences[].audioStart/audioEnd`, and there are **no mutating marker endpoints** (server-write graduates in Pass 2). Pass 2 (`apps/curator`, upload-first-to-R2, server→DB marker writes, curator auth) stays out.
- [Conversation Audio — Playback Model & Data Contract](../../../product-documentation/architecture/20260713T140218Z-engineering-audio-playback-model.md) — Accepted. §4 fixes the segment-playback primitive (`currentTime = audioStart`; play; pause at `audioEnd`) and the 1× / 0.75× / 0.5× rate control, and states the marking tool **reuses the same control**. That primitive is built in [EP43-DS01](20260713T232015Z-EP43-DS01-learner-audio-playback-ui.md) (`AudioPlayer`/`useSegmentPlayer`); this DS is its second consumer.
- [Audio Marker Tool PRD](../../../product-documentation/prds/20260713T140217Z-audio-marker-tool.md) — the curator experience §3/§4.1 this DS realizes: load sentence list + audio, scrub with slow-down, set in/out per sentence from the play-head with keyboard nudge, segment-preview, export the marker map.

**Depends on**: [EP43-DS01](20260713T232015Z-EP43-DS01-learner-audio-playback-ui.md) (the shared `AudioPlayer`/`useSegmentPlayer`) + [EP42-DS01](../EP42--deck-audio-storage-and-retrieval/20260713T005450Z-EP42-DS01-deck-audio-storage-and-retrieval.md) (`audioUrl`, `DeckSentence.audioStart/audioEnd`) + [EP42-DS02](../EP42--deck-audio-storage-and-retrieval/20260713T222600Z-EP42-DS02-curator-audio-upload-ui.md) (a curated binary so `audioUrl` resolves).

---

## 1. Feature Overview

EP42 built the storage-to-wire path and a browser page to **pair an audio binary with a deck**; EP43-DS01 makes that audio **playable** on learner surfaces via a shared `AudioPlayer`. What is still missing is the authored input the markers depend on: the **per-sentence `[start, end]` ranges** into the binary. Today they can only be produced by hand-editing DB JSON — the toil the [PRD §1](../../../product-documentation/prds/20260713T140217Z-audio-marker-tool.md) exists to remove. This DS closes the **marker** half of the marking-ADR's tracked gap.

The design is **two thin layers** — the player primitive it needs already exists (DS01) — and it decides the marking-ADR's two open questions (*the marker-map schema* and *where it lands for seed ingest*):

- **Marker-authoring route (ST04)** — a `srs-demo` screen gated by the existing `env.curatorMode` flag (the same gate DS02's upload page uses — both are curator-only tooling, one gate): pick a curated deck, load its `audioUrl` through **DS01's `AudioPlayer`**, scrub with slow-down, capture in/out per sentence from the play-head (with keyboard nudge), preview a sentence's segment via the player's `playSegment`, and **export a JSON marker map**. No server write, no waveform, no auth beyond the route gate — the marking-ADR's Pass-1 line exactly.
- **Marker-map ingest (ST05)** — a small `apply-markers` step in the **existing import tooling** (`apps/cli-demo-db`, `import-curriculum`'s home) that reads the exported map and writes each sentence's `audioStart/audioEnd` into `decks.doc.sentences[]` **by `sentenceId`**, idempotently. This is the "seed/import pipeline ingests it" half of the ADR — a DB write through *tooling*, not a new mutating endpoint, so Pass 1's no-server-write constraint holds.

**The critical boundary decision — the tool authors against the *DB `sentenceId`*, and ingest applies *in place by `sentenceId`*.** The marker map is keyed by the real `sentenceId`s the tool reads off `GET /api/decks` (`AppLinePayload.sentenceId`), and ingest matches those same ids against the deck's *already-imported* `doc.sentences[]`, updating markers in place. It does **not** re-run `importCurriculum` (which regenerates `sentenceId`s and would orphan the map). This keeps the marker map decoupled from the source-conversation JSON entirely: curate binary → author markers → apply markers, each a separate idempotent step over a deck that already exists.

**Audio source (ADR "local-served" → realized via EP42's MinIO seam):** the marking ADR's Pass 1 says "local-served file." EP42 built a local **MinIO** bucket standing in for R2 and resolves it to `AppDeckPayload.audioUrl` (DS01). So the tool simply loads `deck.audioUrl` — the same field the learner player reads — and in local dev that is MinIO. A deck must therefore be **curated first (EP42-DS02)** before it can be marked; the tool tells the curator so when `audioUrl` is absent, rather than presenting a dead player.

**What is reused, not built:** the shared `AudioPlayer`/`useSegmentPlayer` (EP43-DS01 ST01); `AppDeckPayload.audioUrl` / `AppLinePayload.{sentenceId,native,romanization,english,audioStart,audioEnd}` (EP42 wire); the boot-time decks list in `App.vue` (no new fetch); `env.curatorMode` + the gated-button pattern (EP42-DS02 `CurateAudio`, `App.vue`); `DeckSentenceSchema.audioStart/audioEnd` (already optional on the doc); `import-curriculum`'s `getDb`/doc-parse/write pattern (ST05 ingest); the `Screen`-union + gated `v-if` nav pattern.

**Not in this DS:** the shared player primitive itself (EP43-DS01 ST01); learner-facing `<audio>` on `QuizCard`/`DeckOverview` (EP43-DS01 ST02/ST03); Pass 2's `apps/curator` app, upload-first-to-R2, server→DB marker writes, or curator auth; waveform view; word-level markers; automated marker derivation; TTS; any schema/wire/engine type change (EP42 already added every field involved).

## 2. Core Requirements

| Requirement | Decision | Rationale |
| --- | --- | --- |
| Where the tool lives | A gated route in `srs-demo` (a `'mark'` screen), **not** a new app | Marking-ADR Pass 1 §Decision — reuse the app/router/audio player for near-zero scaffolding; `apps/curator` is Pass 2 |
| Route gate | Reuse `env.curatorMode` (`VITE_CURATOR_MODE`); the screen + its nav button render only when set; DCE'd in prod | Both curator tools share one curator-only gate (EP42-DS02 established it); a second flag would be noise |
| Audio player | Embed EP43-DS01's `AudioPlayer(:src=deck.audioUrl)`; read `currentTime` and call `seek`/`playSegment` via its exposed surface | The playback ADR mandates one shared player; DS01 built it — this DS must not build a second |
| Audio source | `props.deck.audioUrl` (EP42-resolved; MinIO locally, R2 in prod) — **not** a separate file input | Realizes the ADR's "local-served" via the epic's MinIO seam; same field the learner player reads → one audio path |
| Uncurated deck (no `audioUrl`) | Tool shows "curate this deck's audio first" and disables marking; no dead player | A deck must be paired (EP42-DS02) before it can be marked; fail informative, not blank |
| Sentence list | `props.deck.lines` in order; each row shows `native` / `romanization` / `english` | The unit markers attach to (playback ADR §1); the curator needs the text to place `[start,end]` |
| Marker unit | Seconds, float, `≥ 0`, with `end > start` | Matches `DeckSentenceSchema.audioStart/audioEnd` (EP42) and the playback contract; zero-length/inverted rejected at export |
| Capture in/out | "Set In" / "Set Out" buttons write the player's live `currentTime` into the focused sentence's `start` / `end` | PRD §3.4 — set from the play-head; the fast path for the bulk of markers |
| Fine adjustment | Keyboard nudge on a focused marker field: `←/→` = ±0.05 s, `Shift+←/→` = ±0.01 s | PRD §4.1 keyboard-nudge; two granularities cover coarse vs. frame-level without a waveform |
| Segment preview | "Preview" per sentence: `playSegment(start, end)` (seek→play→pause at end) on the embedded player | PRD §3.5 verify step; the exact playback ADR §4 primitive, from DS01 |
| Seed existing markers | On load, pre-fill each sentence's `start/end` from the payload's `audioStart/audioEnd` when present | Editing a partially-marked deck must not lose prior work; round-trips the EP42 wire fields |
| Export | Download a JSON marker map — `{ deckId, markers: { [sentenceId]: { start, end } } }` — only sentences with a complete valid pair are included | Marking-ADR open question answered; incomplete/invalid pairs excluded so ingest never writes a half-marker |
| Marker persistence | **Export a JSON file** the curator moves into ingest — **no server write** | Marking-ADR Pass 1 §Decision — write path stays in seed/import; server-write is Pass 2 |
| Ingest target | `apply-markers` writes `decks.doc.sentences[].audioStart/audioEnd` **in place, matched by `sentenceId`** — does **not** re-import | The map is keyed by DB `sentenceId`s the tool read; re-import regenerates ids and would orphan the map |
| Ingest home | `apps/cli-demo-db` (alongside `import-curriculum`), reusing its `getDb`/doc-parse pattern | Marker apply is a curriculum-content DB write (same layer as import), **not** a binary/audio-file op (which lives in `apps/server` storage) |
| Ingest safety | Idempotent; unknown `sentenceId`s reported + skipped; `end > start ≥ 0` validated before write; unknown deck fails loudly | Re-runnable like `curate-audio` was; a stale/foreign id never corrupts the doc or writes a bad segment |
| Engine / schema / wire | **No change** — the tool only reads EP42's wire fields and writes EP42's existing doc fields | Playback ADR §5 keeps the engine audio-free; EP42 already added every field involved |

## 3. Data Structures

```typescript
// ── ST04: exported marker map (the Pass-1 hand-off; new file, e.g.
//          apps/cli-demo-db/data/markers/<deckId>.json) ─────────────────────────
// Keyed by the DB sentenceId the tool read from GET /api/decks (AppLinePayload.sentenceId).
// `start`/`end` are seconds-float; they map to audioStart/audioEnd on ingest.
export interface DeckMarkerMap {
  deckId: string;                                   // apply target; ingest fails if it doesn't exist
  markers: Record<string, { start: number; end: number }>; // sentenceId → segment; end > start ≥ 0
}
// Only sentences with a complete, valid (end > start ≥ 0) pair are emitted — a
// sentence still being marked is simply absent, never exported as a half-marker.

// ── ST04: per-sentence editing state (MarkAudio.vue, local reactive) ──────────
interface MarkerDraft { start: number | null; end: number | null } // null = not yet set
// markers: Record<sentenceId, MarkerDraft>, seeded on load from each line's audioStart/audioEnd.
// A row is "complete" when start != null && end != null && end > start.
// Export builds DeckMarkerMap from the complete rows only.
// The screen embeds <AudioPlayer :src="deck.audioUrl" ref="player"> (EP43-DS01) and reads
// player.currentTime for Set In/Out, calls player.playSegment(start,end) for Preview.

// ── ST05: ingest (apps/cli-demo-db/src/apply-markers.ts) ──────────────────────
// CLI: apply-markers <path-to-marker-map.json>
//   1. read+parse the map (zod: deckId string, markers record of {start,end}, end>start≥0)
//   2. load decks row by deckId; parse doc (DeckDocSchema)
//   3. for each doc.sentences[s]: if markers[s.sentenceId] present → set audioStart/audioEnd
//      unknown map keys (no matching sentenceId) → collect + warn, do not write
//   4. write doc back; report { matched, skippedUnknown }
//   → idempotent: re-applying the same map yields byte-identical markers (no drift, like curate-audio)
```

## 4. User Workflows

```
# Curator marks a deck (browser, VITE_CURATOR_MODE set; deck already curated via EP42-DS02)
open srs-demo → "🏷️ Mark audio" button (rendered only when env.curatorMode)
  → pick a deck (boot-time decks list; audioUrl present ⟹ markable, absent ⟹ "curate audio first")
  → AudioPlayer (EP43-DS01) loads deck.audioUrl (MinIO locally); scrub / play, slow to 0.75× or 0.5×
  → per sentence row (deck.lines, in order):
       focus row → play to the sentence's first sound → "Set In"  (start = player.currentTime)
                 → play to its last sound            → "Set Out" (end  = player.currentTime)
                 → nudge start/end with ←/→ (±0.05s) or Shift+←/→ (±0.01s)
                 → "Preview" → player.playSegment(start, end): seek→play→pause at end (verify)
  → "Export markers" → downloads { deckId, markers:{ sentenceId:{start,end} } } (complete rows only)

# Ingest (terminal, seed/import — NOT a server endpoint)
apply-markers <deckId>.json
  → matches map keys against decks.doc.sentences[].sentenceId
  → writes audioStart/audioEnd in place; reports matched/skipped; idempotent on re-run
  → GET /api/decks now returns audioStart/audioEnd on those lines (EP42 read path, unchanged)
  → EP43-DS01's learner surfaces now play them

# Full deck-audio lifecycle across the epics
EP42-DS02 curate binary → decks.audio_key set, audioUrl resolves
EP43-DS02 author markers → JSON map           (this DS, ST04)
EP43-DS02 apply markers  → doc.sentences[].audioStart/audioEnd  (this DS, ST05)
EP43-DS01 learner playback → <audio> segment controls on DeckOverview + word-block

# Gate / degrade paths
VITE_CURATOR_MODE unset   → screen + "Mark audio" button DCE'd from the prod bundle
deck has no audioUrl      → marking disabled, "curate this deck's audio first" shown (no dead player)
sentence left unmarked    → omitted from the export (no half-marker)
unknown sentenceId in map → apply-markers skips + warns; the doc is not corrupted
inverted/zero-length pair → rejected at export AND re-validated at apply (never written)
```

## 5. Stories

### Phase 2: Marker-authoring tool — Pass 1 (EP43-PH02)

### EP43-ST04: `srs-demo` gated marker-authoring route

**Scope**: `apps/srs-demo` — one screen (`MarkAudio.vue`) + its gated nav button + `'mark'` on the `Screen` union. Embeds EP43-DS01's `AudioPlayer`. No new fetch, no server write.
**Read List**: `apps/srs-demo/src/components/CurateAudio.vue` (the sibling curator screen — gate, deck-pick, back-nav, style to mirror), `apps/srs-demo/src/App.vue` (boot decks list, `Screen` wiring, gated-button pattern ~L381–397, `env.curatorMode`), `apps/srs-demo/src/types.ts` (`Screen` union), `apps/srs-demo/src/components/AudioPlayer.vue` (EP43-DS01 ST01 — the embedded player + its exposed `currentTime`/`seek`/`playSegment`), `packages/api-contract/src/content.ts` (`AppDeckPayload`/`AppLinePayload` — `audioUrl`, `sentenceId`, `audioStart/audioEnd`)
**Tasks**:

- [ ] Add `'mark'` to the `Screen` union (`types.ts`); add a gated `🏷️ Mark audio` button + `<MarkAudio v-if="env.curatorMode && screen==='mark'" :decks @back>` in `App.vue`, mirroring the `CurateAudio` wiring (same `env.curatorMode` gate, `@back → 'select'`).
- [ ] `MarkAudio.vue`: deck `<select>` from `props.decks`; if the chosen deck has no `audioUrl`, disable marking and show "Curate this deck's audio first (Curate audio →)". Otherwise mount `<AudioPlayer :src="deck.audioUrl" ref="player">`.
- [ ] Render `deck.lines` in order; per row show `native`/`romanization`/`english` and the row's `start`/`end`. Seed the `markers` map on deck-select from each line's `audioStart`/`audioEnd`.
- [ ] "Set In" / "Set Out" write `player.currentTime` into the focused row's `start`/`end`; keyboard nudge on a focused field (`←/→` ±0.05 s, `Shift+←/→` ±0.01 s); "Preview" calls `player.playSegment(start, end)`.
- [ ] "Export markers": build `DeckMarkerMap` from complete valid rows only (`start!=null && end!=null && end>start`), and download it as `<deckId>.json`.
      **Acceptance Criteria**:
- [ ] With `VITE_CURATOR_MODE=true`, a curator selects a curated deck, sets in/out on a sentence from the play-head, previews the segment, and exports a JSON map whose keys are the deck's `sentenceId`s and whose values are the captured `{start,end}` — verified in a component test driving the flow against a stub `AudioPlayer`.
- [ ] A deck with no `audioUrl` disables marking and points the curator to Curate audio; no dead/blank player is shown.
- [ ] Re-opening a deck that already has markers pre-fills each row from `audioStart`/`audioEnd`; a subsequent export round-trips them unchanged.
- [ ] A sentence with only a start (or `end ≤ start`) is excluded from the export; the export never contains a half or inverted marker.
- [ ] With `VITE_CURATOR_MODE` unset, the screen and its button are behind `v-if="env.curatorMode"` and DCE'd from the prod build (same guarantee as `CurateAudio`).

### EP43-ST05: Marker-map ingest — `apply-markers` seed step

**Scope**: `apps/cli-demo-db` — one CLI (`apply-markers.ts`) that writes markers into `decks.doc.sentences[]` by `sentenceId`. No server route, no wire/schema change. The seed/import half the marking-ADR's Pass 1 requires.
**Read List**: `apps/cli-demo-db/src/import-curriculum.ts` (`getDb`, deck-row load, `DeckDoc` parse/write pattern), `packages/api-contract/src/content.ts` (`DeckDocSchema`, `DeckSentenceSchema.audioStart/audioEnd`), `packages/db/src/schema.ts` (`decks.doc`), `packages/db/src/sqlite-content-store.ts` (how `doc` is read back / how markers surface on the wire)
**Tasks**:

- [ ] Add `apps/cli-demo-db/src/apply-markers.ts` taking `<path-to-marker-map.json>`; zod-validate the map (`deckId` non-empty, `markers` record of `{start,end}` with `end > start ≥ 0`).
- [ ] Load the `decks` row by `deckId` (fail loudly if absent — no silent no-op, mirroring `curate-audio`'s no-orphan guarantee); parse `doc` with `DeckDocSchema`.
- [ ] For each `doc.sentences[s]`: if `markers[s.sentenceId]` exists, set `audioStart = start`, `audioEnd = end`. Collect map keys with no matching `sentenceId` and warn (do not write them anywhere); write the updated `doc` back.
- [ ] Report a summary: `{ matched, skippedUnknown }`. Idempotent — re-running the same map produces byte-identical markers.
      **Acceptance Criteria**:
- [ ] After `apply-markers <map>` for a deck, `GET /api/decks` returns `audioStart`/`audioEnd` on exactly the mapped sentences (via EP42's unchanged read path); unmapped sentences keep those fields absent — verified end to end.
- [ ] Re-running the same map is a no-op (markers byte-identical); running a map for an unknown `deckId` fails loudly; a map key with no matching `sentenceId` is skipped-with-warning and never corrupts the doc.
- [ ] An inverted/zero-length pair that somehow reaches the file is rejected at parse (never written), matching the export-side validation — defence in depth across the hand-off.
- [ ] No schema/wire/engine type changes; `pnpm -r typecheck` and the test suite pass.

## 6. Success Criteria

1. A curator marks a full curated deck — set in/out per sentence from the play-head, slow to 0.5×, nudge, preview — entirely in `srs-demo`, with no external audio editor and no DB hand-editing (PRD §5).
2. Export → `apply-markers` → `GET /api/decks` surfaces the authored `audioStart`/`audioEnd`, matched by `sentenceId`, with no manual DB editing and no re-import.
3. The tool reuses EP43-DS01's `AudioPlayer`/`useSegmentPlayer` (including the prominent speed control) — no second player is built.
4. No server-write path for markers is introduced (marking-ADR Pass 1 holds); the marker map is keyed by DB `sentenceId` and applied in place, decoupled from the source-conversation JSON.
5. `apply-markers` is idempotent and fails loudly on an unknown deck; half/inverted markers are rejected on both the export and apply sides.
6. The marker screen + its nav button are gated by `env.curatorMode` and DCE'd from prod builds; no schema/wire/engine types change; `pnpm -r typecheck` and the suite pass.
