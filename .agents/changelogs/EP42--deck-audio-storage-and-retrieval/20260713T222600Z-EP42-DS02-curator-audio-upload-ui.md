# EP42-DS02: Curator Audio-Upload UI Specification

**Date**: 20260713T222600Z
**Status**: Impl-Complete
**Epic**: [EP42 - Deck Audio Storage & Retrieval](../../plans/epics/EP42-deck-audio-storage-and-retrieval.md)

**Architecture**:
- [Conversation Audio — Marking (Authoring) Architecture](../../../product-documentation/architecture/20260713T140219Z-engineering-audio-marking-authoring.md) — Accepted. Pass 1 keeps *marker* persistence inside the seed/import pipeline (no mutating server endpoints for markers), but flags that serving audio locally instead of through a bucket is a gap "that must be tracked so it is actually migrated." This DS closes the **audio-binary** half of that gap by moving the paired upload from a local CLI ([EP42-DS01](20260713T005450Z-EP42-DS01-deck-audio-storage-and-retrieval.md) ST03) onto a browser page + a gated server endpoint — the first mutating audio endpoint, deliberately scoped to the `audio_key`/binary pairing only, **not** marker writes.
- [Infrastructure Revision — Mixed-Platform Hosting](../../../product-documentation/architecture/20260712T124801Z-infra-mixed-platform-hosting.md) — Accepted. Production audio = Cloudflare R2 (S3-compatible, browser→bucket). The upload endpoint reuses DS01's `putObject` seam unchanged, so MinIO→R2 cutover stays an env-only change; this DS adds no new provider branch.

---

## 1. Feature Overview

DS01 built the full storage-to-wire path and shipped a **CLI** (`packages/srs-curation/curate-audio.ts`, ST03) as the local stand-in for "pair an audio file with a deck": upload the binary to `decks/{deckId}/audio.mp3` **and** write `decks.audio_key` in one run. The PO found the CLI's two-terminal / `source .env.local` / remember-the-deckId loop too many steps ([EP42-DS01 ST03 supersession note](20260713T005450Z-EP42-DS01-deck-audio-storage-and-retrieval.md)). This DS replaces that CLI with a **browser page** so a curator never leaves `srs-demo` or opens a terminal.

The design reuses DS01's whole storage seam and adds exactly one new capability: **the same `curateAudio` operation, driven by an HTTP multipart body instead of a local file path.** Three thin layers:

- **Server endpoint (ST08)** — `POST /api/curation/decks/:deckId/audio`, multipart file in, calls DS01's `putObject` + writes `decks.audio_key` in the same request. It is the exact server-side twin of `curateAudio(db, cfg, deckId, filePath)`, reading bytes from the request body rather than the filesystem. **Gated**: returns `404` unless `GLL_CURATOR_MODE` is set, so a default production deploy exposes no mutating audio route.
- **Upload page (ST09)** — an `srs-demo` screen, env-gated the same way as the existing debug affordances (`env.ts` flag, dead-code-eliminated in prod): pick a deck from the boot-time decks list, pick a local `.mp3`, upload, see success/failure. No new deck fetch — it reuses the decks already loaded in `App.vue`.
- **CLI retirement (ST10)** — once the page covers the job, delete `curate-audio.ts` + its test so there is exactly **one** path to pair audio with a deck; update DS01's ST03 references to note the supersession is now realised.

**The critical boundary decision — the endpoint is DS01's `curateAudio` over HTTP, minus the filesystem read.** The endpoint does not re-derive the key, the cache policy, the idempotency semantics, or the S3 client — all of that lives in `putObject`/the deterministic key already. The only genuinely new code is: (1) multipart body handling, (2) the deck-exists check returning a wire error instead of throwing to a CLI, (3) the `GLL_CURATOR_MODE` gate. Marker authoring stays entirely out — this endpoint writes `audio_key` and the binary, nothing in `decks.doc`.

**What is reused, not built:** `putObject` + `loadAudioStorageConfig` (DS01 ST02); the deterministic `decks/{deckId}/audio.mp3` key + idempotent overwrite semantics (DS01 ST03); the `@gll/db` `getDb()` + `schema.decks` update pattern; `srs-demo`'s `env.ts` gating pattern (like `debugMode`); the boot-time `/api/decks` list already in `App.vue`; the `ApiResponse<T>` wire-envelope + `ErrorCode` pattern (every existing route).

**Not in this DS:** marker-authoring UI + marker writes ([EP43-DS02](../EP43--audio-playback-and-marking/20260713T232015Z-EP43-DS02-marker-authoring-tool.md) / marking ADR Pass 1 — markers stay on the seed/import path); Pass 2's separate `apps/curator` app, upload-first-to-R2, or curator auth beyond the env gate; learner-facing `<audio>` playback UI; any schema/wire/engine change (DS01 already added `audio_key`; this DS changes no types).

## 2. Core Requirements

| Requirement | Decision | Rationale |
| --- | --- | --- |
| Upload transport | `POST /api/curation/decks/:deckId/audio`, `multipart/form-data`, single file field `audio` | Browser-native file POST; Hono `c.req.parseBody()` handles multipart with no new dep |
| Endpoint behaviour | Read bytes from the multipart file, derive extension from filename (`.mp3` → `audio.mp3`, `.m4a` → `audio.m4a`), then `putObject(cfg, 'decks/{deckId}/audio.{ext}', bytes, contentType)` → `UPDATE decks SET audio_key=…` in the same request | Server-side twin of DS01 `curateAudio`; object + row never drift, same as the CLI it replaces. Extension derived from uploaded filename (sanitised, only `.mp3`/`.m4a` allowed); server does not accept other formats. |
| Key derivation | Server-owned, deterministic `decks/{deckId}/audio.{ext}` where `{ext}` is derived from the uploaded filename (`.mp3` or `.m4a`) — never arbitrary client paths | Same security model as DS01: prevents client-supplied paths from breaking idempotency or writing arbitrary locations. Extension-based derivation lets both formats coexist under the same deck; re-uploading a different format replaces the old one. |
| Unknown `deckId` | `404` `ErrorCode.NOT_FOUND`, **no** `putObject` call | Mirror the CLI's "fail loudly, never orphan an uploaded object" (DS01 ST03 AC); check the row *before* uploading |
| Endpoint gate | Route returns `404` unless `GLL_CURATOR_MODE` is truthy (read via a small `isCuratorMode(env)` helper) | Epic AC: mutating endpoint unreachable in a default prod deploy without also flipping the flag; `404` (not `403`) so the route's existence isn't advertised |
| Incomplete storage env | `putObject` already throws → endpoint returns `500` `ErrorCode.INTERNAL_ERROR` with the message | Curator page is a dev tool; a clear error is correct, not silent degrade (unlike the crash-proof *read* path) |
| Missing/empty file field | `400` `ErrorCode.BAD_REQUEST`, no upload | Bad request, distinct from unknown deck (404) or storage failure (500) |
| Unsupported file extension | `400` `ErrorCode.BAD_REQUEST`, no upload | Only `.mp3` and `.m4a` are allowed; anything else is rejected (e.g. `.wav`, `.ogg`, `.flac`). No server-side format conversion. |
| Content type on write | `audio/mpeg` for `.mp3`, `audio/mp4` for `.m4a` — derived from filename extension, not client MIME type | Both formats widely browser-supported; server determines the type from the file extension, not the client's `Content-Type` header (which can lie). |
| Page gate | New `env.curatorMode` flag in `srs-demo/src/env.ts`; page + its nav affordance only render when set; DCE'd in prod builds | Same pattern as `env.debugMode`; keeps the mutating UI out of prod bundles entirely |
| Deck source on the page | Reuse the decks already fetched at boot in `App.vue`; no new fetch | Epic ST09: "pick a deck from the decks already fetched at boot" — avoids a second source of truth |
| Result feedback | Show per-upload success (with the resolved `audio_key`) or the server error message; no auto-navigation | Curator needs to confirm the pairing landed, same confirmation the CLI printed |
| CLI retirement scope | Delete `packages/srs-curation/src/curate-audio.ts` + `__tests__/curate-audio.test.ts` **only after** ST08/ST09 land; leave `putObject`/`audio-store.ts` untouched | Exactly one audio-pairing path (epic AC); `putObject` is now the endpoint's dependency, not dead |

## 3. Data Structures

```typescript
// ── ST08: request contract (multipart, no new @gll/api-contract type) ────────
// POST /api/curation/decks/:deckId/audio
//   Content-Type: multipart/form-data
//   field "audio": the .mp3 file (single)
// Success 201:  ApiResponse<{ audioKey: string }>  → { success: true, data: { audioKey } }
// Errors (existing ApiResponse envelope + ErrorCode):
//   404 NOT_FOUND     — GLL_CURATOR_MODE unset  OR  unknown deckId
//   400 BAD_REQUEST   — missing/empty "audio" field
//   500 INTERNAL_ERROR— putObject threw (incomplete storage config, bucket unreachable)

// ── ST08: curator-mode gate (apps/server/src/storage/audio-store.ts or a
//          sibling config module — read env once, same style as DS01) ─────────
/** True when the curator-only mutating surface is enabled. Default: off. */
export function isCuratorMode(env: NodeJS.ProcessEnv = process.env): boolean;
// => env.GLL_CURATOR_MODE === 'true' (or '1') — off/absent ⟹ false

// ── ST08: route handler shape (apps/server/src/routes/curation.ts) ───────────
// Derives file extension from the uploaded filename, validates it, maps to content type.
// router.post('/curation/decks/:deckId/audio', async (c) => {
//   if (!isCuratorMode()) return 404;
//   const deckId = c.req.param('deckId');
//   const deck = getDb()…decks where id=deckId;  if (!deck) return 404;
//   const body = await c.req.parseBody();          // { audio: File }
//   const file = body['audio'];  if (!(file instanceof File)) return 400;
//   const ext = file.name.toLowerCase().match(/\.(mp3|m4a)$/?.[1];
//   if (!ext) return 400;  // only .mp3 / .m4a
//   const contentType = ext === 'mp3' ? 'audio/mpeg' : 'audio/mp4';
//   const bytes = new Uint8Array(await file.arrayBuffer());
//   const cfg = loadAudioStorageConfig();
//   const key = `decks/${deckId}/audio.${ext}`;
//   await putObject(cfg, key, bytes, contentType);   // may throw → 500
//   getDb().update(decks).set({ audio_key: key }).where(id=deckId).run();
//   return c.json({ success: true, data: { audioKey: key } }, 201);
// });

// ── ST09: page env flag (apps/srs-demo/src/env.ts) ───────────────────────────
export const env = {
  // …existing testHooks / debugMode / cheatMode…
  curatorMode: import.meta.env.VITE_CURATOR_MODE === 'true', // gates the upload page
} as const;

// ── ST09: client upload call (apps/srs-demo, e.g. useStore.ts) ───────────────
export async function uploadDeckAudio(deckId: string, file: File): Promise<string> {
  const form = new FormData();
  form.append('audio', file);
  const res = await fetch(`/api/curation/decks/${deckId}/audio`, { method: 'POST', body: form });
  const body = (await res.json()) as ApiResponse<{ audioKey: string }>;
  if (!res.ok || !body.success) throw new Error(body.success ? res.statusText : body.error.message);
  return body.data.audioKey;
}
```

## 4. User Workflows

```
# Curator upload (browser, GLL_CURATOR_MODE + VITE_CURATOR_MODE both set)
open srs-demo → "Curate Audio" nav item (rendered only when env.curatorMode)
  → pick a deck   (from App.vue's boot-time decks list — no new fetch)
  → pick a .mp3   (<input type=file accept="audio/mpeg,.mp3">)
  → Upload        → POST /api/curation/decks/:deckId/audio  (multipart "audio")
      server: isCuratorMode? → deck exists? → putObject(decks/{id}/audio.mp3) → UPDATE audio_key
      → 201 { audioKey } → page shows "✓ paired: decks/{id}/audio.mp3"
  → re-upload same deck ⟹ same key, object overwritten in place (idempotent, DS01 semantics)

# Gate / error paths
GLL_CURATOR_MODE unset       → endpoint 404 (route invisible; page also not rendered)
VITE_CURATOR_MODE unset      → page + nav item absent from the prod bundle (DCE'd)
unknown deckId               → 404, no object written (checked before putObject)
no file selected / empty     → 400, no object written
storage env incomplete       → putObject throws → 500 with the config-error message

# Equivalence to the retired CLI (ST10)
curate-audio <deckId> <path>  ≡  POST /curation/decks/:deckId/audio (file=path's bytes)
  same key, same putObject, same UPDATE, same idempotency — only the input transport differs
```

## 5. Stories

### Phase 3: Curator audio-upload UI (EP42-PH03)

### EP42-ST08: Server upload endpoint — audio file → MinIO + `audio_key` write  *(Done)*

**Scope**: `apps/server` — one new gated multipart route + one small `isCuratorMode` env helper. No schema, no wire-type, no storage-module logic change (reuses `putObject`).
**Read List**: `apps/server/src/routes/decks.ts` (route + `getStore`/`getDb` pattern), `apps/server/src/routes/debug.ts` (JSON-error + `ApiResponse`/`ErrorCode` pattern), `apps/server/src/app.ts` (router registration), `apps/server/src/storage/audio-store.ts` (`putObject`, `loadAudioStorageConfig`), `packages/srs-curation/src/curate-audio.ts` (the CLI logic being ported), `packages/db/src/schema.ts` (`decks.audio_key`)
**Tasks**:

- [x] Add `isCuratorMode(env = process.env): boolean` (truthy `GLL_CURATOR_MODE`) — added to `audio-store.ts`; reads env there only.
- [x] Add `apps/server/src/routes/curation.ts`: `POST /curation/decks/:deckId/audio`. First line gates on `isCuratorMode()` → `c.notFound()`.
- [x] Look up the deck by `:deckId` **before** any upload; unknown ⟹ `404 NOT_FOUND`, no `putObject` call (mirror the CLI's no-orphan guarantee).
- [x] Parse multipart via `c.req.parseBody()`; require a `File` in the `audio` field; missing/empty ⟹ `400 BAD_REQUEST`.
- [x] `putObject(loadAudioStorageConfig(), 'decks/{deckId}/audio.mp3', bytes, 'audio/mpeg')`, then `UPDATE decks SET audio_key=<key>`; return `201 { success:true, data:{ audioKey } }`. A `putObject` throw surfaces as `500 INTERNAL_ERROR` via the existing `errorHandler`.
- [x] Register the router in `app.ts` (`app.route('/api', curationRouter)`).
      **Acceptance Criteria**:
- [x] With `GLL_CURATOR_MODE=true`, POSTing an `.mp3` for a known deck returns `201` with `audioKey='decks/{deckId}/audio.mp3'` and `decks.audio_key` matches. *(covered by `curation.test.ts`; `putObject`→MinIO is mocked in-test — the real S3 round-trip is DS01 ST02's already-verified path, reused unchanged.)*
- [x] Re-POSTing for the same deck leaves the key consistent (idempotent, no second key) — `curation.test.ts`.
- [x] `GLL_CURATOR_MODE` unset ⟹ the route returns `404`; no upload occurs — `curation.test.ts`.
- [x] Unknown `deckId` ⟹ `404`, and `putObject` is not called (no orphaned object) — `curation.test.ts`.
- [x] Missing `audio` field ⟹ `400`; `putObject` throw ⟹ `500` with `audio_key` left untouched; neither writes a row — `curation.test.ts`.

### EP42-ST09: `srs-demo` gated audio-upload page  *(Done — one AC pending browser walkthrough)*

**Scope**: `apps/srs-demo` — one env flag, one upload client fn, one screen + its nav affordance. No change to the learning/review flow.
**Read List**: `apps/srs-demo/src/env.ts` (flag pattern), `apps/srs-demo/src/App.vue` (boot-time decks list, `Screen` type, nav wiring, `env` usage), `apps/srs-demo/src/components/NavMenu.vue` (nav item pattern), `apps/srs-demo/src/components/DeckSelector.vue` (deck-pick UI to mirror), `apps/srs-demo/src/composables/useStore.ts` (fetch/`ApiResponse` client pattern), `apps/srs-demo/src/types.ts` (`Screen`)

> **Nav placement note:** the curator entry is a standalone gated button (bottom-left, mirroring the debug `Record` button), **not** a `NavMenu` item — `NavMenu`'s `active` prop is a closed `'home'|'learn'|'review'` union and widening it would ripple through `activeNav`/`navTo`. `'curate'` is added to the `Screen` union and reached/left via `screen = 'curate'` / `@back → 'select'`.

**Tasks**:

- [x] Add `curatorMode: import.meta.env.VITE_CURATOR_MODE === 'true'` to `env.ts` with a comment matching the existing flags.
- [x] Add `uploadDeckAudio(deckId, file)` (multipart POST, `ApiResponse` unwrap, throw the server message on failure) in `useStore.ts`.
- [x] Add a `CurateAudio.vue` screen: deck `<select>` from `App.vue`'s existing decks list, `<input type="file" accept="audio/mpeg,audio/mp4,.mp3,.m4a">`, an Upload button (disabled until deck + file chosen), and a status line (success shows the returned `audioKey`; failure shows the error message).
- [x] Gate it: render the screen + a "Curate audio" button only when `env.curatorMode`; add `'curate'` to the `Screen` union. Behind `v-if="env.curatorMode"` so prod builds DCE it.
      **Acceptance Criteria**:
- [ ] With `VITE_CURATOR_MODE=true`, a curator picks a deck + a local `.mp3` and, without a terminal, sees the file land in MinIO and `decks.audio_key` set to match (confirmed by a subsequent `GET /api/decks` returning the `audioUrl`). *(Pending: needs a MinIO-up browser walkthrough — the endpoint half is verified by `curation.test.ts`; the `uploadDeckAudio` client half by `uploadDeckAudio.test.ts`.)*
- [x] A server error (unknown deck, storage misconfig) surfaces its message on the page; no silent failure — `CurateAudio.vue` renders `status.message` from the thrown server error; the throw path is covered by `uploadDeckAudio.test.ts`.
- [x] With `VITE_CURATOR_MODE` unset, the page and its button are gated behind `v-if="env.curatorMode"` (Vite DCE's the `import.meta.env`-const branch in prod builds).

### EP42-ST10: Retire the `curate-audio` CLI  *(Done)*

**Scope**: `packages/srs-curation` — deletion + doc-reference fixups only, after ST08/ST09 land.
**Read List**: `packages/srs-curation/src/curate-audio.ts`, `packages/srs-curation/src/__tests__/curate-audio.test.ts`, `packages/srs-curation/package.json` (any script entry), `.agents/changelogs/EP42--deck-audio-storage-and-retrieval/20260713T005450Z-EP42-DS01-deck-audio-storage-and-retrieval.md` (ST03 references), the DS01 ST06 local-loop docs
**Tasks**:

- [x] Delete `curate-audio.ts` + `curate-audio.test.ts`; remove the `package.json` script pointing at it. *(Package left source-less; per PO direction also removed its now-vestigial `test`/`typecheck` scripts + `node_modules`, keeping `data/` + `translation-prompts/` — so `pnpm -r` skips the package instead of erroring on empty tsconfig inputs.)*
- [x] Confirmed `apps/server/src/storage/audio-store.ts` (`putObject`) is now imported by the ST08 endpoint (`routes/curation.ts`) — removing the CLI leaves `putObject` a live dependency, not dead code.
- [x] Updated DS01's ST03 reference (superseded & removed) and the ST06 local-loop docs (`docker-compose.yml` header) to point at the upload page as the sole pairing path.
      **Acceptance Criteria**:
- [x] No `curate-audio` source/test/script remains; `pnpm -r typecheck` + the full test suite pass with the file gone (376 tests across 8 packages green).
- [x] Exactly one code path pairs an audio file with a deck (the ST08 endpoint) — no duplicate remains (grep confirms `putObject` importers are only `audio-store` + its test + the endpoint + the endpoint test).
- [x] DS01's ST03/ST06 references reflect that the page replaced the CLI.

## 6. Success Criteria

1. A curator pairs audio with a deck entirely in the browser — pick deck + `.mp3`, upload, confirm — with no terminal, script, or `source .env.local`.
2. The endpoint is the server-side twin of DS01's `curateAudio`: same deterministic key, same `putObject`, same idempotent overwrite, same object+row-never-drift guarantee — only the input transport differs.
3. The mutating endpoint returns `404` unless `GLL_CURATOR_MODE` is set; the page + nav affordance are dead-code-eliminated from prod builds when `VITE_CURATOR_MODE` is unset.
4. Unknown deck ⟹ `404` with no orphaned object; missing file ⟹ `400`; storage misconfig ⟹ `500` — each distinct, none writes a partial row.
5. No new provider branch: the endpoint reuses `putObject`, so MinIO→R2 stays an env-only cutover.
6. Exactly one audio-pairing path remains after ST10; no schema/wire/engine types change; `pnpm -r typecheck` and the test suite pass.
