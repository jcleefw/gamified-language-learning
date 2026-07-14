# Current Focus — EP43 Audio Playback & Marking

**Status**: **PAUSED mid-DS02 — pivot DECIDED, ADRs written, awaiting epic revision + implementation.**
DS01 (learner playback) is done & committed. DS02 (marker-authoring) was stopped mid-build when the PO
opened an architecture question superseding its design. That question is now **fully framed and resolved**
across a discovery session, and **two ADRs are written**. Next is revising the epics, then building.
**Branch**: `EP42--create-bucket-for-audio` (EP42 + EP43 work rides here; **neither is merged to main**).
**Last updated**: 20260714

---

## Outcome of the pivot discussion (the spine — now ratified in ADRs)

The bespoke detached-JSON marker map is dropped. Timing is **WebVTT**, bound to the audio binary like a
subtitle track. Audio becomes a **first-class, versioned entity** (not a `decks.audio_key` column). The
full decision record (11 decisions + deferrals) is captured in the two ADRs below.

### ADRs written (20260714)

- **[Audio Asset Model ADR](../../../product-documentation/architecture/20260714T123409Z-engineering-audio-asset-model.md)**
  (substrate) — standalone `audio` table; polymorphic owner (`deck` only for now; `sentence`/`word`
  reserved); deck↔audio 1:1 but **versioned/history-retained** on replace; nullable `vtt` column;
  deck≡sentence audio; **supersedes EP42's `decks.audio_key` column** (adopted by *revising EP42 in
  place* since EP42 is unmerged — no migrate-then-drop). Replacement is admin/curator-only; approval
  flow + permission-gating deferred.
- **[WebVTT Timing ADR](../../../product-documentation/architecture/20260714T123438Z-engineering-audio-timing-webvtt.md)**
  (sits on the asset model) — WebVTT format (cue-ID = `sentenceId`; `sentenceId#wordIndex` reserved);
  two-tier storage (**bucket `.vtt` = durable SoR**, **DB column = live projection**); one VTT per
  binary; **hash-stamp** (`NOTE audio-sha256`) binding + **hard-invalidate** on new audio;
  **Option C consume** (serve raw VTT → browser `TextTrack`, no server parse) — this **amends the
  playback ADR** (behaviour same, source now the served VTT); **isolated shared marker component** in
  `srs-demo` (VTT-in/out); **single-pass gated server-write** (collapses old Pass-1/Pass-2).
  **Supersedes** the [marking ADR](../../../product-documentation/architecture/20260713T140219Z-engineering-audio-marking-authoring.md)
  Pass-1. **Amends** the [playback ADR](../../../product-documentation/architecture/20260713T140218Z-engineering-audio-playback-model.md)
  consume mechanism (its "unchanged" note is now false).

## Epic mapping (decided; revision not yet done)

- **Asset Model ADR → a storage epic (proposed EP44)** — does NOT fit EP43's no-schema charter. Revises
  unmerged EP42 to introduce the `audio` table from the start.
- **WebVTT ADR → EP43** — re-scoped DS02 (WebVTT storage + gated server-write + retargeted marker UI) +
  a DS01 touch (Option C consume).
- **Implementation order:** (1) asset model / EP44 substrate → (2) EP43 storage+server-write → producer
  (marker UI) → consumer (Option C, amends DS01) → (3) cleanup (revert bespoke-JSON artifacts).
- Because EP42 + EP43 are unmerged, **epic revisions should edit those plans in place** — avoid landing a
  migration in main only to drop it.

## Uncommitted code from the abandoned bespoke-JSON approach (reconcile during build)

- `packages/api-contract/src/content.ts` — `DeckMarker`/`DeckMarkerMap` zod schemas → **drop**.
- `apps/srs-demo/src/types.ts` — `'mark'` in `Screen` union → keep (UI still mounts).
- `apps/srs-demo/src/components/MarkAudio.vue` — **salvage**, retarget export to WebVTT, isolate as
  shared component.
- `apps/srs-demo/src/composables/useMarkerAuthoring.ts` (+ tests) — **salvage** state model; swap
  `buildMap`→VTT emit/load.
- `apps/srs-demo/src/App.vue` — gated `🏷️ Mark audio` nav + mount → keep.
- `apps/cli-demo-db/src/apply-markers.ts` — **drop** (obsolete under VTT + server-write).

## Open follow-ups (stated in ADRs, not yet decided)

1. **Option-C premise** — confirm nothing but the playback screen needs timestamps as data.
2. **Audio-replacement approval/permission flow** — provisional "admin approves"; own discussion.
3. **`subject_type` enum surface** — ship `deck` only; widen to `sentence`/`word` when built.

## Immediate next steps

1. **Revise EP42** (in place) to the standalone `audio` table + versioning (asset-model ADR).
2. **Re-scope EP43-DS02** to the WebVTT ADR (storage, server-write, marker-UI producer, Option C consume);
   note the DS01 amendment.
3. Then implement in the order above; reconcile the uncommitted code as noted.
