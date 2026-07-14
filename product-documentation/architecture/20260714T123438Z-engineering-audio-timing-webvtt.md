# ADR: Conversation Audio — Timing as WebVTT (Storage, Authoring & Playback)

**Status:** Accepted

**Date:** 2026-07-14

**Deciders:** PO (solo founder)

**Epic:** EP43 (re-scoped DS02 + a DS01 amendment).

**Supersedes:** [Marking (Authoring) ADR](20260713T140219Z-engineering-audio-marking-authoring.md) — its **Pass-1** decision (bespoke JSON marker map + `apply-markers` seed/import ingest, no server write) is replaced wholesale. **Amends:** [Playback Model ADR](20260713T140218Z-engineering-audio-playback-model.md) — its runtime *consume* mechanism changes (see Decision §6). **Sits on:** [Audio Asset Model ADR](20260714T123409Z-engineering-audio-asset-model.md) (the `audio` table that hosts the VTT column). **PRD:** [Audio Marker Tool](../prds/20260713T140217Z-audio-marker-tool.md).

---

## Context

The shipped marking design authored per-sentence timing as a **detached JSON marker map** (`{deckId, markers:{sentenceId:{start,end}}}`) ingested by an `apply-markers` CLI that wrote `decks.doc.sentences[].audioStart/audioEnd` in place.

The PO rejected the detached hand-off on architectural grounds: **a marker is `[start,end]` into a *specific audio binary*, so its timing must travel *with* that binary** — like a subtitle track bound to a video — not as a loose file with no binding to the bytes it describes. This ADR replaces the format, storage, authoring, and consume path accordingly. The runtime *need* (per-sentence `[start,end]` for playback) is preserved; the *mechanism* changes.

## Decision

**Represent, store, produce, and consume audio timing as WebVTT.**

1. **Format = WebVTT (`.vtt`).** Timing is a WebVTT cue list. The **cue-ID line = `sentenceId`** (robust; never positional). A reserved namespace **`sentenceId#wordIndex`** carries word-level cues in the *same* file — dormant until word-level ships, so adding it later is not a schema break.
2. **Two-tier storage, distinct jobs:**
   - **Bucket `.vtt` = durable system-of-record.** It sits next to the content-addressed `.mp3`, survives DB resets, and is the portable artifact. It is the authoritative *durable* copy.
   - **DB column = live working/read projection** (the `audio.vtt` column from the [asset-model ADR](20260714T123409Z-engineering-audio-asset-model.md)). Mutable during authoring, rehydratable from the bucket. Authoritative *for the running app*.
   - Same VTT text, two lifecycles: the DB is where timing *improves*; the bucket is where it *stabilizes*.
3. **One VTT per audio binary, not per sentence.** A binary is one timeline; sentences are cues within a single track. The VTT is keyed to the audio (the `audio` row / its content key), not per-sentence rows.
4. **Hash-stamped binding.** The VTT header carries `NOTE audio-sha256:<hash>` of the binary it was authored against. Binding is *logical* (the `audio` row) **and** *self-describing* (the stamp), making "travels with the binary" literal and making drift detectable.
5. **New audio = new timing (hard-invalidate).** This falls out of content-addressing for free: a re-uploaded binary is a **new key**, so the old VTT (bound to the old key) does not follow it; the read-path hash-check is only a backstop. Old timing is **retained as history** by the asset-model ADR's versioning — invalidated, not destroyed.
6. **Consume path = serve raw VTT; the browser parses it natively (Option C).** The server *stores and serves* the VTT; the learner's browser attaches it as a `TextTrack` and its subtitle engine fires `cuechange` to drive sentence highlighting — no server-side parsing and no manual "which sentence is playing" computation. Word-level highlighting (future) rides the same mechanism. **This amends the Playback ADR**, which previously read `audioStart/audioEnd` off `sentences[]`; the runtime *behaviour* (seek/highlight the current sentence) is unchanged, the *source* is now the served VTT.
   - *Premise:* timing is a **playback-only** concern. If server/engine logic ever needs the numbers as data (e.g. server-side clipping, duration scoring), a parsed server representation must be reconsidered — see Open questions.
7. **Producer = an isolated shared marker component in `srs-demo`.** The salvaged `MarkAudio.vue` + `useMarkerAuthoring.ts` are rebuilt as a self-contained unit — **VTT-in / VTT-out at the edges**, no reach into app internals — so it is portable to a curator surface or reusable for the learner word-level feature later. It *mounts* in `srs-demo` (gated); mounting location is not coupling. The bespoke `apply-markers.ts` CLI and the `DeckMarkerMap` zod schema are **dropped**.
8. **Write path = single-pass gated server-write.** A gated curator endpoint accepts VTT upload / overwrite / download, validates the hash stamp, and writes **both** the DB column and the bucket `.vtt`. This **deliberately collapses the old Pass-1/Pass-2 boundary** — server-write from the start; no seed/import pass is preserved as the primary path. Curator flow: upload audio → mark anytime (before/after) → commit flushes to bucket → downloadable → overwritable later.

## Consequences

**Positive:**

- The format earns its keep: WebVTT is stored, served, and consumed as-is — the browser does the playback sync, so we own less code, in fewer places.
- Timing genuinely travels with its binary (co-located `.vtt` + embedded hash), and staleness is detectable and automatic.
- Word-level highlighting is nearly free later — same file, same `cuechange` path.
- DS01 learner playback behaviour is preserved; only its source changes.

**Negative:**

- Timing lives only in a playback-consumable form; any non-playback consumer would need a parse step added (accepted premise).
- Server-write-from-the-start pulls curator-endpoint work forward that Pass-2 had deferred.
- Two storage tiers (bucket + DB) must be kept coherent (commit flushes DB→bucket; rehydrate bucket→DB).

**Neutral:**

- The `.mp3` binary path (content-addressed R2 bucket) is unchanged.
- Cue-ID namespace reserves word-level shape now but ships no word-level UI.

## Deferred / out of scope

- **Forced alignment** (aeneas / MFA) as a bulk producer — separate future epic.
- **Word-level marking UI** — cue-ID namespace reserved (§1), UI not built.
- **Crowdsourced / user audio** and the **replacement approval/permission flow** — see the [asset-model ADR](20260714T123409Z-engineering-audio-asset-model.md).

## Open questions (stated, not decided here)

- **Option-C premise:** confirm nothing but the playback screen ever needs timestamps as data before this hardens.
- **`subject_type` enum surface:** whether `sentence`/`word` ship inert or are added later (owned by the asset-model ADR).
