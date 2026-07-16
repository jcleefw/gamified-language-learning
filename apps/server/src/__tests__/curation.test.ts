import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { and, eq } from 'drizzle-orm';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { initDb, schema, SqliteContentStore } from '@gll/db';
import type { AppDeck } from '@gll/api-contract';
import { buildVtt } from '@gll/shared-utils';

type TestDb = ReturnType<typeof drizzle<typeof schema>>;
let testDb: TestDb;

vi.mock('@gll/db', async (importOriginal) => {
  const orig = await importOriginal<typeof import('@gll/db')>();
  return { ...orig, getDb: () => testDb };
});

// Keep isCurationMode / loadAudioStorageConfig real; stub only the S3 write.
const putObjectMock = vi.fn(async () => undefined);
vi.mock('../storage/audio-store.js', async (importOriginal) => {
  const orig = await importOriginal<typeof import('../storage/audio-store.js')>();
  return { ...orig, putObject: putObjectMock };
});

beforeEach(() => {
  const sqlite = new Database(':memory:');
  initDb(sqlite);
  testDb = drizzle(sqlite, { schema }) as TestDb;
  putObjectMock.mockClear().mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

const { default: app } = await import('../app.js');

const singleDeck: AppDeck = {
  topic: "let's eat something",
  difficulty: 'beginner',
  register: 'informal',
  lines: [
    {
      speaker: 'A',
      native: 'หิวแล้ว',
      romanization: 'hǐw lɛ́ɛo',
      english: "I'm hungry",
      words: [
        { native: 'หิว', romanization: 'hǐw', english: 'hungry', type: 'adjective', language: 'th' },
      ],
    },
  ],
};

async function seedDeckId(): Promise<string> {
  await new SqliteContentStore(testDb).importCurriculum([singleDeck]);
  return testDb.select().from(schema.decks).get()!.id;
}

// The route validates by container magic bytes, not filename. Trailing bytes
// vary the content hash between recordings without changing the detected format.
function mp3Bytes(tail: number[] = []): Uint8Array<ArrayBuffer> {
  return new Uint8Array([0x49, 0x44, 0x33, ...tail]); // 'ID3' (ID3v2-tagged MP3)
}
function wavBytes(tail: number[] = []): Uint8Array<ArrayBuffer> {
  // 'RIFF' <4-byte size> 'WAVE'
  return new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45, ...tail]);
}

function audioForm(
  filename = 'audio.mp3',
  bytes: Uint8Array<ArrayBuffer> = mp3Bytes(),
  mimeType = 'audio/mpeg',
): FormData {
  const form = new FormData();
  form.append('audio', new File([bytes], filename, { type: mimeType }));
  return form;
}

function upload(deckId: string, body: BodyInit): Promise<Response> {
  return Promise.resolve(
    app.request(`/api/curation/decks/${deckId}/audio`, { method: 'POST', body }),
  );
}

/** The deck's current audio row (is_current=1), or undefined. */
function currentAudio(deckId: string) {
  return testDb
    .select()
    .from(schema.audio)
    .where(and(eq(schema.audio.subject_id, deckId), eq(schema.audio.is_current, true)))
    .get();
}

describe('POST /api/curation/decks/:deckId/audio — curator gate', () => {
  it('returns 404 and does not upload when GLL_CURATION_MODE is unset', async () => {
    const deckId = await seedDeckId();
    const res = await upload(deckId, audioForm());
    expect(res.status).toBe(404);
    expect(putObjectMock).not.toHaveBeenCalled();
  });
});

describe('POST /api/curation/decks/:deckId/audio — with curator mode on', () => {
  beforeEach(() => {
    vi.stubEnv('GLL_CURATION_MODE', 'true');
  });

  it('returns 404 for an unknown deckId and does not upload (no orphaned object)', async () => {
    await seedDeckId(); // seed a different deck so the table isn't empty
    const res = await upload('nonexistent-deck-id', audioForm());
    expect(res.status).toBe(404);
    expect(putObjectMock).not.toHaveBeenCalled();
  });

  it('returns 400 when the audio field is missing and does not upload', async () => {
    const deckId = await seedDeckId();
    const res = await upload(deckId, new FormData()); // no 'audio' field
    expect(res.status).toBe(400);
    expect(putObjectMock).not.toHaveBeenCalled();
  });

  it('uploads and inserts a current audio row on a known deck, returning 201 with the key', async () => {
    const deckId = await seedDeckId();
    const res = await upload(deckId, audioForm());

    expect(res.status).toBe(201);
    const body = (await res.json()) as { success: true; data: { audioKey: string } };
    expect(body.success).toBe(true);
    // Content-addressed: decks/<deckId>/<16-hex sha256>.mp3
    expect(body.data.audioKey).toMatch(new RegExp(`^decks/${deckId}/[0-9a-f]{16}\\.mp3$`));

    expect(putObjectMock).toHaveBeenCalledTimes(1);
    expect(putObjectMock).toHaveBeenCalledWith(
      expect.anything(),
      body.data.audioKey,
      expect.anything(),
      'audio/mpeg',
    );

    const row = currentAudio(deckId)!;
    expect(row.key).toBe(body.data.audioKey);
    expect(row.subject_type).toBe('deck');
    expect(row.format).toBe('mp3');
    expect(row.vtt).toBeNull();
    expect(row.is_current).toBe(true);
  });

  it('is idempotent on bytes — re-uploading the same audio yields the same key; prior row demoted', async () => {
    const deckId = await seedDeckId();
    await upload(deckId, audioForm());
    const firstKey = currentAudio(deckId)!.key;

    const res = await upload(deckId, audioForm());
    expect(res.status).toBe(201);
    // Same bytes ⟹ same content-addressed key.
    expect(currentAudio(deckId)!.key).toBe(firstKey);
    // Versioning: a new current row was inserted; exactly one is current.
    const rows = testDb
      .select()
      .from(schema.audio)
      .where(eq(schema.audio.subject_id, deckId))
      .all();
    expect(rows).toHaveLength(2);
    expect(rows.filter((r) => r.is_current)).toHaveLength(1);
    expect(putObjectMock).toHaveBeenCalledTimes(2);
  });

  it('re-recording (different bytes) mints a NEW current key and retains the prior as history', async () => {
    const deckId = await seedDeckId();
    await upload(deckId, audioForm('audio.mp3', mp3Bytes([1])));
    const firstKey = currentAudio(deckId)!.key;

    await upload(deckId, audioForm('audio.mp3', mp3Bytes([2, 3, 4])));
    const secondKey = currentAudio(deckId)!.key;

    // Distinct bytes ⟹ distinct content hash ⟹ distinct key/URL.
    expect(secondKey).not.toBe(firstKey);
    // The old binary is retained as a demoted (history) row, not clobbered.
    const rows = testDb
      .select()
      .from(schema.audio)
      .where(eq(schema.audio.subject_id, deckId))
      .all();
    expect(rows).toHaveLength(2);
    expect(rows.filter((r) => !r.is_current).map((r) => r.key)).toEqual([firstKey]);
  });

  it('returns 500 and writes no audio row when putObject throws', async () => {
    putObjectMock.mockRejectedValueOnce(new Error('incomplete storage config'));
    const deckId = await seedDeckId();

    const res = await upload(deckId, audioForm());
    expect(res.status).toBe(500);

    expect(currentAudio(deckId)).toBeUndefined();
  });

  it('accepts a WAV file (RIFF/WAVE magic) and derives content type audio/wav', async () => {
    const deckId = await seedDeckId();
    const res = await upload(deckId, audioForm('audio.wav', wavBytes(), 'audio/wav'));

    expect(res.status).toBe(201);
    const body = (await res.json()) as { success: true; data: { audioKey: string } };
    expect(body.data.audioKey).toMatch(new RegExp(`^decks/${deckId}/[0-9a-f]{16}\\.wav$`));

    expect(putObjectMock).toHaveBeenCalledWith(
      expect.anything(),
      body.data.audioKey,
      expect.anything(),
      'audio/wav',
    );
  });

  it('validates by content, not filename — a non-audio payload named .mp3 is rejected with 400', async () => {
    const deckId = await seedDeckId();
    // Bytes that match no supported container, despite the .mp3 filename.
    const res = await upload(deckId, audioForm('audio.mp3', new Uint8Array([0, 1, 2, 3])));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { success: false; error: { message: string } };
    expect(body.error.message).toContain('MP3 or WAV');
    expect(putObjectMock).not.toHaveBeenCalled();
  });
});

describe('PUT /api/curation/decks/:deckId/audio/vtt — WebVTT server-write (EP43-DS02)', () => {
  /** The 16-hex content hash embedded in the current audio row's key. */
  function currentHash(deckId: string): string {
    return currentAudio(deckId)!.key.match(/\/([0-9a-f]+)\.mp3$/)![1];
  }
  function putVtt(deckId: string, vtt: string): Promise<Response> {
    return Promise.resolve(
      app.request(`/api/curation/decks/${deckId}/audio/vtt`, {
        method: 'PUT',
        body: vtt,
        headers: { 'Content-Type': 'text/vtt' },
      }),
    );
  }

  it('returns 404 when GLL_CURATION_MODE is unset', async () => {
    const deckId = await seedDeckId();
    const res = await putVtt(deckId, 'WEBVTT\n');
    expect(res.status).toBe(404);
  });

  describe('with curator mode on', () => {
    beforeEach(() => vi.stubEnv('GLL_CURATION_MODE', 'true'));

    it('404s when the deck has no current audio', async () => {
      const deckId = await seedDeckId();
      const res = await putVtt(deckId, buildVtt([{ id: 's1', start: 0, end: 1 }], 'deadbeef'));
      expect(res.status).toBe(404);
    });

    it('409s when the VTT stamp does not match the current binary hash', async () => {
      const deckId = await seedDeckId();
      await upload(deckId, audioForm());
      const res = await putVtt(deckId, buildVtt([{ id: 's1', start: 0, end: 1 }], 'notthehash00'));
      expect(res.status).toBe(409);
      expect(currentAudio(deckId)!.vtt).toBeNull();
      // no bucket write for the VTT beyond the earlier audio upload
      expect(putObjectMock).toHaveBeenCalledTimes(1);
    });

    it('writes the DB projection + bucket .vtt when the stamp matches', async () => {
      const deckId = await seedDeckId();
      await upload(deckId, audioForm());
      const vtt = buildVtt([{ id: 's1', start: 0, end: 1.5 }], currentHash(deckId));

      const res = await putVtt(deckId, vtt);
      expect(res.status).toBe(200);
      const body = (await res.json()) as { success: true; data: { vttKey: string } };
      expect(body.data.vttKey).toMatch(new RegExp(`^decks/${deckId}/[0-9a-f]{16}\\.vtt$`));

      expect(currentAudio(deckId)!.vtt).toBe(vtt);
      // second putObject call is the .vtt, text/vtt
      expect(putObjectMock).toHaveBeenLastCalledWith(
        expect.anything(),
        body.data.vttKey,
        expect.anything(),
        'text/vtt',
      );
    });

    it('GET returns the committed VTT, 404 before any commit', async () => {
      const deckId = await seedDeckId();
      await upload(deckId, audioForm());
      const before = await app.request(`/api/curation/decks/${deckId}/audio/vtt`);
      expect(before.status).toBe(404);

      const vtt = buildVtt([{ id: 's1', start: 0, end: 1 }], currentHash(deckId));
      await putVtt(deckId, vtt);
      const after = await app.request(`/api/curation/decks/${deckId}/audio/vtt`);
      expect(after.status).toBe(200);
      expect(await after.text()).toBe(vtt);
    });
  });
});
