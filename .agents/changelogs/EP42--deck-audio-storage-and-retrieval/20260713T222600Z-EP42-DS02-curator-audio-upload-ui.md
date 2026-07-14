# EP42-DS02: Curator Audio-Upload UI Specification

**Date**: 20260713T222600Z
**Redefined**: 20260714 — upload writes a versioned `audio` row (insert + demote prior), not a `decks.audio_key` column.
**Status**: Draft (re-implementation)
**Epic**: [EP42 - Deck Audio Storage & Retrieval](../../plans/epics/EP42-deck-audio-storage-and-retrieval.md)

**Architecture**:
- [Audio Asset Model ADR](../../../product-documentation/architecture/20260714T123409Z-engineering-audio-asset-model.md) — Accepted. Upload is the write path that **inserts an `audio` row** (`is_current=1`) and demotes any prior current row — the versioning behaviour (ADR §3) instead of clobbering a single column.
- [Mixed-Platform Hosting ADR](../../../product-documentation/architecture/20260712T124801Z-infra-mixed-platform-hosting.md) — Accepted. Reuses DS01's `putObject` seam; MinIO→R2 stays env-only.

---

## 1. Feature Overview

DS01 built the storage-to-wire path on the `audio` table. This DS gives the curator a **browser page** (no terminal, no CLI) to pair a conversation binary with a deck. It reuses DS01's whole storage seam and the content-addressed key + magic-byte format check; the only change vs. the pre-redefinition DS02 is **the persistence step writes an `audio` row instead of `decks.audio_key`**.

Three thin layers:

- **Server endpoint (ST08)** — `POST /api/curation/decks/:deckId/audio`, multipart file in. Sniffs the format from magic bytes (MP3/WAV only — never the client filename), derives a content-addressed key `decks/{deckId}/{sha256}.{ext}`, `putObject`s the binary (immutable cache), then **demotes the deck's current `audio` row and inserts a new one** (`is_current=1`, `vtt=NULL`) in the same request. **Gated**: `404` unless `GLL_CURATOR_MODE`.
- **Upload page (ST09)** — an `srs-demo` screen gated by `VITE_CURATOR_MODE` (DCE'd in prod): pick a deck from the boot-time list, pick a local `.mp3`/`.wav`, upload, see success/failure. *(Done — unchanged; only the endpoint's persistence semantics moved.)*
- **CLI retirement (ST10)** — one pairing path (the page). *(Done.)*

**The critical boundary decision — the endpoint writes the *binary + an audio row*, nothing in `decks.doc` and no VTT.** Marker/VTT authoring is EP43-DS02's gated VTT server-write. Upload leaves `audio.vtt` NULL; the deck plays whole-file until a VTT is authored.

**What is reused, not built:** `putObject` + `loadAudioStorageConfig` + content-addressed key + magic-byte `detectAudioFormat` (DS01/existing endpoint); the `@gll/db` `getDb()` pattern; `srs-demo`'s `env.ts` gating; the boot-time decks list; the `ApiResponse<T>`/`ErrorCode` envelope.

**Not in this DS:** VTT authoring + VTT server-write ([EP43-DS02](../EP43--audio-playback-and-marking/20260713T232015Z-EP43-DS02-marker-authoring-tool.md)); Pass-2 `apps/curator`/auth; learner `<audio>` UI; audio-replacement approval flow.

## 2. Core Requirements

| Requirement | Decision | Rationale |
| --- | --- | --- |
| Upload transport | `POST /api/curation/decks/:deckId/audio`, multipart, field `audio` | Browser-native; Hono `parseBody()`, no new dep |
| Format detection | **Magic bytes** (`detectAudioFormat`) — MP3/WAV only; never the client filename | A renamed/misencoded upload must not reach the bucket and break playback |
| Key derivation | Server-owned, content-addressed `decks/{deckId}/{sha256}.{ext}` | Prevents arbitrary-path writes; identical bytes ⟹ same key (immutable-cache-safe); re-record ⟹ new key |
| Persistence | **Demote** current `audio` row (`is_current=0`) then **INSERT** new row (`subject_type='deck'`, `subject_id=deckId`, `key`, `format`, `size_bytes`, `is_current=1`, `vtt=NULL`, `created_at`, `uploaded_by=NULL`) — one transaction | Asset-model ADR §3 versioning; upload never clobbers prior audio/VTT |
| Ordering | `putObject` **before** the row write | A failed upload leaves the DB untouched (no half-paired deck) |
| Unknown `deckId` | `404 NOT_FOUND`, no `putObject` | Fail loudly, never orphan an object |
| Endpoint gate | `404` unless `isCuratorMode()` (`GLL_CURATOR_MODE` truthy) | Mutating endpoint invisible in default prod; `404` not `403` (don't advertise) |
| Incomplete storage env | `putObject` throws → `500 INTERNAL_ERROR` | Curator dev tool; clear error, not silent degrade |
| Missing/empty file, bad format | `400 BAD_REQUEST`, no upload | Distinct from 404 (deck) / 500 (storage) |
| Page gate | `env.curatorMode` (`VITE_CURATOR_MODE`); page + nav DCE'd in prod | Same pattern as `debugMode` |

## 3. Data Structures

```typescript
// ── ST08: route handler shape (apps/server/src/routes/curation.ts) ───────────
// router.post('/curation/decks/:deckId/audio', async (c) => {
//   if (!isCuratorMode()) return c.notFound();
//   const deck = getDb()…decks where id=deckId;  if (!deck) return 404;
//   const file = (await c.req.parseBody())['audio']; if (!(file instanceof File)) return 400;
//   const bytes = new Uint8Array(await file.arrayBuffer());
//   const format = detectAudioFormat(bytes); if (!format) return 400;   // 'mp3'|'wav' by magic bytes
//   const contentType = format === 'wav' ? 'audio/wav' : 'audio/mpeg';
//   const hash = sha256(bytes).slice(0,16);
//   const key  = `decks/${deckId}/${hash}.${format}`;
//   await putObject(cfg, key, bytes, contentType);          // immutable; may throw → 500
//   getDb().transaction((tx) => {
//     tx.update(audio).set({ is_current: false })
//       .where(and(eq(audio.subject_type,'deck'), eq(audio.subject_id, deckId), eq(audio.is_current, true))).run();
//     tx.insert(audio).values({ id: randomUUID(), subject_type:'deck', subject_id: deckId,
//       key, format, size_bytes: bytes.length, is_current: true, vtt: null,
//       uploaded_by: null, created_at: new Date().toISOString() }).run();
//   });
//   return c.json({ success: true, data: { audioKey: key } }, 201);
// });

// ── ST09: client (apps/srs-demo, useStore.ts) — unchanged ────────────────────
export async function uploadDeckAudio(deckId: string, file: File): Promise<string>;
// multipart POST; returns the server audioKey or throws the server error message.
```

## 4. User Workflows

```
# Curator upload (GLL_CURATOR_MODE + VITE_CURATOR_MODE set)
open srs-demo → "Curate Audio" (rendered only when env.curatorMode)
  → pick deck (boot-time list) → pick .mp3/.wav → Upload
      server: curator? → deck exists? → format ok? → putObject(immutable)
              → tx: demote current audio row, insert new (is_current=1, vtt=NULL)
      → 201 { audioKey } → "✓ paired: decks/{id}/{sha}.mp3"
  → re-upload SAME bytes ⟹ same key; new row demotes prior (history kept; byte-deduped)
  → re-upload DIFFERENT recording ⟹ new key + new current row; old row (+ any VTT) retained as history

# Gate / error paths
GLL_CURATOR_MODE unset  → 404 (route invisible)     VITE_CURATOR_MODE unset → page DCE'd
unknown deckId          → 404, no object written    missing/bad file → 400
storage env incomplete  → 500 (config error), no row written
```

## 5. Stories

### EP42-ST08: Server upload endpoint — audio file → MinIO + `audio` row  *(rewrite: row-write)*

**Scope**: `apps/server` — the existing gated multipart route, with the persistence step changed from `UPDATE decks SET audio_key` to the demote-then-insert `audio`-row transaction. Magic-byte detection, content-addressed key, gating, and `putObject` reuse are unchanged.
**Read List**: `apps/server/src/routes/curation.ts` (current handler), `packages/db/src/schema.ts` (`audio` table), `apps/server/src/storage/audio-store.ts`
**Tasks**:

- [ ] Replace the `decks.audio_key` update with a transaction: demote the deck's current `audio` row, insert the new current row (fields above).
- [ ] Keep magic-byte `detectAudioFormat`, content-addressed key, `isCuratorMode` gate, deck-exists 404, `putObject`-before-write ordering.

**Acceptance Criteria**:

- [ ] `GLL_CURATOR_MODE=true` + known deck + MP3/WAV ⟹ `201 { audioKey }`; a new `audio` row exists with `is_current=1`, and any prior current row is now `is_current=0`.
- [ ] Re-uploading identical bytes ⟹ same key, a new current row demoting the prior (history retained).
- [ ] `GLL_CURATOR_MODE` unset ⟹ `404`; unknown deck ⟹ `404` with no `putObject`; missing/bad-format file ⟹ `400`; `putObject` throw ⟹ `500`, no row written.

### EP42-ST09: `srs-demo` gated audio-upload page  *(Done — carried over)*

**Scope**: `apps/srs-demo` — `env.curatorMode` flag, `uploadDeckAudio` client fn, `CurateAudio.vue` screen + gated nav. Unchanged by the redefinition (the endpoint's response contract is the same `{ audioKey }`).

**Acceptance Criteria**:

- [~] With `VITE_CURATOR_MODE=true`, a curator picks a deck + local audio and sees it paired (a subsequent `GET /api/decks` returns `audioUrl`). *(Pending MinIO-up browser walkthrough; endpoint covered by `curation.test.ts`, client by `uploadDeckAudio.test.ts`.)*
- [x] A server error surfaces its message on the page; no silent failure.
- [x] `VITE_CURATOR_MODE` unset ⟹ page + button DCE'd.

### EP42-ST10: Retire the `curate-audio` CLI  *(Done — carried over)*

**Scope**: One pairing path (the page); `curate-audio.ts` + test removed; local-loop docs point at the page.

## 6. Success Criteria

1. A curator pairs audio with a deck entirely in the browser — pick deck + file, upload, confirm — no terminal.
2. Upload **inserts a versioned `audio` row** (demote-then-insert), never clobbers prior audio/VTT; binary is content-addressed + magic-byte-validated.
3. The endpoint returns `404` unless `GLL_CURATOR_MODE`; the page is DCE'd when `VITE_CURATOR_MODE` unset.
4. Unknown deck ⟹ `404` no orphan; bad file ⟹ `400`; storage misconfig ⟹ `500` — none writes a partial row.
5. MinIO→R2 stays env-only; `pnpm -r typecheck` + suite pass.
