# EP42 - Deck Audio Storage & Retrieval (MinIO-backed)

**Created**: 20260713T003245Z

**Status**: Draft

<!-- Status: Draft | Accepted | In Progress | Impl-Complete | BDD Pending | Completed | Shelved | Withdrawn -->

**Type**: Epic Plan
**Depends on**: N/A (audio ADRs authored; no code dependency on another open epic)
**Parallel with**: EP-audio-playback-ui (consumes the `audioUrl`/`audioStart`/`audioEnd` wire fields this epic emits, to actually render `<audio>` controls in `QuizCard.vue`/`DeckOverview.vue`)
**Predecessor**: N/A

> **Scope update (20260713T222600Z):** the Pass-1 curator surfaces from the [Marking/Authoring ADR](../../product-documentation/architecture/20260713T140219Z-engineering-audio-marking-authoring.md) — previously tracked as a separate parallel epic — are pulled into this epic as Phase 3 (upload UI, replacing the `curate-audio` CLI — [EP42-DS02](../../changelogs/EP42--deck-audio-storage-and-retrieval/20260713T222600Z-EP42-DS02-curator-audio-upload-ui.md)) and Phase 4 (marker-authoring tool, spec to follow as EP42-DS03). Pass 2 (`apps/curator`, R2 upload-first, server-write endpoints, curator auth) stays explicitly out of scope.

---

## Problem Statement

The [Playback Model ADR](../../product-documentation/architecture/20260713T140218Z-engineering-audio-playback-model.md) decided the full data path for deck audio: `decks.audio_key` (DB) → per-sentence `audioStart`/`audioEnd` on `DeckSentence` → server resolves the key to a playable URL on read → `AppDeckPayload.audioUrl` / `AppLinePayload.audioStart`/`audioEnd` on the wire. None of it exists yet: no column in `packages/db/src/schema.ts`, no field in `@gll/api-contract`, no storage backend to resolve a key against.

Per the [Mixed-Platform Hosting ADR](../../product-documentation/architecture/20260712T124801Z-infra-mixed-platform-hosting.md), production storage is **Cloudflare R2** (S3-compatible), but local dev has no equivalent — the [Marking/Authoring ADR](../../product-documentation/architecture/20260713T140219Z-engineering-audio-marking-authoring.md) sidesteps this in Pass 1 by serving audio locally instead of through a bucket, a gap it flags as "must be tracked so it is actually migrated."

This epic builds the **full storage-to-wire path** end to end, against a **local MinIO bucket standing in for R2**: schema columns, wire types, and the server-side resolution logic that turns a stored key into a playable URL — so the marking tool and playback UI epics both have a real backend to build against, and production cutover to R2 is a config change, not a rewrite. Because there is no curator app yet to pair an audio upload with its DB row, the local upload script plays that role: MinIO is the bucket interface, the script is the "curator," and a single invocation keeps the object and the DB row in sync.

## Scope

**In scope**:

- `decks.audio_key` column (`packages/db/src/schema.ts`) — nullable, references the deck's single conversation audio file.
- `DeckSentence.audioStart` / `audioEnd` fields (optional, seconds-float) in `DeckDoc`.
- MinIO container (Docker Compose) simulating an S3-compatible bucket, with an auto-provisioned, public-read `gll-audio` bucket. *(Done.)*
- Server-side storage config (env-driven: endpoint, bucket, credentials, public URL base) and a thin S3-compatible client wrapper resolving `decks.audio_key` → a playable URL.
- Long-lived cache headers on upload (`Cache-Control: public, max-age=31536000, immutable`) — audio objects are never overwritten in place, so once written they're safe to cache forever, cutting repeat-play egress on both MinIO and R2.
- Wire additions: `AppDeckPayload.audioUrl?`, `AppLinePayload.audioStart?`/`audioEnd?`, wired into the existing `GET /api/decks` read path — absent key ⟹ absent `audioUrl`, no error.
- A local **curator script** pairing audio + content: uploads the audio file to the bucket *and* writes `decks.audio_key` + sentence markers through the existing seed/import path in one invocation, so the bucket object and the DB row never drift apart. This is the local stand-in for what Pass 2's server-write endpoint will eventually do over HTTP.
- Env-var contract designed so switching to R2 in production is a config change only (endpoint + credentials), never a code branch.
- A **curator audio-upload page** (`srs-demo`, env-gated route) — pick a deck + a local audio file, upload via a new server endpoint straight to MinIO, and write `decks.audio_key` in the same request. Replaces the `curate-audio` CLI (ST03) as the normal path; the CLI is retired once this ships. *(DS02.)*
- The **marker-authoring tool — Pass 1** (`srs-demo`, env-gated route), per the Marking/Authoring ADR: scrub the deck's (locally-served) conversation audio, set/nudge per-sentence `[start, end]` from the play-head, segment-preview a marked sentence, and export a JSON marker map (`sentenceId → {start, end}`) for the existing seed/import pipeline to ingest. No server write, no waveform, no auth beyond the route gate — matches the ADR's Pass-1 scope exactly. *(Design spec: EP42-DS03, to follow.)*

**Out of scope**:

- **Pass 2** of the curator surfaces above: the separate `apps/curator` app, upload-first-to-R2, markers persisted through server → DB writes, and curator auth — explicitly deferred by the Marking/Authoring ADR.
- Learner-facing playback UI — rendering `<audio>` controls, segment seek/stop, playback-rate control in `QuizCard.vue` / `DeckOverview.vue` — a separate playback-UI epic consumes the wire fields this epic emits.
- Actual R2 account/bucket provisioning (production cutover — separate infra task).
- `ReviewQuestionType` / engine changes — the playback ADR keeps `srs-engine-v2` audio-free; not touched here.
- Automated marker derivation (forced alignment, silence detection), word-level markers, and audio generation (TTS) — out of scope for both marker-tool passes per the ADR/PRD.

---

## Stories

### Phase 1: Storage backend (EP42-PH01)

### EP42-ST01: MinIO Docker Compose service + bucket bootstrap

**Scope**: Infra — `docker-compose.yml` running MinIO with a healthcheck-gated `mc` init step that creates and public-reads the `gll-audio` bucket. *(Done — verified: container healthy, bucket created, console + S3 endpoint reachable.)*

### EP42-ST02: Server storage config + S3-compatible client wrapper

**Scope**: Server — env-driven config (`GLL_AUDIO_ENDPOINT`, `GLL_AUDIO_BUCKET`, `GLL_AUDIO_ACCESS_KEY_ID`/`SECRET`, `GLL_AUDIO_PUBLIC_URL`) plus a thin client (AWS SDK v3, S3-compatible) exposing `resolveAudioUrl(key)` and a dev-only `putObject` helper. `putObject` sets `Cache-Control: public, max-age=31536000, immutable` on every write (playback ADR §7).

### EP42-ST03: Local curator script — paired audio upload + marker seed

**Scope**: Tooling — a CLI/script that, per deck, (1) uploads the audio file to `decks/{deckId}/audio.mp3` in the bucket and (2) writes `decks.audio_key` plus the sentence `audioStart`/`audioEnd` markers through the existing seed/import path, as one operation. The bucket holds only the binary; deck content stays in the DB, matching the marking ADR's seed/import routing — this script is the local, script-shaped equivalent of Pass 2's curator upload endpoint, not a second source of truth in MinIO.

### Phase 2: Deck-audio data path (EP42-PH02)

### EP42-ST04: Schema — `decks.audio_key` + `DeckSentence` marker fields

**Scope**: DB — additive Drizzle column on `decks`, additive optional fields on `DeckDoc.sentences[]`; no migration of existing rows.

### EP42-ST05: Wire types — `AppDeckPayload.audioUrl` / `AppLinePayload.audioStart`/`audioEnd`

**Scope**: API contract + server read path — `GET /api/decks` resolves `audio_key` via ST02's client and emits the wire fields; absence degrades silently (no `audioUrl`, no error).

### EP42-ST06: Local audio-loop documentation

**Scope**: Docs — README/setup notes covering `docker compose up`, required env vars, and the seed-a-key → resolve → play loop end to end.

### Phase 3: Curator audio-upload UI (EP42-PH03)

### EP42-ST08: Server upload endpoint — audio file → MinIO + `audio_key` write

**Scope**: `apps/server` — a new mutating route (e.g. `POST /api/curation/decks/:deckId/audio`) that accepts a multipart file upload, calls ST02's `putObject`, and writes `decks.audio_key` in the same request — the server-side equivalent of ST03's `curateAudio`, but driven by an HTTP body instead of a local file path. Gated: returns 404 unless a curator-mode env flag is set, so the mutating endpoint isn't reachable in a default production deploy without also flipping that flag.

### EP42-ST09: `srs-demo` gated audio-upload page

**Scope**: `apps/srs-demo` — a new env-gated screen: pick a deck (from the decks already fetched at boot) and a local `.mp3` file, upload, and see success/failure. Calls ST08's endpoint. Gated the same way the existing debug affordances are (`env.ts` flag, dead-code-eliminated in prod builds).

### EP42-ST10: Retire the `curate-audio` CLI

**Scope**: `packages/srs-curation` — remove `curate-audio.ts` and its test once ST08/ST09 cover the same job, so there is exactly one path to pair an audio file with a deck. Update EP42-DS01's references to ST03 to note it's superseded.

### Phase 4: Marker-authoring tool — Pass 1 (EP42-PH04)

### EP42-ST11: `srs-demo` gated marker-authoring route

**Scope**: `apps/srs-demo` — a new env-gated screen per the Marking/Authoring ADR §Pass 1: load a deck's sentence list + locally-served conversation audio; play/pause/scrub with a time readout; playback-rate control (1×/0.75×/0.5×, shared with the learner player); capture in/out per sentence from the play-head with keyboard-nudge fine adjustment; segment preview (play a single sentence's `[start, end]`); export a JSON marker map (`sentenceId → {start, end}`) for the seed/import pipeline. No server write, no waveform, no auth beyond the route gate. **Design spec deferred to EP42-DS03** — this story is a placeholder in the epic plan until that DS is written.

### EP42-ST12: Prominent playback-speed control in the audio player

**Scope**: `apps/srs-demo` — the playback-rate control (1× / 0.75× / 0.5×) is a **primary, always-visible** affordance in the audio player, not a hidden or secondary menu item. The curator relies on slow-down for precise marker placement (PRD §3, §4.1), and the same control carries to the learner player, so speed must be one tap/click away wherever audio plays — a visible segmented control or equivalent, with the current rate clearly indicated. **Design spec: EP42-DS03** (built as part of the shared audio-player component ST11 introduces).

---

## Overall Acceptance Criteria

- [ ] `docker compose up -d` brings MinIO up healthy with `gll-audio` auto-created and public-read, with no manual console steps.
- [ ] `decks.audio_key` and `DeckSentence.audioStart`/`audioEnd` exist in the schema/DeckDoc with no migration required for existing rows.
- [ ] Given a deck with `audio_key` set and markers on its sentences, `GET /api/decks` returns `audioUrl`, `audioStart`, `audioEnd` that resolve to a file that plays in a browser against the local MinIO bucket.
- [ ] A deck with no `audio_key` (or a sentence with no markers) returns payloads with those fields simply absent — no error, no crash.
- [ ] A documented command uploads a local audio file into the bucket **and** persists `decks.audio_key` + markers to the DB in the same run — the two never drift, checked by re-running against the same deck and confirming both sides match.
- [ ] Missing/unset storage env vars do not crash server startup — resolution just returns no `audioUrl`.
- [ ] Swapping to R2 in production requires only env-var changes (endpoint, credentials, public URL) — verified by code review, no code path branches on provider.
- [ ] An uploaded object carries `Cache-Control: public, max-age=31536000, immutable` (verified against the MinIO object's response headers).
- [ ] A curator can select a deck and a local `.mp3` file on a `srs-demo` page and, without a terminal or a script, have the file land in MinIO and `decks.audio_key` set to match — verified the same way as the ST03 loop it replaces.
- [ ] The upload endpoint is unreachable (404) when the curator-mode flag is unset; the upload page itself is not rendered/linked when its env flag is unset.
- [ ] The `curate-audio` CLI is removed once the upload page ships — no duplicate code path for pairing audio with a deck remains.
- [ ] A curator can mark every sentence in a deck — set start/end, scrub, adjust with keyboard nudge, preview a segment — without leaving the browser, and export a JSON marker map the seed/import pipeline ingests.
- [ ] The playback-speed control (1× / 0.75× / 0.5×) is a primary, always-visible affordance in the audio player, with the current rate clearly shown — reachable in one tap/click wherever audio plays.

---

## Dependencies

- [Playback Model ADR](../../product-documentation/architecture/20260713T140218Z-engineering-audio-playback-model.md)
- [Marking/Authoring ADR](../../product-documentation/architecture/20260713T140219Z-engineering-audio-marking-authoring.md)
- [Audio Marker Tool PRD](../../product-documentation/prds/20260713T140217Z-audio-marker-tool.md)
- [Mixed-Platform Hosting ADR](../../product-documentation/architecture/20260712T124801Z-infra-mixed-platform-hosting.md)

## Next Steps

1. Review and approve plan
2. ~~Create Design Spec (DS) for ST02/ST04/ST05~~ — done, EP42-DS01.
3. Design Spec for ST08/ST09/ST10 (upload endpoint + page + CLI retirement) — EP42-DS02.
4. Design Spec for ST11 (marker-authoring tool, Pass 1) — EP42-DS03, to follow.
5. Begin implementation of DS02; DS03 implementation follows once written.
