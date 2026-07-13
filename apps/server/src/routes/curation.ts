import { Hono } from 'hono';
import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { getDb, schema } from '@gll/db';
import { ErrorCode, type ApiResponse } from '@gll/api-contract';
import { isCuratorMode, loadAudioStorageConfig, putObject } from '../storage/audio-store.js';

const router = new Hono();

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
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && // 'RIFF'
    bytes[8] === 0x57 && bytes[9] === 0x41 && bytes[10] === 0x56 && bytes[11] === 0x45 // 'WAVE'
  ) {
    return 'wav';
  }
  // ID3v2 tag prefix
  if (bytes.length >= 3 && bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
    return 'mp3';
  }
  // MPEG frame sync (11 set bits): covers ID3-less MP3 files
  if (bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) {
    return 'mp3';
  }
  return null;
}

/**
 * Curator audio upload (EP42-DS02, ST08). The server-side twin of DS01's
 * `curateAudio`: a multipart file in, `putObject` + `decks.audio_key` write out,
 * in one request — so the bucket object and the DB row never drift. The key is
 * server-owned and content-addressed (`decks/{deckId}/{sha256}.{ext}`), never
 * taken from the client, which prevents arbitrary-path writes. Because the key
 * is derived from the bytes, it satisfies the playback ADR §7 never-overwrite
 * invariant that the `immutable` cache header relies on: identical bytes resolve
 * to the same key (a true no-op re-upload), while a re-recording mints a NEW key
 * and a new audioUrl — so no cache ever serves stale bytes for a given URL.
 * Gated behind GLL_CURATOR_MODE: when unset the route 404s (its existence isn't
 * advertised), so a default production deploy exposes no mutating audio surface.
 */
router.post('/curation/decks/:deckId/audio', async (c) => {
  if (!isCuratorMode()) {
    return c.notFound();
  }

  const deckId = c.req.param('deckId');
  const db = getDb();

  // Check the deck exists BEFORE uploading — mirror the CLI's "fail loudly,
  // never orphan an uploaded object" guarantee (DS01 ST03).
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

  // Validate by the file's magic bytes, not the client-supplied filename — a
  // renamed or misencoded upload (e.g. ALAC in a .mp3) must not reach the
  // bucket where it would silently break playback. Only browser-decodable
  // formats pass.
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
  // (never an in-place overwrite), which is what the immutable cache header
  // requires for correctness (playback ADR §7). 16 hex chars = 64 bits, ample
  // to avoid collisions across a deck's handful of recordings.
  const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 16);
  const key = `decks/${deckId}/${hash}.${format}`;

  // May throw on incomplete storage config / unreachable bucket → surfaces as
  // 500 via the app-level errorHandler. Upload before the row write, so a failed
  // upload leaves audio_key untouched (no half-paired deck).
  await putObject(loadAudioStorageConfig(), key, bytes, contentType);

  db.update(schema.decks).set({ audio_key: key }).where(eq(schema.decks.id, deckId)).run();

  const body: ApiResponse<{ audioKey: string }> = { success: true, data: { audioKey: key } };
  return c.json(body, 201);
});

export default router;
