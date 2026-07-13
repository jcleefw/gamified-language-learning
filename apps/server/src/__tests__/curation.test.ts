import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { initDb, schema, SqliteContentStore } from '@gll/db';
import type { AppDeck } from '@gll/api-contract';

type TestDb = ReturnType<typeof drizzle<typeof schema>>;
let testDb: TestDb;

vi.mock('@gll/db', async (importOriginal) => {
  const orig = await importOriginal<typeof import('@gll/db')>();
  return { ...orig, getDb: () => testDb };
});

// Keep isCuratorMode / loadAudioStorageConfig real; stub only the S3 write.
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

describe('POST /api/curation/decks/:deckId/audio — curator gate', () => {
  it('returns 404 and does not upload when GLL_CURATOR_MODE is unset', async () => {
    const deckId = await seedDeckId();
    const res = await upload(deckId, audioForm());
    expect(res.status).toBe(404);
    expect(putObjectMock).not.toHaveBeenCalled();
  });
});

describe('POST /api/curation/decks/:deckId/audio — with curator mode on', () => {
  beforeEach(() => {
    vi.stubEnv('GLL_CURATOR_MODE', 'true');
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

  it('uploads and sets decks.audio_key on a known deck, returning 201 with the key', async () => {
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

    const row = testDb.select().from(schema.decks).where(eq(schema.decks.id, deckId)).get()!;
    expect(row.audio_key).toBe(body.data.audioKey);
  });

  it('is idempotent — re-uploading the same deck yields the same key with no drift', async () => {
    const deckId = await seedDeckId();
    await upload(deckId, audioForm());
    const firstKey = testDb.select().from(schema.decks).where(eq(schema.decks.id, deckId)).get()!.audio_key;

    const res = await upload(deckId, audioForm());
    const secondKey = testDb.select().from(schema.decks).where(eq(schema.decks.id, deckId)).get()!.audio_key;

    expect(res.status).toBe(201);
    expect(secondKey).toBe(firstKey);
    expect(putObjectMock).toHaveBeenCalledTimes(2);
  });

  it('re-recording (different bytes) mints a NEW key — never overwrites an immutable-cached URL', async () => {
    const deckId = await seedDeckId();
    await upload(deckId, audioForm('audio.mp3', mp3Bytes([1])));
    const firstKey = testDb.select().from(schema.decks).where(eq(schema.decks.id, deckId)).get()!.audio_key;

    await upload(deckId, audioForm('audio.mp3', mp3Bytes([2, 3, 4])));
    const secondKey = testDb.select().from(schema.decks).where(eq(schema.decks.id, deckId)).get()!.audio_key;

    // Distinct bytes ⟹ distinct content hash ⟹ distinct key/URL, so no cache
    // (browser or CDN edge) can serve stale audio for the new recording.
    expect(secondKey).not.toBe(firstKey);
  });

  it('returns 500 and leaves audio_key untouched when putObject throws', async () => {
    putObjectMock.mockRejectedValueOnce(new Error('incomplete storage config'));
    const deckId = await seedDeckId();

    const res = await upload(deckId, audioForm());
    expect(res.status).toBe(500);

    const row = testDb.select().from(schema.decks).where(eq(schema.decks.id, deckId)).get()!;
    expect(row.audio_key).toBeNull();
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
