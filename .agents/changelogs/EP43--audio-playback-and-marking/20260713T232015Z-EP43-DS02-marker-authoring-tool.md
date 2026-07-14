# EP43-DS02: Audio Marker-Authoring Tool (WebVTT server-write) Specification

**Date**: 20260713T232015Z
**Redefined**: 20260714 — timing authored as **WebVTT**, committed via a **gated server-write** (DB `audio.vtt` + durable bucket `.vtt`); the bespoke JSON marker map + `apply-markers` CLI are dropped.
**Status**: Draft (re-implementation)
**Epic**: [EP43 - Audio Playback & Marking UI](../../plans/epics/EP43-audio-playback-and-marking.md)

**Architecture**:
- [WebVTT Timing ADR](../../../product-documentation/architecture/20260714T123438Z-engineering-audio-timing-webvtt.md) — Accepted. **The governing ADR**: §1 format (cue-ID = `sentenceId`), §2 two-tier storage, §4 `NOTE audio-sha256` hash-stamp, §7 isolated VTT-in/out marker component, §8 single-pass gated server-write.
- [Audio Asset Model ADR](../../../product-documentation/architecture/20260714T123409Z-engineering-audio-asset-model.md) — Accepted. The commit writes the `audio.vtt` column of the deck's **current** `audio` row.
- [Audio Marker Tool PRD](../../../product-documentation/prds/20260713T140217Z-audio-marker-tool.md) — the curator experience realized here.
- [Marking (Authoring) ADR](../../../product-documentation/architecture/20260713T140219Z-engineering-audio-marking-authoring.md) — **Superseded** (its Pass-1 bespoke-JSON hand-off is what this DS replaces).

**Depends on**: [EP43-DS01](20260713T232015Z-EP43-DS01-learner-audio-playback-ui.md) (the shared `AudioPlayer`/`useSegmentPlayer` primitive) + [EP42-DS01](../EP42--deck-audio-storage-and-retrieval/20260713T005450Z-EP42-DS01-deck-audio-storage-and-retrieval.md)/[DS02](../EP42--deck-audio-storage-and-retrieval/20260713T222600Z-EP42-DS02-curator-audio-upload-ui.md) (a curated `audio` row to mark + the `audio.vtt` column).

---

## 1. Feature Overview

Playback needs per-sentence `[start,end]` into a deck's conversation binary. This DS is the **curator tool that produces those ranges — as WebVTT** — and the **gated server-write that persists them**. It replaces the superseded design's JSON marker map + `apply-markers` seed CLI with a single **VTT-in / VTT-out** flow committed straight to storage.

Two parts, isolated:

- **Marker component (ST04)** — a self-contained, portable unit (`MarkAudio.vue` + `useMarkerAuthoring`), **VTT-in / VTT-out at its edges**, mounted gated in `srs-demo`. Salvages the existing capture/nudge/validity state model; swaps its I/O: `seed` now hydrates drafts from an existing **VTT** (not per-line wire numbers, which are gone), and export becomes **`buildVtt`** (not `buildMap`). Preview reuses the primitive's `playSegment(start,end)` on the draft numbers.
- **VTT server-write (ST05)** — a gated endpoint that accepts the committed VTT for a deck, validates its `NOTE audio-sha256` stamp against the deck's current `audio` row, and writes **both** tiers: the `audio.vtt` DB column (live projection) and the durable bucket `.vtt` (system-of-record) via `putObject` (`text/vtt`, `no-cache`). Single pass — no seed/import step.

**The critical boundary — the component only speaks VTT text; it never touches app internals or the DB.** It loads a VTT string (the deck's existing timing, if any), lets the curator author, and emits a VTT string. Persistence is the endpoint's job. That keeps the component reusable (a future curator app, or learner word-level marking) — mounting in `srs-demo` is not coupling.

**What is reused, not built:** the marker state model (`markers`/`seed`/`setIn`/`setOut`/`nudge`/`isComplete`/`quantize`, ±0.05/±0.01 nudge — salvaged); DS01's `AudioPlayer`/`useSegmentPlayer` (+ its retained `playSegment(start,end)` for draft preview); the `env.curationMode` gate + boot-time decks list; `putObject` + `deriveVttKey` (EP42); the `ApiResponse`/`ErrorCode` envelope; `isCurationMode`.

**Not in this DS:** learner consume (EP43-DS01); audio upload (EP42-DS02); word-level cue authoring (namespace `sentenceId#wordIndex` reserved, UI not built); forced alignment / TTS; a separate `apps/curator` app + curator auth beyond the route gate; audio-replacement approval flow.

## 2. Core Requirements

| Requirement | Decision | Rationale |
| --- | --- | --- |
| Timing format | **WebVTT** — one cue per marked sentence; cue-ID line = `sentenceId` | WebVTT ADR §1; robust, never positional |
| Hash-stamp | VTT header `NOTE audio-sha256:<hash>` = the current `audio` row's binary hash | ADR §4; binds timing to a specific binary; drift detectable |
| Component I/O | VTT-in (`loadVtt(text)`) / VTT-out (`buildVtt(): text`) at the edges; no app-internal reach | ADR §7; portable/reusable |
| Seed source | Hydrate drafts by parsing the deck's existing VTT (loaded from `vttUrl`) if present; else empty | Per-line wire numbers no longer exist; fine-tune an existing track |
| Capture / nudge | Salvaged: `setIn`/`setOut` off the play-head (quantised, clamped ≥0), keyboard nudge ±0.05 / ±0.01 | PRD §4.1; unchanged UX |
| Validity | A cue is emitted iff both edges set and `end > start` | Same invariant, now enforced at VTT build |
| Preview | `player.playSegment(draft.start, draft.end)` on the draft numbers | Drafts aren't committed cues yet; primitive retains `playSegment` |
| Commit transport | Gated `PUT /api/curation/decks/:deckId/audio/vtt`, body = VTT text (`text/vtt`) | Single-pass server-write (ADR §8) |
| Commit persistence | Validate stamp vs current row's hash → write `audio.vtt` (current row) **and** `putObject(deriveVttKey(row.key), vtt, 'text/vtt')` | Two-tier: DB projection + bucket SoR (ADR §2) |
| Endpoint gate | `404` unless `isCurationMode()` | Mutating surface invisible in default prod |
| No current audio row | `404` — nothing to attach timing to | A VTT is bound to a binary (ADR §4) |
| Stamp mismatch | `409 CONFLICT` — VTT authored against a different binary | Hard-invalidate (ADR §5); never silently mismatch |
| Download | Client-side blob of `buildVtt()` (`{deckId}.vtt`); the committed VTT is also served at `vttUrl` | Portability (PRD §5) |

## 3. Data Structures

```typescript
// ── ST04: marker state (apps/srs-demo/src/composables/useMarkerAuthoring.ts) ──
export interface MarkerDraft { start: number | null; end: number | null }
export interface MarkerAuthoring {
  markers: Ref<Record<string, MarkerDraft>>;
  /** Reset rows from the deck's sentences; hydrate any edges from an existing VTT. */
  seed(sentenceIds: string[], existingVtt?: string): void;
  setIn(sentenceId: string, time: number): void;
  setOut(sentenceId: string, time: number): void;
  nudge(sentenceId: string, edge: 'start' | 'end', delta: number): void;
  isComplete(sentenceId: string): boolean;
  /** Emit WebVTT: `NOTE audio-sha256:<hash>` header + one cue per complete row. */
  buildVtt(audioSha256: string): string;
}

// ── ST04: VTT helpers (apps/srs-demo/src/composables/vtt.ts) ──────────────────
/** WEBVTT + `NOTE audio-sha256` + `\n<sentenceId>\n<HH:MM:SS.mmm> --> <..>\n` per cue. */
export function buildVtt(
  cues: { id: string; start: number; end: number }[],
  audioSha256: string,
): string;
/** Parse cues back to { sentenceId: {start,end} }; ignores the NOTE header. */
export function parseVtt(text: string): Record<string, { start: number; end: number }>;
/** Read `NOTE audio-sha256:<hash>` from a VTT header (null if absent). */
export function readVttHash(text: string): string | null;

// ── ST05: server-write (apps/server/src/routes/curation.ts) ──────────────────
// PUT /api/curation/decks/:deckId/audio/vtt   body: text/vtt
//   if (!isCurationMode()) return 404;
//   const row = currentAudioRow(deckId);  if (!row) return 404;
//   const vtt = await c.req.text();
//   const keyHash = row.key.match(/\/([0-9a-f]+)\.(mp3|wav)$/)?.[1];
//   if (readVttHash(vtt) !== keyHash) return 409;             // bound to a different binary
//   getDb().update(audio).set({ vtt }).where(eq(audio.id, row.id)).run();  // DB projection
//   await putObject(cfg, deriveVttKey(row.key), Buffer.from(vtt), 'text/vtt'); // bucket SoR (no-cache)
//   return c.json({ success: true, data: { vttUrl } }, 200);
// GET  /api/curation/decks/:deckId/audio/vtt  → the current row's audio.vtt (or 404)

// ── ST05: client (apps/srs-demo, useStore.ts) ────────────────────────────────
export async function commitDeckVtt(deckId: string, vtt: string): Promise<void>;
export async function fetchDeckVtt(deckId: string): Promise<string | null>;
```

## 4. User Workflows

```
# Curator marks a deck (GLL_CURATION_MODE + VITE_CURATION_MODE set)
open srs-demo → "Mark audio" (env.curationMode) → pick a curated deck
  → AudioPlayer(:src=deck.audioUrl) loads; if deck.vttUrl, fetchDeckVtt → seed() hydrates drafts
  → per sentence: Set In / Set Out off the play-head; ←/→ nudge ±0.05, Shift+←/→ ±0.01
  → Preview → player.playSegment(draft.start, draft.end)
  → Commit  → buildVtt(audioHash) → PUT /api/curation/decks/:id/audio/vtt (text/vtt)
       server: curator? → current audio row? → stamp matches row hash? → write audio.vtt + bucket .vtt
       → 200 → GET /api/decks now returns vttUrl; learner surfaces (DS01) play the cues
  → Download → blob of buildVtt() as {deckId}.vtt (portability)

# Error paths
GLL_CURATION_MODE unset      → 404      no current audio row → 404 (upload audio first)
stamp ≠ current binary hash → 409      (audio was re-uploaded after this VTT was authored)
```

## 5. Stories

### EP43-ST04: Isolated VTT-in/VTT-out marker component + gated route

**Scope**: `apps/srs-demo` — retarget `useMarkerAuthoring` I/O + `MarkAudio.vue`; add `vtt.ts` helpers; keep the gate + mount from the shipped version.
**Read List**: current `useMarkerAuthoring.ts` + `MarkAudio.vue` (salvage), `AudioPlayer.vue` (`playSegment`), `useStore.ts` (client-fn pattern), `App.vue` (mount/gate).
**Tasks**:

- [ ] Add `vtt.ts`: `buildVtt(cues, hash)`, `parseVtt(text)`, `readVttHash(text)` (unit-tested; the repo tests composables, not `.vue`).
- [ ] `useMarkerAuthoring`: keep `markers`/`setIn`/`setOut`/`nudge`/`isComplete`/`quantize`; change `seed(sentenceIds, existingVtt?)` to hydrate from `parseVtt`; replace `buildMap` with `buildVtt(audioSha256)`. Drop the `DeckMarkerMap` import.
- [ ] `MarkAudio.vue`: on deck select, `fetchDeckVtt(deckId)` (if `deck.vttUrl`) → `seed(sentenceIds, vtt)`; keep capture/nudge/preview UI; replace "Export markers" with **Commit** (`commitDeckVtt`) + **Download** (blob of `buildVtt`). Show commit success/`409`/error status.
- [ ] Derive `audioSha256` for the stamp from the deck's current audio key (the tool reads it from `deck.audioUrl`'s filename hash).

**Acceptance Criteria**:

- [ ] `buildVtt`/`parseVtt` round-trip: parsing a built VTT returns the same `{sentenceId:{start,end}}` (centisecond-stable); `readVttHash` reads the `NOTE` stamp.
- [ ] Seeding a deck whose VTT already exists pre-fills the rows from the parsed cues; a deck with no VTT starts empty.
- [ ] Preview plays a draft `[start,end]`; the component imports no `DeckMarker`/app-internal types (grep).

### EP43-ST05: Gated VTT server-write endpoint (DB `audio.vtt` + bucket `.vtt`)

**Scope**: `apps/server` — add `PUT`/`GET /api/curation/decks/:deckId/audio/vtt` to `routes/curation.ts`; reuse `putObject`/`deriveVttKey`/`isCurationMode`.
**Read List**: `routes/curation.ts` (existing audio endpoint), `audio-store.ts` (`putObject`/`deriveVttKey`), `packages/db/src/schema.ts` (`audio`).
**Tasks**:

- [ ] `PUT`: gate on `isCurationMode`; look up the current `audio` row (404 if none); read the VTT body; validate `readVttHash(vtt) === keyHash` (409 on mismatch); write `audio.vtt` (current row) + `putObject(deriveVttKey(row.key), vtt, 'text/vtt')`; return `200 { vttUrl }`.
- [ ] `GET`: return the current row's `audio.vtt` as `text/vtt` (404 if none / no VTT).
- [ ] Add `readVttHash` (shared or server-local) for the stamp check.

**Acceptance Criteria**:

- [ ] `GLL_CURATION_MODE=true` + current audio row + stamp matching the row hash ⟹ `200`; `audio.vtt` is set and a `.vtt` object exists at `deriveVttKey(key)`; `GET /api/decks` then returns `vttUrl`.
- [ ] Gate unset ⟹ `404`; no current audio row ⟹ `404`; stamp mismatch ⟹ `409` with neither tier written.
- [ ] Re-uploading audio (new current row, new key/hash) leaves the old VTT behind — a subsequent commit for the new binary must carry the new hash or `409`s.

## 6. Success Criteria

1. A curator marks a full deck in the browser — set/scrub/nudge/preview — and **commits WebVTT**; no external editor, no JSON, no `apply-markers`.
2. Commit writes **both** the `audio.vtt` DB column and the durable bucket `.vtt`; `GET /api/decks` surfaces `vttUrl` and DS01's learner surfaces play the cues — no manual DB/file editing.
3. The committed VTT is hash-stamped to its binary; re-uploading the audio hard-invalidates old timing (`409` on a stale commit); the VTT is downloadable.
4. The marker component is VTT-in/VTT-out and imports no app internals — portable to a future curator surface / learner word-level marking.
5. The endpoint is `404` unless `GLL_CURATION_MODE`; no `DeckMarker`/`apply-markers` references remain; `pnpm -r typecheck` + suite pass.
