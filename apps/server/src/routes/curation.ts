import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { getDb, schema } from '@gll/db';
import { ErrorCode, type ApiResponse } from '@gll/api-contract';
import { isCuratorMode, loadAudioStorageConfig, putObject } from '../storage/audio-store.js';

const router = new Hono();

/**
 * Curator audio upload (EP42-DS02, ST08). The server-side twin of DS01's
 * `curateAudio`: a multipart file in, `putObject` + `decks.audio_key` write out,
 * in one request — so the bucket object and the DB row never drift. The key is
 * server-owned and deterministic (`decks/{deckId}/audio.mp3`), never taken from
 * the client, which keeps re-uploads idempotent and prevents arbitrary-path
 * writes. Gated behind GLL_CURATOR_MODE: when unset the route 404s (its
 * existence isn't advertised), so a default production deploy exposes no
 * mutating audio surface.
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

  // Derive file extension from the uploaded filename. Only .mp3 and .m4a allowed.
  const ext = file.name.toLowerCase().match(/\.(mp3|m4a)$/)?.[1];
  if (!ext) {
    const body: ApiResponse<never> = {
      success: false,
      error: { code: ErrorCode.BAD_REQUEST, message: 'File must be .mp3 or .m4a' },
    };
    return c.json(body, 400);
  }

  const contentType = ext === 'mp3' ? 'audio/mpeg' : 'audio/mp4';
  const bytes = new Uint8Array(await file.arrayBuffer());
  const key = `decks/${deckId}/audio.${ext}`;

  // May throw on incomplete storage config / unreachable bucket → surfaces as
  // 500 via the app-level errorHandler. Upload before the row write, so a failed
  // upload leaves audio_key untouched (no half-paired deck).
  await putObject(loadAudioStorageConfig(), key, bytes, contentType);

  db.update(schema.decks).set({ audio_key: key }).where(eq(schema.decks.id, deckId)).run();

  const body: ApiResponse<{ audioKey: string }> = { success: true, data: { audioKey: key } };
  return c.json(body, 201);
});

export default router;
