# Current Focus — EP42/EP43 Audio (redefined: audio-table + WebVTT)

**Status**: **Docs redefined + code reconciled; verified green.** The `decks.audio_key` design was replaced,
in place on this branch, by the standalone `audio` table (EP42) + WebVTT timing (EP43). Epics + all four DS specs
rewritten; ADR/PRD cross-refs updated; all code landed. `pnpm -r typecheck` clean across 10 projects; full test
sweep green (server 198, db 80, srs-demo 71, cli-demo-db 59, engine 212, +others). Grep-clean of
`audio_key`/`DeckMarker`/`apply-markers` (only absence-assertions + comments remain).
**Remaining**: (a) manual MinIO-up browser walkthrough (upload → mark → commit VTT → learner plays cues) — not
yet run; (b) `useSegmentPlayer.test.ts` playCue/activeCueId cases (needs a mocked TextTrack) — DS01 AC gap, non-blocking.
Nothing committed yet — changes are in the working tree.
**Branch**: `EP42--create-bucket-for-audio` (EP42 + EP43 ride here; **neither merged to main**; reworked in place — no v2 branch).
**Last updated**: 20260714

---

## The redefinition (locked 20260714)

Two decisions drove a full rework of the audio epics **in place** on the unmerged branch:

1. **Storage model**: `decks.audio_key` column → **standalone, versioned `audio` table** (asset-model ADR). No `audio_key`,
   no `0012_deck_audio.sql`. Deck↔audio 1:1-current, `is_current` versioning, nullable `vtt` column, polymorphic
   `subject_type` (**deck-only**).
2. **Timing**: bespoke detached-JSON marker map → **WebVTT**, bound to the binary (WebVTT ADR). Served from the bucket;
   consumed by the browser's native `TextTrack`/`cuechange` (Option C). **No per-line `audioStart`/`audioEnd` on the wire.**

### Epic split (no EP44 — asset model folded into EP42)

- **EP42** = deck audio *storage & retrieval* on the `audio` table. Keeps the still-relevant code (MinIO/R2 substrate,
  content-addressed keys, magic-byte check, immutable cache, curator upload endpoint + page, env→R2 contract);
  removes `audio_key`/`0012`/per-line timing/`DeckMarker`. Emits `audioUrl` + `vttUrl` on `GET /api/decks`.
- **EP43** = *playback & marking*. **DS01** retrofits learner playback to the VTT `TextTrack`/`cuechange` consume path
  (`playCue(sentenceId)`, `activeCueId`), dropping per-line number reads. **DS02** rebuilds the marker tool as an
  isolated **VTT-in/VTT-out** component committing via a **gated single-pass server-write** (DB `audio.vtt` +
  durable bucket `.vtt`, hash-stamped). Drops the JSON export + `apply-markers`.

## Key design decisions baked into the specs

- **VTT served from the bucket via a derived key** (`deriveVttKey`: `…/{sha256}.mp3` → `…/{sha256}.vtt`), so
  `vttUrl = resolveAudioUrl(deriveVttKey(row.key))` reuses DS01's pure resolver — **`@gll/db` stays env-free**.
- **`audio.vtt` DB column** = live working/rehydrate copy + "VTT exists?" signal (non-null ⟹ emit `vttUrl`).
  **Bucket `.vtt`** = durable SoR learners consume. VTT objects: `no-cache` (overwritable on re-mark); audio binary: `immutable`.
- **Player primitive keeps `playSegment(start,end)`** (marker-tool draft preview) **and adds `playCue(sentenceId)`**
  (committed cues) + `activeCueId`.
- **Server-write stamp check**: `readVttHash(vtt)` must equal the current `audio` row's key hash → else `409`.

## Code reconciliation (manifest-classified; all 55 branch files accounted for)

- **DROP**: `apps/cli-demo-db/src/apply-markers.ts`; `DeckMarker`/`DeckMarkerMap` in `api-contract/src/content.ts`;
  `packages/db/drizzle/migrations/0012_deck_audio.sql`; per-line `audioStart`/`audioEnd` (wire + `DeckSentence`).
- **REWRITE**: `db/src/schema.ts` (audio table + new migration); `sqlite-content-store.ts` (current-row resolution);
  `content.ts` (drop markers, add `vttUrl`); `curation.ts` (upload → audio-row insert; + VTT server-write endpoint);
  `audio-store.ts` (+`deriveVttKey`, `text/vtt` cache branch); `useMarkerAuthoring.ts` + `MarkAudio.vue` (VTT-in/out);
  `useSegmentPlayer.ts` + `AudioPlayer.vue` (`<track>`/`playCue`/`activeCueId`); `useAudio.ts`, `DeckOverview.vue`,
  `QuizCard.vue`, `App.vue` (cue-driven); tests across db/server/srs-demo.
- **KEEP**: MinIO `docker-compose.yml`, `CurateAudio.vue` + upload flow, `putObject`/gating, curator env flags.

## Open follow-ups (from the ADRs, not yet decided)

1. **Option-C premise** — confirm nothing but the playback screen needs timestamps as data.
2. **Audio-replacement approval/permission flow** — provisional "admin approves"; own discussion.
3. **`subject_type` enum surface** — ship `deck` only; widen to `sentence`/`word` when built.

## Immediate next steps

1. Finish the code reconciliation in dependency order: schema+migration → api-contract → server → srs-demo.
2. Verify: `pnpm -r typecheck` + test suites; grep clean for `audio_key`/`DeckMarker`/`apply-markers`.
3. Manual: MinIO-up browser walkthrough (upload → mark → commit VTT → learner plays cues).
