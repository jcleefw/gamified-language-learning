import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { initDb, schema, SqliteContentStore } from '@gll/db';
import type { AppDeck, AppDeckPayload, ConversationJSON, GetDecksResponse } from '@gll/api-contract';

type TestDb = ReturnType<typeof drizzle<typeof schema>>;
let testDb: TestDb;

vi.mock('@gll/db', async (importOriginal) => {
  const orig = await importOriginal<typeof import('@gll/db')>();
  return { ...orig, getDb: () => testDb };
});

beforeEach(() => {
  const sqlite = new Database(':memory:');
  initDb(sqlite);
  testDb = drizzle(sqlite, { schema }) as TestDb;
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
        { native: 'แล้ว', romanization: 'lɛ́ɛo', english: 'already', type: 'particle', language: 'th' },
      ],
    },
    {
      speaker: 'B',
      native: 'ไปกิน',
      romanization: 'bpai gin',
      english: "Let's eat",
      words: [
        { native: 'ไป', romanization: 'bpai', english: 'to go', type: 'verb', language: 'th' },
        { native: 'กิน', romanization: 'gin', english: 'to eat', type: 'verb', language: 'th' },
      ],
    },
  ],
};

const sampleConvJSON: ConversationJSON = {
  topic: 'Weather today',
  difficulty: 'beginner',
  register: 'informal',
  lines: [
    { speaker: 'A', thai: 'ร้อนมาก', english: 'Very hot', romanization: 'lines-romanization' },
  ],
  breakdown: [
    {
      thai: 'ร้อนมาก',
      romanization: 'ráwn mâak',
      english: 'Very hot',
      components: [
        { thai: 'ร้อน', romanization: 'ráwn', english: 'hot', type: 'adjective' },
        { thai: 'มาก', romanization: 'mâak', english: 'very', type: 'adverb' },
      ],
    },
  ],
};

describe('GET /api/decks', () => {
  it('returns empty array when no decks are seeded', async () => {
    const res = await app.request('/api/decks');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: true; data: GetDecksResponse };
    expect(body.success).toBe(true);
    expect(body.data).toEqual([]);
  });

  it('returns deck with UUID id after importCurriculum', async () => {
    await new SqliteContentStore(testDb).importCurriculum([singleDeck]);
    const res = await app.request('/api/decks');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: true; data: GetDecksResponse };
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    const deck = body.data[0] as AppDeckPayload;
    expect(deck.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(deck.topic).toBe("let's eat something");
    expect(deck.difficulty).toBe('beginner');
    expect(deck.register).toBe('informal');
  });

  it('returns words with correct romanization/english/type from senses', async () => {
    await new SqliteContentStore(testDb).importCurriculum([singleDeck]);
    const res = await app.request('/api/decks');
    const body = (await res.json()) as { success: true; data: GetDecksResponse };
    const deck = body.data[0] as AppDeckPayload;
    const hungry = deck.words.find((w) => w.native === 'หิว');
    expect(hungry).toBeDefined();
    expect(hungry!.romanization).toBe('hǐw');
    expect(hungry!.english).toBe('hungry');
    expect(hungry!.type).toBe('adjective');
    expect(hungry!.language).toBe('th');
  });

  it('returns lines in position order with correct speaker', async () => {
    await new SqliteContentStore(testDb).importCurriculum([singleDeck]);
    const res = await app.request('/api/decks');
    const body = (await res.json()) as { success: true; data: GetDecksResponse };
    const deck = body.data[0] as AppDeckPayload;
    expect(deck.lines).toHaveLength(2);
    expect(deck.lines[0].speaker).toBe('A');
    expect(deck.lines[1].speaker).toBe('B');
  });

  it('returns wordIds in component position order', async () => {
    await new SqliteContentStore(testDb).importCurriculum([singleDeck]);
    const res = await app.request('/api/decks');
    const body = (await res.json()) as { success: true; data: GetDecksResponse };
    const deck = body.data[0] as AppDeckPayload;
    // Line 0 has 2 components: หิว, แล้ว — wordIds should be 2 UUIDs
    expect(deck.lines[0].wordIds).toHaveLength(2);
    // Both should be UUIDs present in deck.words
    const wordIdSet = new Set(deck.words.map((w) => w.id));
    for (const wid of deck.lines[0].wordIds) {
      expect(wordIdSet.has(wid)).toBe(true);
    }
    // First wordId should correspond to 'หิว'
    const firstWordId = deck.lines[0].wordIds[0];
    const firstWord = deck.words.find((w) => w.id === firstWordId);
    expect(firstWord!.native).toBe('หิว');
  });
});

describe('GET /api/decks — audio fields (EP42-DS01, ST05)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  /** Insert a current audio row for a deck; returns the content hash used in its key. */
  function addAudio(deckId: string, vtt: string | null): string {
    const hash = 'deadbeefcafef00d';
    testDb
      .insert(schema.audio)
      .values({
        id: `aud-${deckId}`,
        subject_type: 'deck',
        subject_id: deckId,
        key: `decks/${deckId}/${hash}.mp3`,
        format: 'mp3',
        size_bytes: 2048,
        vtt,
        is_current: true,
        created_at: new Date().toISOString(),
      })
      .run();
    return hash;
  }

  it('emits audioUrl + vttUrl when a current audio row with a vtt exists and GLL_AUDIO_PUBLIC_URL is set', async () => {
    vi.stubEnv('GLL_AUDIO_PUBLIC_URL', 'http://localhost:9000/gll-audio');

    await new SqliteContentStore(testDb).importCurriculum([singleDeck]);
    const deckRow = testDb.select().from(schema.decks).get()!;
    const hash = addAudio(deckRow.id, 'WEBVTT\n\nNOTE audio-sha256:deadbeefcafef00d\n');

    const res = await app.request('/api/decks');
    const body = (await res.json()) as { success: true; data: GetDecksResponse };
    const deck = body.data[0] as AppDeckPayload;

    expect(deck.audioUrl).toBe(`http://localhost:9000/gll-audio/decks/${deckRow.id}/${hash}.mp3`);
    expect(deck.vttUrl).toBe(`http://localhost:9000/gll-audio/decks/${deckRow.id}/${hash}.vtt`);
    // No per-line timing on the wire — timing is the VTT track.
    expect(deck.lines.every((l) => !('audioStart' in l) && !('audioEnd' in l))).toBe(true);
  });

  it('emits audioUrl but omits vttUrl when the current row has no vtt', async () => {
    vi.stubEnv('GLL_AUDIO_PUBLIC_URL', 'http://localhost:9000/gll-audio');

    await new SqliteContentStore(testDb).importCurriculum([singleDeck]);
    const deckRow = testDb.select().from(schema.decks).get()!;
    addAudio(deckRow.id, null);

    const res = await app.request('/api/decks');
    const body = (await res.json()) as { success: true; data: GetDecksResponse };
    const deck = body.data[0] as AppDeckPayload;

    expect(deck.audioUrl).toBeDefined();
    expect('vttUrl' in deck).toBe(false);
  });

  it('omits audioUrl/vttUrl when the deck has no audio row — no error', async () => {
    vi.stubEnv('GLL_AUDIO_PUBLIC_URL', 'http://localhost:9000/gll-audio');

    await new SqliteContentStore(testDb).importCurriculum([singleDeck]);
    const res = await app.request('/api/decks');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: true; data: GetDecksResponse };
    const deck = body.data[0] as AppDeckPayload;

    expect('audioUrl' in deck).toBe(false);
    expect('vttUrl' in deck).toBe(false);
    expect(deck.lines.every((l) => !('audioStart' in l) && !('audioEnd' in l))).toBe(true);
  });

  it('omits audioUrl when GLL_AUDIO_PUBLIC_URL is unset — server still serves /api/decks normally', async () => {
    vi.stubEnv('GLL_AUDIO_PUBLIC_URL', '');

    await new SqliteContentStore(testDb).importCurriculum([singleDeck]);
    const deckRow = testDb.select().from(schema.decks).get()!;
    addAudio(deckRow.id, 'WEBVTT\n');

    const res = await app.request('/api/decks');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: true; data: GetDecksResponse };
    const deck = body.data[0] as AppDeckPayload;
    expect('audioUrl' in deck).toBe(false);
    expect('vttUrl' in deck).toBe(false);
  });
});

describe('POST /api/curriculum/import', () => {
  it('returns 201 for a valid ConversationJSON body', async () => {
    const res = await app.request('/api/curriculum/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sampleConvJSON),
    });
    expect(res.status).toBe(201);
  });

  it('newly imported deck appears in GET /api/decks', async () => {
    await app.request('/api/curriculum/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sampleConvJSON),
    });
    const res = await app.request('/api/decks');
    const body = (await res.json()) as { success: true; data: GetDecksResponse };
    expect(body.data).toHaveLength(1);
    expect(body.data[0].topic).toBe('Weather today');
  });

  it('returns 400 for invalid (non-object) body', async () => {
    const res = await app.request('/api/curriculum/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '"not an object"',
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 for a structurally malformed ConversationJSON body (Zod guard)', async () => {
    const malformed = { ...sampleConvJSON, breakdown: [{ ...sampleConvJSON.breakdown[0], components: 'not-an-array' }] };
    const res = await app.request('/api/curriculum/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(malformed),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { success: false; error: { code: string; message: string } };
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('BAD_REQUEST');
  });

  it('does not import a deck when the body fails Zod validation', async () => {
    const malformed = { ...sampleConvJSON, topic: '' };
    await app.request('/api/curriculum/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(malformed),
    });
    const res = await app.request('/api/decks');
    const body = (await res.json()) as { success: true; data: GetDecksResponse };
    expect(body.data).toHaveLength(0);
  });
});
