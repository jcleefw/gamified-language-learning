# EP42 - Deck Audio Storage & Retrieval (MinIO-backed)

**Created**: 20260713T003245Z

**Status**: Draft

<!-- Status: Draft | Accepted | In Progress | Impl-Complete | BDD Pending | Completed | Shelved | Withdrawn -->

**Type**: Epic Plan
**Depends on**: N/A (audio ADRs authored; no code dependency on another open epic)
**Parallel with**: EP-audio-marker-tool (Pass 1, `srs-demo` gated route — authors the `audioStart`/`audioEnd` values this epic's schema stores); EP-audio-playback-ui (consumes the `audioUrl`/`audioStart`/`audioEnd` wire fields this epic emits, to actually render `<audio>` controls in `QuizCard.vue`/`DeckOverview.vue`)
**Predecessor**: N/A

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
- Wire additions: `AppDeckPayload.audioUrl?`, `AppLinePayload.audioStart?`/`audioEnd?`, wired into the existing `GET /api/decks` read path — absent key ⟹ absent `audioUrl`, no error.
- A local **curator script** pairing audio + content: uploads the audio file to the bucket *and* writes `decks.audio_key` + sentence markers through the existing seed/import path in one invocation, so the bucket object and the DB row never drift apart. This is the local stand-in for what Pass 2's server-write endpoint will eventually do over HTTP.
- Env-var contract designed so switching to R2 in production is a config change only (endpoint + credentials), never a code branch.

**Out of scope**:

- The marking tool UI (Pass 1 gated route) that *authors* `audioStart`/`audioEnd` values — that's the marking ADR's own epic; this epic only stores/serves what it produces.
- Learner-facing playback UI — rendering `<audio>` controls, segment seek/stop, playback-rate control in `QuizCard.vue` / `DeckOverview.vue` — a separate playback-UI epic consumes the wire fields this epic emits.
- Actual R2 account/bucket provisioning (production cutover — separate infra task).
- Curator auth / upload-first flow (Pass 2, `apps/curator`) — explicitly deferred by the marking ADR.
- `ReviewQuestionType` / engine changes — the playback ADR keeps `srs-engine-v2` audio-free; not touched here.

---

## Stories

### Phase 1: Storage backend (EP42-PH01)

### EP42-ST01: MinIO Docker Compose service + bucket bootstrap

**Scope**: Infra — `docker-compose.yml` running MinIO with a healthcheck-gated `mc` init step that creates and public-reads the `gll-audio` bucket. *(Done — verified: container healthy, bucket created, console + S3 endpoint reachable.)*

### EP42-ST02: Server storage config + S3-compatible client wrapper

**Scope**: Server — env-driven config (`GLL_AUDIO_ENDPOINT`, `GLL_AUDIO_BUCKET`, `GLL_AUDIO_ACCESS_KEY_ID`/`SECRET`, `GLL_AUDIO_PUBLIC_URL`) plus a thin client (AWS SDK v3, S3-compatible) exposing `resolveAudioUrl(key)` and a dev-only `putObject` helper.

### EP42-ST03: Local curator script — paired audio upload + marker seed

**Scope**: Tooling — a CLI/script that, per deck, (1) uploads the audio file to `decks/{deckId}/audio.mp3` in the bucket and (2) writes `decks.audio_key` plus the sentence `audioStart`/`audioEnd` markers through the existing seed/import path, as one operation. The bucket holds only the binary; deck content stays in the DB, matching the marking ADR's seed/import routing — this script is the local, script-shaped equivalent of Pass 2's curator upload endpoint, not a second source of truth in MinIO.

### Phase 2: Deck-audio data path (EP42-PH02)

### EP42-ST04: Schema — `decks.audio_key` + `DeckSentence` marker fields

**Scope**: DB — additive Drizzle column on `decks`, additive optional fields on `DeckDoc.sentences[]`; no migration of existing rows.

### EP42-ST05: Wire types — `AppDeckPayload.audioUrl` / `AppLinePayload.audioStart`/`audioEnd`

**Scope**: API contract + server read path — `GET /api/decks` resolves `audio_key` via ST02's client and emits the wire fields; absence degrades silently (no `audioUrl`, no error).

### EP42-ST06: Local audio-loop documentation

**Scope**: Docs — README/setup notes covering `docker compose up`, required env vars, and the seed-a-key → resolve → play loop end to end.

---

## Overall Acceptance Criteria

- [ ] `docker compose up -d` brings MinIO up healthy with `gll-audio` auto-created and public-read, with no manual console steps.
- [ ] `decks.audio_key` and `DeckSentence.audioStart`/`audioEnd` exist in the schema/DeckDoc with no migration required for existing rows.
- [ ] Given a deck with `audio_key` set and markers on its sentences, `GET /api/decks` returns `audioUrl`, `audioStart`, `audioEnd` that resolve to a file that plays in a browser against the local MinIO bucket.
- [ ] A deck with no `audio_key` (or a sentence with no markers) returns payloads with those fields simply absent — no error, no crash.
- [ ] A documented command uploads a local audio file into the bucket **and** persists `decks.audio_key` + markers to the DB in the same run — the two never drift, checked by re-running against the same deck and confirming both sides match.
- [ ] Missing/unset storage env vars do not crash server startup — resolution just returns no `audioUrl`.
- [ ] Swapping to R2 in production requires only env-var changes (endpoint, credentials, public URL) — verified by code review, no code path branches on provider.

---

## Dependencies

- [Playback Model ADR](../../product-documentation/architecture/20260713T140218Z-engineering-audio-playback-model.md)
- [Marking/Authoring ADR](../../product-documentation/architecture/20260713T140219Z-engineering-audio-marking-authoring.md)
- [Mixed-Platform Hosting ADR](../../product-documentation/architecture/20260712T124801Z-infra-mixed-platform-hosting.md)

## Next Steps

1. Review and approve plan
2. Create Design Spec (DS) for ST02/ST04/ST05 (client wrapper shape, key naming convention, migration)
3. Begin implementation
