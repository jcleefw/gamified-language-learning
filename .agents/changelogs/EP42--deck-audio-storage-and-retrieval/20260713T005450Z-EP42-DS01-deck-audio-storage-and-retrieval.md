# EP42-DS01: Deck Audio Storage & Retrieval (Standalone Audio Table) Specification

**Date**: 20260713T005450Z
**Redefined**: 20260714 — re-based on the standalone `audio` table; `decks.audio_key` + per-sentence marker fields removed; timing served as WebVTT.
**Status**: Draft (re-implementation)
**Epic**: [EP42 - Deck Audio Storage & Retrieval](../../plans/epics/EP42-deck-audio-storage-and-retrieval.md)

**Architecture**:
- [Audio Asset Model ADR](../../../product-documentation/architecture/20260714T123409Z-engineering-audio-asset-model.md) — Accepted. **The table this DS builds**: a standalone, versioned `audio` entity (polymorphic owner, `is_current`, nullable `vtt`), replacing the `decks.audio_key` column.
- [WebVTT Timing ADR](../../../product-documentation/architecture/20260714T123438Z-engineering-audio-timing-webvtt.md) — Accepted. Defines the `audio.vtt` column's contents (WebVTT, cue-ID = `sentenceId`, hash-stamp) and its two-tier storage. This DS provides the column and the *served* `vttUrl`; **authoring + consume are EP43**.
- [Playback Model ADR](../../../product-documentation/architecture/20260713T140218Z-engineering-audio-playback-model.md) — Accepted (consume mechanism amended to Option C by the WebVTT ADR). Fixes the runtime need; this DS emits the wire fields the UI reads.
- [Mixed-Platform Hosting ADR](../../../product-documentation/architecture/20260712T124801Z-infra-mixed-platform-hosting.md) — Accepted. Production audio = Cloudflare R2 (S3-compatible, public URL, browser→bucket). A local **MinIO** bucket stands in for R2 so cutover is env-only.

---

## 1. Feature Overview

The codebase has **zero audio support**. This DS builds the **whole storage-to-wire path** end to end against a local MinIO bucket standing in for R2 — but on the **standalone `audio` table**, not the rejected `decks.audio_key` column.

The design keeps DS01's original architectural prize — **resolution is pure URL composition, injected as a function; `@gll/db` reads no env, constructs no S3 client on the read path** — and re-bases it on the audio table:

- **Storage model (ST04)** — a standalone `audio` table. One row = one binary asset: content-addressed `key`, `format`, `size_bytes`, nullable `duration_seconds`, nullable `uploaded_by`, `created_at`, nullable **`vtt`** (the WebVTT projection; filled by EP43), polymorphic `subject_type` (**`deck`-only**) + `subject_id`, and `is_current`. Deck↔audio is 1:1-current, **versioned**: re-upload inserts a new row and demotes the prior (history retained; bytes deduped by content-address). **No `decks.audio_key` column; no `0012_deck_audio.sql`.**
- **Storage client (ST02)** — `apps/server/src/storage/audio-store.ts`: env-driven config read once, a pure `resolveAudioUrl(key)`, a `deriveVttKey(audioKey)` helper, and a lazy dev/curator-only `putObject`. The single seam that swaps MinIO→R2.
- **Wire (ST05)** — `audioUrl?` + `vttUrl?` on `AppDeckPayload`; the store resolves the deck's **current** `audio` row → `audioUrl = resolveAudioUrl(row.key)` and, when `row.vtt` is set, `vttUrl = resolveAudioUrl(deriveVttKey(row.key))`. **Per-sentence `audioStart`/`audioEnd` are gone from the wire and from `DeckSentence`** — timing is the served VTT track (EP43 consumes it via the browser's native `TextTrack`). `DeckMarker`/`DeckMarkerMap` are removed.

**Why VTT is served from the bucket by a derived key:** the VTT is bound to one binary (WebVTT ADR §3), so its bucket object is a sibling of the `.mp3` — `decks/{deckId}/{sha256}.vtt`. That lets `vttUrl` reuse the *same pure resolver* as `audioUrl` with no new env seam, preserving the `@gll/db`-reads-no-env boundary. The `audio.vtt` DB column is the live working/rehydrate copy + the "VTT exists?" signal (non-null ⟹ emit `vttUrl`); the bucket `.vtt` is the durable copy learners consume. VTT objects use a **revalidating** cache (`no-cache`) — unlike the immutable audio binary, a `.vtt` is overwritten in place on re-mark (same binary, improved timing).

**What is reused, not built:** the `@gll/db` store pattern; the seed/import path (`importCurriculum`); the injected-resolver seam (DS01's original design, retargeted from a column to a row); the MinIO container + `gll-audio` bucket + `.env.local.example` (ST01, done); `putObject` + cache-header logic (ST02, done — extended for the VTT content type + cache policy).

**Not in this DS:** VTT *authoring* (the marker tool) + the VTT *server-write* endpoint + learner *consume* — all **[EP43](../../plans/epics/EP43-audio-playback-and-marking.md)**; learner `<audio>` UI (EP43-DS01); real R2 provisioning; curator auth; audio-replacement approval flow; any `ReviewQuestionType`/engine change.

## 2. Core Requirements

| Requirement | Decision | Rationale |
| --- | --- | --- |
| Audio storage model | Standalone `audio` table (row per binary); **no `decks.audio_key`** | Asset-model ADR §1 — first-class, reusable, versioned entity |
| Ownership | `subject_type` + `subject_id`; allowed-set = **`deck` only** | ADR §2 — enum honest to what's wired; `sentence`/`word` reserved shape, not declared |
| Versioning | Re-upload inserts a new row, demotes prior `is_current`→0; history retained | ADR §3 — replace never clobbers; content-address dedups bytes |
| Deck→audio resolution | Current row = `subject_type='deck' AND subject_id=deckId AND is_current=1` | 1:1-current; prior rows are history |
| Timing column | Nullable `vtt` TEXT on `audio` (WebVTT text); filled by EP43 | ADR §5 — VTT hangs off the binary; presence ⟺ segmentable |
| Key → URL resolution | **Pure string compose** `${GLL_AUDIO_PUBLIC_URL}/${key}`; no SDK/network on read | Public-read bucket; keeps read path cheap + startup crash-proof |
| VTT URL | `vttUrl = resolveAudioUrl(deriveVttKey(row.key))` when `row.vtt != null`; else absent | Sibling bucket object; reuses the pure resolver — no new env seam |
| `deriveVttKey` | `key.replace(/\.(mp3\|wav)$/, '.vtt')` → `decks/{id}/{sha256}.vtt` | One VTT per binary (WebVTT ADR §3); co-located, self-describing |
| Resolution boundary | Injected `resolveAudioUrl` fn into `SqliteContentStore`; **`@gll/db` reads no env** | Config is server-owned policy; library must not depend on `apps/server` |
| Per-sentence timing | **Removed** from `AppLinePayload` and `DeckSentence` | Timing is the VTT track (WebVTT ADR §6); numbers no longer on the wire |
| `DeckMarker`/`DeckMarkerMap` | **Removed** from `@gll/api-contract` | Bespoke-JSON hand-off obsolete under VTT server-write (EP43-DS02) |
| Missing current audio row | `audioUrl`/`vttUrl` absent from the payload | Silent degrade (playback ADR §6); no error |
| Audio cache policy | `putObject` sets `Cache-Control: public, max-age=31536000, immutable` on binaries | Content-addressed keys never overwritten in place (playback ADR §7) |
| VTT cache policy | `putObject` sets `Cache-Control: no-cache` for `text/vtt` objects | `.vtt` at a stable derived key IS overwritten on re-mark; must revalidate |
| R2 cutover | Change endpoint + creds + public URL env only; no provider branch | MinIO + R2 both S3-compatible + public-URL |

## 3. Data Structures

```typescript
// ── ST04: schema (packages/db/src/schema.ts) ─────────────────────────────────
// decks: DROP audio_key. Add the standalone audio table.
export const audio = sqliteTable('audio', {
  id: text('id').primaryKey(),
  subject_type: text('subject_type').notNull(),      // 'deck' only (enum honest to wiring)
  subject_id: text('subject_id').notNull(),          // e.g. the deck id
  key: text('key').notNull(),                        // content-addressed bucket key: decks/{id}/{sha256}.{ext}
  format: text('format').notNull(),                  // 'mp3' | 'wav'
  size_bytes: integer('size_bytes').notNull(),
  duration_seconds: integer('duration_seconds'),     // nullable
  vtt: text('vtt'),                                  // nullable WebVTT projection (EP43 fills); non-null ⟺ segmentable
  uploaded_by: text('uploaded_by'),                  // nullable (curator/admin id; pre-auth: null)
  is_current: integer('is_current', { mode: 'boolean' }).notNull().default(true),
  created_at: text('created_at').notNull(),
});
// index on (subject_type, subject_id, is_current) for the current-row lookup.

// ── ST04: DeckSentence — REMOVE audioStart/audioEnd (timing is the VTT track) ─
export const DeckSentenceSchema = z.object({
  // sentenceId/speaker/native/english/romanization/position/components …
  // (no audioStart / audioEnd)
});

// ── ST05: wire (packages/api-contract/src/content.ts) ────────────────────────
export interface AppLinePayload {
  // sentenceId/speaker/native/romanization/english/wordIds …
  // (no audioStart / audioEnd)
}
export interface AppDeckPayload {
  // id/topic/difficulty/register/words/lines …
  audioUrl?: string; // absent ⟺ no current audio row OR public base unset
  vttUrl?: string;   // absent ⟺ current row has no vtt OR public base unset
}
// REMOVE DeckMarkerSchema / DeckMarkerMapSchema entirely.

// ── ST02: storage client (apps/server/src/storage/audio-store.ts) ────────────
export function makeResolveAudioUrl(cfg): (key?: string|null) => string|undefined;
/** decks/{id}/{sha}.mp3 → decks/{id}/{sha}.vtt (one VTT per binary). */
export function deriveVttKey(audioKey: string): string;
export async function putObject(cfg, key, body, contentType?): Promise<void>;
//   contentType 'text/vtt' ⟹ Cache-Control: no-cache; else immutable.

// ── ST05: store resolution (packages/db/src/sqlite-content-store.ts) ─────────
// assembleDeck(deck):
//   const row = currentAudioRow(deck.id);           // is_current=1, subject deck
//   const audioUrl = row ? resolveAudioUrl(row.key) : undefined;
//   const vttUrl   = row?.vtt != null ? resolveAudioUrl(deriveVttKey(row.key)) : undefined;
//   spread each onto payload only when defined.
```

## 4. User Workflows

```
# Read path (server, every GET /api/decks) — pure, no network
route → new SqliteContentStore(getDb(), makeResolveAudioUrl(cfg))
      → assembleDeck(deck)
          row      = current audio row for deck.id (is_current=1) | none
          audioUrl = row ? resolveAudioUrl(row.key)               : —   (omitted if none)
          vttUrl   = row?.vtt != null ? resolveAudioUrl(deriveVttKey(row.key)) : —
      → AppDeckPayload { …, audioUrl?, vttUrl? }   // no per-line timing

# Degrade paths (no error, no crash)
no current audio row           → audioUrl/vttUrl omitted
current row, vtt IS NULL       → audioUrl present, vttUrl omitted (whole-file play only)
GLL_AUDIO_PUBLIC_URL unset     → both omitted

# Upload loop (curator, EP42-DS02) — inserts an audio row, not a column write
upload <deckId> <file>
  1. content-address key = decks/{deckId}/{sha256}.{ext}; putObject(binary, immutable)
  2. demote prior current row (is_current=0); INSERT audio row (is_current=1, vtt=NULL)
  (VTT authored later via EP43-DS02's marker tool → server-write fills audio.vtt + bucket .vtt)
```

## 5. Stories

> ST01 (MinIO + bucket, done) and ST02 (storage client, done) carry over; ST02 gains `deriveVttKey` + the `text/vtt` cache branch. ST03 (curator CLI) remains superseded/removed by EP42-DS02. The former ST13 marker-map ingest is **dropped** (VTT server-write replaces it — EP43-DS02).

### EP42-ST04: Schema — standalone `audio` table + new migration

**Scope**: `@gll/db` + `@gll/api-contract` — add the `audio` table, remove `decks.audio_key`, delete `0012_deck_audio.sql`, add a fresh creating-migration, remove per-sentence marker fields + marker-map schemas.
**Read List**: `packages/db/src/schema.ts`, `packages/db/drizzle/migrations/meta/_journal.json`, an existing hand-written migration for style, `packages/api-contract/src/content.ts`
**Tasks**:

- [ ] Add the `audio` table to `schema.ts` (fields above) + a `(subject_type, subject_id, is_current)` index; export it from `packages/db/src/index.ts`.
- [ ] Remove `audio_key` from `decks`.
- [ ] Delete `packages/db/drizzle/migrations/0012_deck_audio.sql`; add a new migration that `CREATE TABLE audio (…)` + the index (no `audio_key` artifact anywhere). Reconcile `meta/_journal.json` + snapshot.
- [ ] Remove `audioStart`/`audioEnd` from `DeckSentenceSchema`; remove `DeckMarkerSchema`/`DeckMarkerMapSchema` + their exported types.

**Acceptance Criteria**:

- [ ] `grep -r audio_key` and `grep -r DeckMarker` over `packages/` return nothing; no `0012_deck_audio.sql` exists.
- [ ] A fresh `initDb` creates the `audio` table; existing decks load unchanged (no audio rows ⟹ no audioUrl).
- [ ] `@gll/db` + `@gll/api-contract` typecheck; content-store tests updated + green.

### EP42-ST05: Wire — `audioUrl`/`vttUrl` from the current `audio` row

**Scope**: `@gll/api-contract` + `@gll/db` read path + `apps/server` route wiring.
**Read List**: `packages/api-contract/src/content.ts`, `packages/db/src/sqlite-content-store.ts`, `apps/server/src/routes/decks.ts`, `apps/server/src/storage/audio-store.ts`
**Tasks**:

- [ ] Add `audioUrl?`/`vttUrl?` to `AppDeckPayload` (per-line timing already removed in ST04).
- [ ] In `assembleDeck`: look up the current `audio` row for the deck; compute `audioUrl`/`vttUrl` via the injected resolver + `deriveVttKey`; spread only when defined.
- [ ] Add `deriveVttKey` to `audio-store.ts`; make `putObject` set `no-cache` for `text/vtt`, `immutable` otherwise.
- [ ] Route wiring (`decks.ts`) already builds the resolver — no change beyond the store's new lookup.

**Acceptance Criteria**:

- [ ] A deck with a current audio row (no VTT) returns `audioUrl`, no `vttUrl`; with a VTT set, returns both, and `vttUrl` fetches the bucket `.vtt`.
- [ ] A deck with no current audio row returns neither; unset `GLL_AUDIO_PUBLIC_URL` ⟹ neither; server serves `/api/decks` normally in all cases.
- [ ] No `audioStart`/`audioEnd` appear on any payload; existing `SqliteContentStore` call sites compile unchanged (no-op resolver default).

### EP42-ST06: Local audio-loop documentation

**Scope**: Docs — `docker compose up`, `GLL_AUDIO_*` env, the upload-a-binary → resolve → play loop (row-based; VTT authored in EP43); MinIO→R2 is env-only.

**Acceptance Criteria**:

- [ ] A reader goes from clean checkout to a deck returning a playable `audioUrl` using only documented commands.

## 6. Success Criteria

1. Audio is a standalone, versioned `audio` table; **no `decks.audio_key` column and no `0012` migration exist**; re-upload retains history via `is_current`.
2. `GET /api/decks` emits `audioUrl`/`vttUrl` from the current row when present, omits them silently when absent (including unset storage env). No per-line timing on the wire.
3. `vttUrl` is the bucket `.vtt` at the key derived from the audio key; the `audio.vtt` DB column is the live/rehydrate copy + presence signal.
4. Resolution stays pure string compose in a server-owned module; `@gll/db` reads no env; the read path constructs no S3 client.
5. Audio objects carry `immutable`; VTT objects carry `no-cache`.
6. MinIO→R2 is env-only (no provider branch); `pnpm -r typecheck` + suite pass with no `audio_key`/`DeckMarker` references.
