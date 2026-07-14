# EP42 - Deck Audio Storage & Retrieval (Standalone Audio Asset Model)

**Created**: 20260713T003245Z
**Redefined**: 20260714 — re-based on the standalone `audio` table; the `decks.audio_key` column design is removed, not superseded-in-history.

**Status**: Draft

<!-- Status: Draft | Accepted | In Progress | Impl-Complete | BDD Pending | Completed | Shelved | Withdrawn -->

**Type**: Epic Plan
**Depends on**: N/A (audio ADRs authored; no code dependency on another open epic)
**Parallel with**: N/A
**Successor**: [EP43 - Audio Playback & Marking UI](EP43-audio-playback-and-marking.md) — consumes the wire fields this epic emits (`AppDeckPayload.audioUrl`, `AppDeckPayload.vttUrl`), the curated `audio` row (binary), and the `audio.vtt` timing sidecar: renders learner `<audio>` + a served `<track>` on `DeckOverview`/`QuizCard` (EP43-DS01) and authors the VTT via the marker tool (EP43-DS02).
**Predecessor**: N/A

> **Redefinition (20260714):** During the EP43-DS02 pivot the PO rejected the `decks.audio_key` **column** model. EP42 is unmerged, so rather than ship a column and drop it later, EP42 is **redefined to build the standalone `audio` table from the start** — one first-class, versioned audio entity per the [Audio Asset Model ADR](../../product-documentation/architecture/20260714T123409Z-engineering-audio-asset-model.md). The still-relevant EP42 work (MinIO/R2 storage substrate, content-addressed keys, magic-byte format check, immutable cache headers, curator upload endpoint + page, env→R2 config contract) is **kept**; the `audio_key` column, migration `0012_deck_audio.sql`, and the per-sentence `audioStart`/`audioEnd` wire/doc fields are **removed**. Timing moves entirely to WebVTT (EP43). *There is no separate EP44 — the asset-model work lives here.*
>
> **Prior scope notes (historical):** the Pass-1 upload UI was pulled into EP42 as Phase 3 (DS02); learner playback + marker authoring moved to [EP43](EP43-audio-playback-and-marking.md). Those boundaries stand; only the storage *model* changed.

---

## Problem Statement

A deck has one conversation audio file. The [Playback Model ADR](../../product-documentation/architecture/20260713T140218Z-engineering-audio-playback-model.md) fixed the runtime need (a learner hears the whole conversation and any single sentence's `[start,end]` segment), and the [Mixed-Platform Hosting ADR](../../product-documentation/architecture/20260712T124801Z-infra-mixed-platform-hosting.md) fixed where the binary lives (Cloudflare R2 in prod, S3-compatible, browser→bucket). None of the storage-to-wire path exists yet.

EP42 originally modeled a deck's audio as a single **`decks.audio_key` column** — one binary, one slot, deck-owned, with per-sentence timing smeared across `DeckDoc.sentences[]`. The [Audio Asset Model ADR](../../product-documentation/architecture/20260714T123409Z-engineering-audio-asset-model.md) rejected that as too narrow:

- **Audio is not inherently deck-scoped** — the same word/sentence clip is reusable across decks; a deck-owned column can never express that.
- **Replacing audio should not destroy history** — binaries are content-addressed (a re-record is a *new key*), so the previous audio + its timing still exist and should be retained, not clobbered.
- **Timing must hang off the binary, not the deck** — the [WebVTT Timing ADR](../../product-documentation/architecture/20260714T123438Z-engineering-audio-timing-webvtt.md) keys timing to a specific binary, so timing belongs on the audio record.

This epic builds the **full storage-to-wire path** end to end against a **local MinIO bucket standing in for R2**: the standalone `audio` table (versioned, with a nullable `vtt` sidecar column), the S3-compatible client that resolves an `audio` row to a playable URL, the wire fields (`audioUrl`, `vttUrl`), and the curator upload path that pairs a binary with a deck by inserting an `audio` row. Timing *content* (the VTT itself) is authored and consumed in EP43; EP42 only provides the column and serves it. Production cutover to R2 stays a config change, not a rewrite.

## Scope

**In scope**:

- **Standalone `audio` table** (`packages/db/src/schema.ts`) — one row per binary asset: content-addressed `key`, `format`, `size_bytes`, `duration_seconds` (nullable), `uploaded_by` (nullable), `created_at`, nullable **`vtt`** text column (the timing sidecar; populated in EP43), polymorphic owner `subject_type` + `subject_id`, and `is_current`. `subject_type` ships **`deck`-only** (the enum stays honest to what is wired; `sentence`/`word` are reserved shape, not declared values).
- **Deck↔audio 1:1, versioned** — replacing a deck's audio inserts a new `audio` row and flips `is_current`; the prior row (binary key **and** its VTT) is retained as history. Content-addressing dedups bytes in the bucket, so history costs rows, not blobs.
- **New migration** creating the `audio` table (replaces the removed `0012_deck_audio.sql`; no `audio_key` column ever reaches a migration).
- MinIO container (Docker Compose) simulating an S3-compatible bucket, auto-provisioned public-read `gll-audio` bucket. *(Done.)*
- Server-side storage config (env-driven: endpoint, bucket, credentials, public URL base) and a thin S3-compatible client wrapper resolving the current `audio` row's key → a playable URL, and composing the `.vtt` URL.
- Long-lived cache headers on binary upload (`Cache-Control: public, max-age=31536000, immutable`) — content-addressed keys are never overwritten in place, so once written they are safe to cache forever.
- **Wire additions**: `AppDeckPayload.audioUrl?` (resolved from the current `audio` row) and `AppDeckPayload.vttUrl?` (the served timing track), wired into `GET /api/decks`. No current `audio` row ⟹ both absent, no error. **Per-sentence `audioStart`/`audioEnd` are NOT on the wire** — timing is the VTT track (EP43 consumes it via the browser's native `TextTrack`).
- A **curator audio-upload page** (`srs-demo`, env-gated) + its **server endpoint** (`POST /api/curation/decks/:deckId/audio`) — pick a deck + a local audio file, upload straight to MinIO under a content-addressed key, and insert the `audio` row (current) in the same request. Gated by `GLL_CURATOR_MODE` (server) / `VITE_CURATOR_MODE` (client). *(DS02 — carried over; row-write replaces the `audio_key` write.)*
- Env-var contract so switching to R2 in production is a config change only (endpoint + credentials + public URL), never a code branch.

**Out of scope**:

- **The VTT *content* pipeline** — authoring markers, the marker tool, the gated VTT server-write endpoint, and learner consume — all **[EP43](EP43-audio-playback-and-marking.md)**. EP42 provides the `audio.vtt` column and serves the `.vtt`; it does not author or read timing.
- Learner-facing playback UI — moved to **[EP43-DS01](EP43-audio-playback-and-marking.md)**.
- **Audio-replacement approval / permission flow** — replacement is admin/curator-only; the approval model is deferred (asset-model ADR §6).
- `sentence` / `word` subject types — shape reserved, paths not built.
- Crowdsourced / user audio (a different storage tier) — not modeled now.
- Actual R2 account/bucket provisioning (production cutover — separate infra task).
- `ReviewQuestionType` / engine changes — the engine stays audio-free.
- Automated marker derivation (forced alignment), word-level audio, TTS generation.

---

## Stories

### Phase 1: Storage backend (EP42-PH01)

### EP42-ST01: MinIO Docker Compose service + bucket bootstrap  *(Done)*

**Scope**: Infra — `docker-compose.yml` running MinIO with a healthcheck-gated `mc` init step that creates and public-reads the `gll-audio` bucket. *(Verified: container healthy, bucket created, console + S3 endpoint reachable.)*

### EP42-ST02: Server storage config + S3-compatible client wrapper  *(Done — carried over)*

**Scope**: Server — env-driven config (`GLL_AUDIO_ENDPOINT`, `GLL_AUDIO_BUCKET`, `GLL_AUDIO_ACCESS_KEY_ID`/`SECRET`, `GLL_AUDIO_PUBLIC_URL`) plus a thin client (AWS SDK v3, S3-compatible): `resolveAudioUrl(key)`, a `.vtt`-URL composer, and a dev/curator-only `putObject` (sets `Cache-Control: public, max-age=31536000, immutable` on binary writes). Pure string composition on the read path — crash-proof against unset env.

### Phase 2: Audio-asset data path (EP42-PH02)

### EP42-ST04: Schema — standalone `audio` table + new migration

**Scope**: DB — add the `audio` table (fields per Scope), **remove** the `decks.audio_key` column, delete `0012_deck_audio.sql`, and add a fresh migration that creates `audio`. `subject_type` allowed-set = `deck` only. `vtt` nullable (EP43 fills it). Update `meta/_journal.json` + snapshot so the migration set is coherent with no `audio_key` artifact.

### EP42-ST05: Wire types — `AppDeckPayload.audioUrl` / `vttUrl`; drop per-line timing

**Scope**: API contract + server read path — `GET /api/decks` resolves the deck's **current** `audio` row via ST02's client and emits `audioUrl` + `vttUrl`; absence degrades silently. **Remove** `AppLinePayload.audioStart`/`audioEnd` and `DeckSentence.audioStart`/`audioEnd` (timing is the VTT track). Remove `DeckMarker`/`DeckMarkerMap` (bespoke-JSON hand-off, obsolete under VTT).

### EP42-ST06: Local audio-loop documentation

**Scope**: Docs — README/setup notes covering `docker compose up`, required env vars, and the upload-a-binary → resolve → play loop end to end (row-based; VTT authored in EP43).

### Phase 3: Curator audio-upload UI (EP42-PH03)

### EP42-ST08: Server upload endpoint — audio file → MinIO + `audio` row write  *(carried over; row-write replaces `audio_key`)*

**Scope**: `apps/server` — `POST /api/curation/decks/:deckId/audio`: multipart file in, magic-byte format check (MP3/WAV only), content-addressed key (`decks/{deckId}/{sha256}.{ext}`), `putObject`, then **insert an `audio` row** (subject_type=`deck`, subject_id=deckId, is_current=1, prior current row demoted) in the same request. Gated: 404 unless `GLL_CURATOR_MODE`.

### EP42-ST09: `srs-demo` gated audio-upload page  *(Done — carried over)*

**Scope**: `apps/srs-demo` — env-gated screen: pick a deck + a local `.mp3`/`.wav`, upload, see success/failure. Calls ST08. Gated by `VITE_CURATOR_MODE`, DCE'd in prod builds. (Existing `CurateAudio.vue` — unchanged beyond the endpoint's row-write semantics.)

### EP42-ST10: Retire the `curate-audio` CLI  *(Done — carried over)*

**Scope**: One path to pair audio with a deck (the upload page). The `curate-audio` CLI + test removed; local-loop docs updated.

> **Removed vs. the original EP42:** the `decks.audio_key` schema/migration (ST04 rewritten to the `audio` table), the per-sentence marker fields on the wire/doc (moved to VTT), and the bespoke marker-map ingest (former ST13 / `apply-markers` — dropped; see EP43-DS02 for the WebVTT server-write that replaces it).

---

## Overall Acceptance Criteria

- [ ] `docker compose up -d` brings MinIO up healthy with `gll-audio` auto-created and public-read, no manual console steps.
- [ ] The `audio` table exists (key, format, size, duration, uploaded_by, created_at, nullable `vtt`, `subject_type` deck-only, `subject_id`, `is_current`); **no `decks.audio_key` column and no `0012_deck_audio.sql` exist anywhere** in the schema or migration set.
- [ ] Uploading audio for a deck inserts an `audio` row (`is_current=1`); uploading again inserts a new row and demotes the prior to `is_current=0` — history retained, binary deduped by content-address.
- [ ] Given a deck with a current `audio` row, `GET /api/decks` returns `audioUrl` (and `vttUrl` when `audio.vtt` is set) that resolve against the local MinIO bucket.
- [ ] A deck with no current `audio` row returns payloads with `audioUrl`/`vttUrl` simply absent — no error, no crash. **No `audioStart`/`audioEnd` appear on any payload.**
- [ ] Missing/unset storage env vars do not crash server startup — resolution just returns no URLs.
- [ ] Swapping to R2 in production requires only env-var changes — verified by code review, no provider branch.
- [ ] An uploaded binary carries `Cache-Control: public, max-age=31536000, immutable`.
- [ ] A curator can select a deck + a local audio file on a `srs-demo` page and, without a terminal, have the file land in MinIO and a current `audio` row written to match.
- [ ] The upload endpoint is unreachable (404) when `GLL_CURATOR_MODE` is unset; the page is gated behind `VITE_CURATOR_MODE` and DCE'd when unset.
- [ ] `pnpm -r typecheck` and the suite pass with no reference to `audio_key`, `DeckMarker`, or per-line `audioStart`/`audioEnd`.

*(Learner playback, VTT authoring, and VTT consume ACs live in [EP43](EP43-audio-playback-and-marking.md).)*

---

## Dependencies

- [Audio Asset Model ADR](../../product-documentation/architecture/20260714T123409Z-engineering-audio-asset-model.md) — **the table this epic builds.**
- [WebVTT Timing ADR](../../product-documentation/architecture/20260714T123438Z-engineering-audio-timing-webvtt.md) — defines the `audio.vtt` column's contents/lifecycle (authored + consumed in EP43).
- [Playback Model ADR](../../product-documentation/architecture/20260713T140218Z-engineering-audio-playback-model.md) — the runtime need (amended: consume path is now the served VTT).
- [Marking (Authoring) ADR](../../product-documentation/architecture/20260713T140219Z-engineering-audio-marking-authoring.md) — **Superseded** by the WebVTT ADR (kept for its rejected-alternative record).
- [Audio Marker Tool PRD](../../product-documentation/prds/20260713T140217Z-audio-marker-tool.md)
- [Mixed-Platform Hosting ADR](../../product-documentation/architecture/20260712T124801Z-infra-mixed-platform-hosting.md)

## Next Steps

1. Review and approve the redefinition.
2. DS01 (storage & retrieval — ST02/ST04/ST05) → rewrite to the `audio` table + `audioUrl`/`vttUrl` wire.
3. DS02 (curator upload — ST08/ST09/ST10) → light rewrite: endpoint writes an `audio` row instead of `decks.audio_key`.
4. Hand off to [EP43](EP43-audio-playback-and-marking.md) for VTT authoring + consume.
