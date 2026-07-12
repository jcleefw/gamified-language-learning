# EP42-DS01: Deck Audio Storage & Retrieval (MinIO-backed) Specification

**Date**: 20260713T005450Z
**Status**: Draft
**Epic**: [EP42 - Deck Audio Storage & Retrieval](../../plans/epics/EP42-deck-audio-storage-and-retrieval.md)

**Architecture**:
- [Conversation Audio — Playback Model & Data Contract](../../../product-documentation/architecture/20260713T140218Z-engineering-audio-playback-model.md) — Accepted. Fixes the full data path this DS implements: `decks.audio_key` → per-sentence `audioStart`/`audioEnd` → server resolves key to URL on read → `AppDeckPayload.audioUrl` / `AppLinePayload.audioStart`/`audioEnd` on the wire. This DS builds that path; it does not re-decide the contract.
- [Conversation Audio — Marking (Authoring) Architecture](../../../product-documentation/architecture/20260713T140219Z-engineering-audio-marking-authoring.md) — Accepted. Pass 1 keeps marker persistence inside the **seed/import** pipeline (no mutating server endpoints). The ST03 curator script is the local, script-shaped stand-in for Pass 2's upload endpoint; the bucket holds only the binary, marker/`audio_key` data stays in the DB.
- [Infrastructure Revision — Mixed-Platform Hosting](../../../product-documentation/architecture/20260712T124801Z-infra-mixed-platform-hosting.md) — Accepted. Production audio = Cloudflare R2 (S3-compatible, public URL, browser→bucket). This DS stands a local **MinIO** bucket in for R2 so that production cutover is an env change, never a code branch.

---

## 1. Feature Overview

The codebase has **zero audio support**: no `audio_key` column on `decks`, no marker fields on `DeckSentence`, no `audioUrl` on the wire, and no storage backend. This DS builds the **whole storage-to-wire path** end to end against a local MinIO bucket that stands in for R2.

The design turns on one boundary decision: **resolution is pure URL composition, injected as a function.** Because the bucket is public-read (browser→bucket, per the hosting ADR), turning a stored `audio_key` into a playable URL is nothing more than `${publicBase}/${key}` — no network call, no S3 client, no credentials on the read path. That lets us honour two constraints at once:

- **`@gll/db` stays env-free.** The audio config (endpoint, bucket, public base, creds) is server-owned policy, exactly like the difficulty-preset map in [EP41-DS01](../EP41--config-preference-tier/20260711T011809Z-EP41-DS01-identity-and-preference-storage.md). It must not leak into the `@gll/db` library. So `SqliteContentStore.assembleDeck` does **not** read env — it takes an injected `resolveAudioUrl(key) → string | undefined` and calls it. The server constructs the store with a real resolver; every other caller (tests, seed, CLI) omits it and gets the no-op default → no `audioUrl`, no behaviour change.
- **Startup never touches the SDK or credentials.** The `@aws-sdk/client-s3` client is constructed **lazily inside `putObject`** (the dev/curator write helper) only. The read path — the only thing the running server does — is string concatenation, so missing/unset storage env cannot crash startup; it just yields no `audioUrl`.

Four independent layers:

- **Schema (ST04)** — additive `decks.audio_key TEXT` (nullable) via migration `0012`; additive optional `audioStart`/`audioEnd` on `DeckSentenceSchema` (they live inside the `doc` JSON blob → no column, no migration). No existing row is touched.
- **Storage client (ST02)** — `apps/server/src/storage/audio-store.ts`: env-driven config read once, a pure `resolveAudioUrl(key)`, and a lazy dev-only `putObject`. This is the single seam that swaps MinIO→R2.
- **Wire (ST05)** — `audioUrl?` on `AppDeckPayload`, `audioStart?`/`audioEnd?` on `AppLinePayload`; `assembleDeck` emits them via the injected resolver + passthrough from the doc; the `/api/decks` route injects the server resolver. Absence degrades silently.
- **Curator script (ST03)** — a CLI that uploads `decks/{deckId}/audio.mp3` **and** writes `decks.audio_key` + the sentence markers in one run, so object and row never drift.

**What is reused, not built:** the `@gll/db` store pattern; the seed/import path (`SqliteContentStore.importCurriculum`); the `DeckDoc` JSON-blob column (markers ride inside it, like every other per-sentence field); the MinIO container + `gll-audio` bucket + `.env.local.example` (ST01, already done).

**Not in this DS:** the marking-tool UI that *authors* markers (marking ADR's own epic); learner-facing `<audio>` playback UI; real R2 provisioning; curator auth / upload-first (Pass 2); any `ReviewQuestionType`/engine change (the engine stays audio-free).

## 2. Core Requirements

| Requirement | Decision | Rationale |
| --- | --- | --- |
| `decks.audio_key` storage | Nullable `TEXT` column on `decks` (migration `0012`); `NULL` ⟺ no audio | Additive, no migration of existing rows; matches playback ADR §1 |
| Per-sentence markers storage | Optional `audioStart`/`audioEnd` (seconds, float, `≥ 0`) added to `DeckSentenceSchema` — inside the `doc` JSON blob | Markers are per-sentence deck content; the blob already carries every other sentence field → no column, no migration |
| Key → URL resolution | **Pure string compose** `${GLL_AUDIO_PUBLIC_URL}/${key}`; no SDK, no network on read | Public-read bucket (browser→bucket per hosting ADR); keeps read path cheap and startup crash-proof |
| Resolution boundary | Injected `resolveAudioUrl` fn into `SqliteContentStore`; **`@gll/db` reads no env** | Config is server-owned policy (same boundary as EP41 preset map); library must not depend on `apps/server` |
| Default resolver | Optional constructor arg; omitted ⟹ no-op returning `undefined` | Backward-compatible with all 9 existing `new SqliteContentStore(...)` sites; tests/seed/CLI emit no `audioUrl` unchanged |
| S3 client lifecycle | `@aws-sdk/client-s3` constructed **lazily inside `putObject`** only | Startup and the read path never touch the SDK or credentials → unset storage env cannot crash the server |
| Storage config source | Env: `GLL_AUDIO_ENDPOINT`, `GLL_AUDIO_BUCKET`, `GLL_AUDIO_ACCESS_KEY_ID`, `GLL_AUDIO_SECRET_ACCESS_KEY`, `GLL_AUDIO_PUBLIC_URL` | Already fixed by `.env.local.example` (ST01); MinIO→R2 is an env-only change |
| Missing `GLL_AUDIO_PUBLIC_URL` | `resolveAudioUrl` returns `undefined` for any key | Silent degrade (playback ADR §6); no `audioUrl`, no error |
| Key naming convention | `decks/{deckId}/audio.mp3` — one conversation file per deck | Deck owns a single audio file (playback ADR §1); deck-scoped prefix is R2-portable; answers hosting-ADR open question |
| Audio format | `mp3` | Broadest browser `<audio>` support; single format for the MVP (answers playback-ADR open question) |
| Missing markers on a sentence | `audioStart`/`audioEnd` simply absent from that `AppLinePayload` | No playable segment for that sentence (playback ADR §1); other sentences unaffected |
| R2 cutover | Change endpoint + creds + public URL env only; **no code path branches on provider** | Verified by code review (epic AC); MinIO and R2 are both S3-compatible + public-URL |
| Cache policy | `putObject` sets `Cache-Control: public, max-age=31536000, immutable` on every write | Objects are never overwritten in place (playback ADR §7); safe to cache forever — cuts repeat-play egress on both MinIO and R2/its CDN |

## 3. Data Structures

```typescript
// ── ST04: schema (packages/db/src/schema.ts) ─────────────────────────────────
// Additive nullable column. NULL ⟺ deck has no audio. Migration 0012.
export const decks = sqliteTable('decks', {
  // ...existing id/name/language/difficulty/register/created_at/doc...
  audio_key: text('audio_key'), // nullable; e.g. 'decks/<deckId>/audio.mp3'
});

// ── ST04: markers on the sentence (packages/api-contract/src/content.ts) ─────
// Optional, seconds-float, non-negative. Ride inside DeckDoc.doc — no column.
export const DeckSentenceSchema = z.object({
  // ...existing sentenceId/speaker/native/english/romanization/position/components...
  audioStart: z.number().nonnegative().optional(), // seconds into the deck file
  audioEnd:   z.number().nonnegative().optional(),  // seconds; play stops here
});

// ── ST05: wire additions (packages/api-contract/src/content.ts) ──────────────
export interface AppLinePayload {
  // ...existing sentenceId/speaker/native/romanization/english/wordIds...
  audioStart?: number; // absent ⟺ sentence has no marker
  audioEnd?: number;
}
export interface AppDeckPayload {
  // ...existing id/topic/difficulty/register/words/lines...
  audioUrl?: string; // absent ⟺ decks.audio_key IS NULL or public base unset
}

// ── ST02: storage client (apps/server/src/storage/audio-store.ts) ────────────
export interface AudioStorageConfig {
  endpoint?: string;        // GLL_AUDIO_ENDPOINT (S3 API; used only by putObject)
  bucket?: string;          // GLL_AUDIO_BUCKET
  accessKeyId?: string;     // GLL_AUDIO_ACCESS_KEY_ID  (putObject only)
  secretAccessKey?: string; // GLL_AUDIO_SECRET_ACCESS_KEY (putObject only)
  publicUrl?: string;       // GLL_AUDIO_PUBLIC_URL (browser-reachable base)
}

/** Read env once. All fields optional — absence is tolerated, not fatal. */
export function loadAudioStorageConfig(env = process.env): AudioStorageConfig;

/** Pure compose. undefined when key is null/empty OR publicUrl is unset.
 *  No network, no SDK, no credentials — safe on every read. */
export function makeResolveAudioUrl(
  cfg: AudioStorageConfig,
): (key: string | null | undefined) => string | undefined;
// => key => cfg.publicUrl && key ? `${trimSlash(cfg.publicUrl)}/${key}` : undefined

/** Dev/curator-only upload. Constructs the S3 client LAZILY here — the only
 *  place @aws-sdk/client-s3 and credentials are touched. Throws if config
 *  incomplete (called only by the ST03 script, never on the request path).
 *  Always writes Cache-Control: public, max-age=31536000, immutable — keys
 *  are never overwritten in place (playback ADR §7), so objects are safe
 *  to cache forever once written. */
export async function putObject(
  cfg: AudioStorageConfig,
  key: string,
  body: Uint8Array | Buffer,
  contentType?: string, // default 'audio/mpeg'
): Promise<void>;

// ── ST05: injected resolver seam (packages/db/src/sqlite-content-store.ts) ───
// @gll/db defines the TYPE only; it never reads env. The server injects a fn.
export type ResolveAudioUrl = (key: string | null | undefined) => string | undefined;

export class SqliteContentStore implements IContentStore {
  constructor(
    private readonly db: DbClient,
    private readonly resolveAudioUrl: ResolveAudioUrl = () => undefined, // no-op default
  ) {}
  // assembleDeck: audioUrl = this.resolveAudioUrl(deck.audio_key);
  //   spread onto payload only when defined; audioStart/audioEnd passed through
  //   from each sentence only when defined (…(x !== undefined && { x }))
}
```

## 4. User Workflows

```
# Read path (server, every GET /api/decks) — pure, no network
route → new SqliteContentStore(getDb(), makeResolveAudioUrl(cfg))
      → assembleDeck(deck)
          audioUrl   = resolveAudioUrl(deck.audio_key)   // undefined ⟹ field omitted
          per line:  audioStart/audioEnd from sentence   // undefined ⟹ omitted
      → AppDeckPayload { …, audioUrl?, lines:[{ …, audioStart?, audioEnd? }] }

# Degrade paths (no error, no crash)
deck.audio_key = NULL          → resolveAudioUrl(null) = undefined  → no audioUrl
GLL_AUDIO_PUBLIC_URL unset     → resolveAudioUrl(key)  = undefined  → no audioUrl
sentence has no markers        → audioStart/audioEnd omitted        → no segment

# Curator loop (ST03, local, one invocation keeps object+row in sync)
curate <deckId> <audio.mp3>
  1. putObject(cfg, 'decks/<deckId>/audio.mp3', bytes, 'audio/mpeg')   → bucket
  2. UPDATE decks SET audio_key='decks/<deckId>/audio.mp3' WHERE id=<deckId>
  → re-run against same deck ⟹ same key + same object (idempotent, no drift)
  (marker-map ingest → decks.doc.sentences[].audioStart/audioEnd is the
   marking epic's Pass-1 seed/import concern, not owned here)
```

## 5. Stories

### Phase 1: Storage backend (EP42-PH01)

### EP42-ST01: MinIO Docker Compose service + bucket bootstrap  *(Done)*

**Scope**: Infra — `docker-compose.yml` MinIO + healthcheck-gated `mc` init creating a public-read `gll-audio` bucket; `.env.local.example` with the `GLL_AUDIO_*` contract.
**Status**: Complete — container healthy, bucket auto-created + public-read, S3 + console endpoints reachable. No further work in this DS.

### EP42-ST02: Server storage config + S3-compatible client wrapper

**Scope**: `apps/server` — a single storage module; no DB, no routes, no wire changes.
**Read List**: `apps/server/.env.local.example`, `apps/server/src/config/learning.ts` (config-module style), `apps/server/package.json`
**Tasks**:

- [ ] Add `@aws-sdk/client-s3` to `apps/server` dependencies.
- [ ] Add `apps/server/src/storage/audio-store.ts`: `AudioStorageConfig`, `loadAudioStorageConfig(env)`, `makeResolveAudioUrl(cfg)`, `putObject(cfg, key, body, contentType?)`.
- [ ] `makeResolveAudioUrl` is pure string compose (trim a trailing `/` on the base); returns `undefined` when key is null/empty **or** `publicUrl` is unset. No SDK import at module top-level used on this path.
- [ ] Construct the `S3Client` **inside `putObject` only** (lazy); `putObject` uses `forcePathStyle: true` (MinIO) and throws a clear error if `endpoint`/`bucket`/creds are missing.
- [ ] `putObject` passes `CacheControl: 'public, max-age=31536000, immutable'` on every `PutObjectCommand`.

**Acceptance Criteria**:

- [ ] `makeResolveAudioUrl(cfg)('decks/d1/audio.mp3')` → `'<publicUrl>/decks/d1/audio.mp3'` (no double slash); returns `undefined` for `null`/`''` key and when `publicUrl` is unset.
- [ ] Importing/using `audio-store.ts` for resolution performs **no** network call and constructs **no** `S3Client`.
- [ ] `loadAudioStorageConfig({})` (empty env) returns an all-`undefined` config without throwing.
- [ ] An object written by `putObject` reports `Cache-Control: public, max-age=31536000, immutable` when fetched back from MinIO.

### EP42-ST03: Local curator script — paired audio upload + `audio_key` sync

**Scope**: Tooling — one CLI that syncs the bucket object with `decks.audio_key` per deck, so the binary and the DB reference never drift. Depends on ST02 (`putObject`) and ST04 (schema).
**Read List**: `apps/cli-demo-db/src/import-curriculum.ts` (CLI entrypoint + `getDb` pattern), `packages/db/src/sqlite-content-store.ts`, `apps/server/src/storage/audio-store.ts`

> **Boundary note.** This story owns only the **binary + `audio_key`** sync — the half that is genuinely EP42's storage concern. The **marker map schema** (`sentenceId → {start,end}`) and its ingestion into `decks.doc.sentences[].audioStart/audioEnd` are the **marking ADR's Pass-1 seed/import concern**, owned by that epic ([open question: "JSON marker-map schema + where it lands for seed ingest"](../../../product-documentation/architecture/20260713T140219Z-engineering-audio-marking-authoring.md)). This script optionally accepts a marker map and passes it through the existing import path if present, but does not define that schema. Keeping the two epics from co-owning the marker format is deliberate.

**Tasks**:

- [ ] Add a script (e.g. `apps/cli-demo-db/src/curate-audio.ts`) taking `<deckId> <audioFilePath>` (and an optional `<markersJsonPath>` deferred to the marking epic).
- [ ] Upload the file to `decks/{deckId}/audio.mp3` via `putObject`.
- [ ] Set `decks.audio_key = 'decks/{deckId}/audio.mp3'` on that deck in the same run.
- [ ] Idempotent: re-running with the same inputs yields the same key + object (no duplicate object, no drift).

**Acceptance Criteria**:

- [ ] After one run: `GET /api/decks` for that deck returns an `audioUrl` that fetches the uploaded bytes from MinIO.
- [ ] Re-running against the same deck leaves object + `audio_key` byte-identical (verified by comparing key before/after).
- [ ] Running against an unknown `deckId` fails loudly (no silent no-op) rather than orphaning an uploaded object.

### Phase 2: Deck-audio data path (EP42-PH02)

### EP42-ST04: Schema — `decks.audio_key` + `DeckSentence` marker fields

**Scope**: `@gll/db` + `@gll/api-contract` — additive column + additive optional zod fields. No row migration.
**Read List**: `packages/db/src/schema.ts`, `packages/db/src/init-db.ts`, `packages/db/drizzle/migrations/0010_user_config.sql` (migration style), `packages/api-contract/src/content.ts`
**Tasks**:

- [ ] Add `audio_key: text('audio_key')` (nullable) to the `decks` table in `schema.ts`.
- [ ] Hand-write `packages/db/drizzle/migrations/0012_deck_audio.sql`: `ALTER TABLE decks ADD COLUMN audio_key TEXT;` with a header comment (EP42-DS01; nullable; NULL = no audio).
- [ ] Add optional `audioStart`/`audioEnd` (`z.number().nonnegative().optional()`) to `DeckSentenceSchema`.
- [ ] Confirm `initDb` picks up `0012` (sorted, id-tracked) — no code change expected, just verify.

**Acceptance Criteria**:

- [ ] Existing decks load unchanged with `audio_key = NULL` and no markers; no migration of existing rows.
- [ ] `DeckDocSchema.parse` accepts a sentence with `audioStart`/`audioEnd` and one without (round-trips through the `doc` blob).
- [ ] `@gll/db` typecheck + existing content-store tests pass unchanged.

### EP42-ST05: Wire types — `AppDeckPayload.audioUrl` / `AppLinePayload.audioStart`/`audioEnd`

**Scope**: `@gll/api-contract` + `@gll/db` read path + `apps/server` route wiring. Depends on ST02 + ST04.
**Read List**: `packages/api-contract/src/content.ts`, `packages/db/src/sqlite-content-store.ts`, `apps/server/src/routes/decks.ts`
**Tasks**:

- [ ] Add `audioUrl?: string` to `AppDeckPayload`; `audioStart?`/`audioEnd?` to `AppLinePayload`.
- [ ] Add the `ResolveAudioUrl` type + optional `resolveAudioUrl` constructor arg (no-op default) to `SqliteContentStore`.
- [ ] In `assembleDeck`: compute `audioUrl = this.resolveAudioUrl(deck.audio_key)` and spread onto the payload only when defined; in the `lines` map, spread `audioStart`/`audioEnd` from each sentence only when defined (mirror the existing `difficulty`/`register` conditional-spread pattern).
- [ ] In `apps/server/src/routes/decks.ts`, build the resolver once (`makeResolveAudioUrl(loadAudioStorageConfig())`) and pass it into `new SqliteContentStore(getDb(), resolver)`.

**Acceptance Criteria**:

- [ ] A deck with `audio_key` set + markers on sentences returns `audioUrl`, `audioStart`, `audioEnd` that resolve to a file that plays in a browser against local MinIO.
- [ ] A deck with `audio_key = NULL` (or a sentence with no markers) returns payloads with those fields **absent** — no error, no crash.
- [ ] Unset `GLL_AUDIO_PUBLIC_URL` ⟹ no `audioUrl`, server starts and serves `/api/decks` normally.
- [ ] The 9 existing `new SqliteContentStore(...)` sites (tests/seed/CLI) compile unchanged and emit no `audioUrl`.

### EP42-ST06: Local audio-loop documentation

**Scope**: Docs — the end-to-end local loop.
**Read List**: `docker-compose.yml`, `apps/server/.env.local.example`
**Tasks**:

- [ ] Document `docker compose up -d` (MinIO + bucket), the required `GLL_AUDIO_*` env vars, the ST03 curate command, and the seed-a-key → `GET /api/decks` → play loop.
- [ ] Note the MinIO→R2 cutover is env-only (endpoint/creds/public URL), no code change.

**Acceptance Criteria**:

- [ ] A reader can go from a clean checkout to a deck that returns a playable `audioUrl` using only the documented commands.

## 6. Success Criteria

1. `decks.audio_key` and `DeckSentence.audioStart`/`audioEnd` exist additively; existing rows load with no migration.
2. `GET /api/decks` emits `audioUrl`/`audioStart`/`audioEnd` when present and omits them (no error) when absent — including when storage env is unset.
3. Key→URL resolution is pure string compose in a server-owned module; `@gll/db` reads no env and the read path constructs no S3 client.
4. The curator script keeps bucket object and DB row in sync in one idempotent run.
5. MinIO→R2 is an env-only change — no code path branches on provider (verified by code review).
6. All existing `SqliteContentStore` call sites are backward-compatible; no type errors; existing tests pass unchanged.
7. Every uploaded object carries `Cache-Control: public, max-age=31536000, immutable`.
