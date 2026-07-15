import { Hono } from 'hono';
import { createHash, randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { getDb, schema } from '@gll/db';
import { ErrorCode, readVttHash, type ApiResponse } from '@gll/api-contract';
import {
  deriveVttKey,
  isCurationMode,
  loadAudioStorageConfig,
  putObject,
} from '../storage/audio-store.js';

const router = new Hono();

/** Check if bytes at offset match the given ASCII signature. */
function matchesSignature(bytes: Uint8Array, offset: number, signature: string): boolean {
  if (bytes.length < offset + signature.length) return false;
  return String.fromCharCode(...bytes.slice(offset, offset + signature.length)) === signature;
}

/**
 * Sniffs the actual container/codec from the file's magic bytes rather than
 * trusting the client-supplied filename extension. This exists because a
 * misencoded upload (e.g. an ALAC-in-.m4a file — ALAC isn't decodable by
 * `<audio>` in any browser but Safari) previously passed extension-only
 * validation and silently broke playback for every learner. WAV and MP3 are
 * chosen as the only accepted formats because both are natively decodable by
 * every mainstream browser's `<audio>` element with no codec ambiguity.
 */
function detectAudioFormat(bytes: Uint8Array): 'wav' | 'mp3' | null {
  // WAV: RIFF header (offset 0) + WAVE signature (offset 8)
  if (matchesSignature(bytes, 0, 'RIFF') && matchesSignature(bytes, 8, 'WAVE')) {
    return 'wav';
  }
  // MP3: ID3v2 tag prefix
  if (matchesSignature(bytes, 0, 'ID3')) {
    return 'mp3';
  }
  // MPEG frame sync (11 set bits): covers ID3-less MP3 files
  if (bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) {
    return 'mp3';
  }
  return null;
}

/** Extract the content-address hash from a key like `decks/{id}/{hash}.{ext}`. */
function keyHash(key: string): string | null {
  return key.match(/\/([0-9a-f]+)\.(?:mp3|wav)$/)?.[1] ?? null;
}

/**
 * Curator audio upload (EP42-DS02, ST08). A multipart file in → `putObject` +
 * an `audio`-row insert out, in one request, so the bucket object and the DB row
 * never drift. The key is server-owned and content-addressed
 * (`decks/{deckId}/{sha256}.{ext}`), never taken from the client, which prevents
 * arbitrary-path writes and satisfies the immutable-cache never-overwrite
 * invariant (identical bytes ⟹ same key). Persistence is the asset-model ADR's
 * versioning: demote the deck's current `audio` row and insert a new current one
 * (vtt=NULL) — a re-record never clobbers prior audio/VTT. Gated behind
 * GLL_CURATION_MODE: when unset the route 404s.
 */
router.post('/curation/decks/:deckId/audio', async (c) => {
  if (!isCurationMode()) {
    return c.notFound();
  }

  const deckId = c.req.param('deckId');
  const db = getDb();

  // Check the deck exists BEFORE uploading — fail loudly, never orphan an object.
  const deck = db.select().from(schema.decks).where(eq(schema.decks.id, deckId)).get();
  if (!deck) {
    const body: ApiResponse<never> = {
      success: false,
      error: { code: ErrorCode.NOT_FOUND, message: `Unknown deckId "${deckId}"` },
    };
    return c.json(body, 404);
  }

  const form = await c.req.parseBody();
  const file = form['audio'];
  if (!(file instanceof File)) {
    const body: ApiResponse<never> = {
      success: false,
      error: { code: ErrorCode.BAD_REQUEST, message: 'Missing multipart "audio" file field' },
    };
    return c.json(body, 400);
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  // Validate by magic bytes, not the client filename — a renamed/misencoded
  // upload must not reach the bucket where it would break playback.
  const format = detectAudioFormat(bytes);
  if (!format) {
    const body: ApiResponse<never> = {
      success: false,
      error: { code: ErrorCode.BAD_REQUEST, message: 'File must be an MP3 or WAV audio file' },
    };
    return c.json(body, 400);
  }

  const contentType = format === 'wav' ? 'audio/wav' : 'audio/mpeg';
  // Content-addressed key: hashing the bytes makes re-records produce a new key
  // (never an in-place overwrite). 16 hex chars = 64 bits, ample for a deck's
  // handful of recordings.
  const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 16);
  const key = `decks/${deckId}/${hash}.${format}`;

  // Upload before the row write, so a failed upload leaves the DB untouched.
  await putObject(loadAudioStorageConfig(), key, bytes, contentType);

  // Versioned insert (asset-model ADR §3): demote the current row, insert the
  // new current one. History (binary + any VTT) is retained on the demoted row.
  db.transaction((tx) => {
    tx.update(schema.audio)
      .set({ is_current: false })
      .where(
        and(
          eq(schema.audio.subject_type, 'deck'),
          eq(schema.audio.subject_id, deckId),
          eq(schema.audio.is_current, true),
        ),
      )
      .run();
    tx.insert(schema.audio)
      .values({
        id: randomUUID(),
        subject_type: 'deck',
        subject_id: deckId,
        key,
        format,
        size_bytes: bytes.length,
        duration_seconds: null,
        vtt: null,
        uploaded_by: null,
        is_current: true,
        created_at: new Date().toISOString(),
      })
      .run();
  });

  const body: ApiResponse<{ audioKey: string }> = { success: true, data: { audioKey: key } };
  return c.json(body, 201);
});

/** Fetch the current (is_current=true) audio record for a deck, or undefined if none exists. */
function currentAudioRow(deckId: string) {
  return getDb()
    .select()
    .from(schema.audio)
    .where(
      and(
        eq(schema.audio.subject_type, 'deck'),
        eq(schema.audio.subject_id, deckId),
        eq(schema.audio.is_current, true),
      ),
    )
    .get();
}

/**
 * Commit a WebVTT timing track for a deck's current audio (EP43-DS02, ST05).
 * Single-pass server-write (WebVTT ADR §8): validate the `NOTE audio-sha256`
 * stamp against the current binary, then write BOTH tiers — the `audio.vtt` DB
 * column (live projection) and the durable bucket `.vtt` (system-of-record).
 * Gated behind GLL_CURATION_MODE.
 */
router.put('/curation/decks/:deckId/audio/vtt', async (c) => {
  if (!isCurationMode()) {
    return c.notFound();
  }

  const deckId = c.req.param('deckId');
  const row = currentAudioRow(deckId);
  if (!row) {
    const body: ApiResponse<never> = {
      success: false,
      error: { code: ErrorCode.NOT_FOUND, message: `Deck "${deckId}" has no current audio` },
    };
    return c.json(body, 404);
  }

  const vtt = await c.req.text();

  // The VTT is bound to a specific binary (WebVTT ADR §4). A stamp that doesn't
  // match the current row's content hash means it was authored against a
  // different (e.g. since-replaced) binary — reject rather than silently mismatch.
  const stamp = readVttHash(vtt);
  if (stamp !== keyHash(row.key)) {
    const body: ApiResponse<never> = {
      success: false,
      error: {
        code: ErrorCode.CONFLICT,
        message: 'VTT audio-sha256 stamp does not match the current audio binary',
      },
    };
    return c.json(body, 409);
  }

  // Bucket .vtt first (durable SoR); then the DB projection. text/vtt ⟹ no-cache
  // (the .vtt at this derived key is overwritten on re-mark).
  await putObject(loadAudioStorageConfig(), deriveVttKey(row.key), Buffer.from(vtt), 'text/vtt');
  getDb().update(schema.audio).set({ vtt }).where(eq(schema.audio.id, row.id)).run();

  const body: ApiResponse<{ vttKey: string }> = {
    success: true,
    data: { vttKey: deriveVttKey(row.key) },
  };
  return c.json(body, 200);
});

/** Download the current committed VTT (curator convenience). */
router.get('/curation/decks/:deckId/audio/vtt', async (c) => {
  if (!isCurationMode()) {
    return c.notFound();
  }
  const row = currentAudioRow(c.req.param('deckId'));
  if (!row || row.vtt == null) {
    return c.notFound();
  }
  return c.body(row.vtt, 200, { 'Content-Type': 'text/vtt' });
});

export default router;
