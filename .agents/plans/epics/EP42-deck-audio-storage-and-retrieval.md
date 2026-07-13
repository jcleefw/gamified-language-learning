# EP42 - Deck Audio Storage & Retrieval (MinIO-backed)

**Created**: 20260713T003245Z

**Status**: Draft

<!-- Status: Draft | Accepted | In Progress | Impl-Complete | BDD Pending | Completed | Shelved | Withdrawn -->

**Type**: Epic Plan
**Depends on**: N/A (audio ADRs authored; no code dependency on another open epic)
**Parallel with**: N/A
**Successor**: [EP43 - Audio Playback & Marking UI](EP43-audio-playback-and-marking.md) — consumes the `audioUrl`/`audioStart`/`audioEnd` wire fields this epic emits: renders learner `<audio>` on `DeckOverview`/`QuizCard` (EP43-DS01) and builds the marker-authoring tool (EP43-DS02).
**Predecessor**: N/A

> **Scope update (20260713T222600Z):** the Pass-1 **upload UI** from the [Marking/Authoring ADR](../../product-documentation/architecture/20260713T140219Z-engineering-audio-marking-authoring.md) is pulled into this epic as Phase 3 (upload UI, replacing the `curate-audio` CLI — [EP42-DS02](../../changelogs/EP42--deck-audio-storage-and-retrieval/20260713T222600Z-EP42-DS02-curator-audio-upload-ui.md)). Pass 2 (`apps/curator`, R2 upload-first, server-write endpoints, curator auth) stays explicitly out of scope.
>
> **Scope update (20260713T232015Z):** EP42 **ends at DS02** (storage + curator upload). Everything that *renders audio to a learner* or *authors markers in the browser* — the former Phase 4 (marker-authoring tool, drafted as EP42-DS03) plus learner playback — moved to **[EP43](EP43-audio-playback-and-marking.md)** (DS01 = learner playback UI; DS02 = marker tool, re-homed from the EP42-DS03 draft). This keeps EP42 a coherent "storage + authoring-of-the-binary" epic and EP43 the "heard + marked" epic.

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
- A **curator audio-upload page** (`srs-demo`, env-gated route) — pick a deck + a local audio file, upload via a new server endpoint straight to MinIO, and write `decks.audio_key` in the same request. Replaces the `curate-audio` CLI (ST03) as the normal path; the CLI is retired once this ships. *(DS02 — the last EP42 story.)*

**Out of scope**:

- **Pass 2** of the curator surfaces above: the separate `apps/curator` app, upload-first-to-R2, markers persisted through server → DB writes, and curator auth — explicitly deferred by the Marking/Authoring ADR.
- Learner-facing playback UI — rendering `<audio>` controls, segment seek/stop, playback-rate control in `QuizCard.vue` / `DeckOverview.vue` — moved to **[EP43-DS01](EP43-audio-playback-and-marking.md)**, which consumes the wire fields this epic emits.
- The **marker-authoring tool — Pass 1** (gated `srs-demo` route, keyboard-nudge markers, JSON marker-map export) and its **seed/import ingest** — moved to **[EP43-DS02](EP43-audio-playback-and-marking.md)** (re-homed from the EP42-DS03 draft).
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

### EP42-ST08: Server upload endpoint — audio file → MinIO + `audio_key` write  *(Done — EP42-DS02)*

**Scope**: `apps/server` — a new mutating route (`POST /api/curation/decks/:deckId/audio`) that accepts a multipart file upload, calls ST02's `putObject`, and writes `decks.audio_key` in the same request — the server-side equivalent of ST03's `curateAudio`, but driven by an HTTP body instead of a local file path. Gated: returns 404 unless `GLL_CURATOR_MODE` is set, so the mutating endpoint isn't reachable in a default production deploy without also flipping that flag.

### EP42-ST09: `srs-demo` gated audio-upload page  *(Done — EP42-DS02; one AC pending a MinIO-up browser walkthrough)*

**Scope**: `apps/srs-demo` — a new env-gated screen: pick a deck (from the decks already fetched at boot) and a local `.mp3` file, upload, and see success/failure. Calls ST08's endpoint. Gated by a `VITE_CURATOR_MODE` `env.ts` flag, dead-code-eliminated in prod builds.

### EP42-ST10: Retire the `curate-audio` CLI  *(Done — EP42-DS02)*

**Scope**: `packages/srs-curation` — removed `curate-audio.ts` and its test now that ST08/ST09 cover the same job, so there is exactly one path to pair an audio file with a deck. EP42-DS01's ST03 reference + the ST06 local-loop docs updated to note the supersession is realised.

> **Phase 4 (marker-authoring tool) moved to [EP43](EP43-audio-playback-and-marking.md).** The former EP42-ST11/ST12/ST13 are now EP43-ST04 (marker route), EP43-ST01/ST04 (shared player + speed control, built with learner playback), and EP43-ST05 (marker-map ingest). EP42 ends at Phase 3 (DS02).

### EP42-ST13: Marker-map ingest — `apply-markers` seed step

**Scope**: `apps/cli-demo-db` — a CLI (`apply-markers.ts`) that reads the tool's exported JSON marker map and writes each sentence's `audioStart`/`audioEnd` into `decks.doc.sentences[]` **in place, matched by `sentenceId`** (does not re-import — re-import regenerates ids and would orphan the map). Idempotent; fails loudly on an unknown deck; unknown map keys skipped-with-warning. This is the "seed/import pipeline ingests it" half of the Marking/Authoring ADR Pass 1 — a DB write through *tooling*, not a mutating server endpoint. Answers the ADR's open question "JSON marker-map schema + where it lands for seed ingest." **Design spec: [EP42-DS03](../../changelogs/EP42--deck-audio-storage-and-retrieval/20260713T230512Z-EP42-DS03-marker-authoring-tool.md).**

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
- [~] A curator can select a deck and a local `.mp3` file on a `srs-demo` page and, without a terminal or a script, have the file land in MinIO and `decks.audio_key` set to match — verified the same way as the ST03 loop it replaces. *(Endpoint + client covered by tests; end-to-end browser+MinIO walkthrough still pending.)*
- [x] The upload endpoint is unreachable (404) when `GLL_CURATOR_MODE` is unset; the upload page itself is gated behind `env.curatorMode` (`VITE_CURATOR_MODE`) and DCE'd when unset.
- [x] The `curate-audio` CLI is removed once the upload page ships — no duplicate code path for pairing audio with a deck remains.

*(Learner playback and the marker-authoring tool ACs moved to [EP43](EP43-audio-playback-and-marking.md).)*

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
4. **EP42 is complete through DS02** (Impl-Complete). Learner playback + the marker tool moved to **[EP43](EP43-audio-playback-and-marking.md)** (DS01 / DS02) — the EP42-DS03 draft was re-homed there as EP43-DS02.
