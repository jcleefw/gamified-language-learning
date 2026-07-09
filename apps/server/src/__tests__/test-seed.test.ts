import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { initDb, schema, SqliteLearningStore } from '@gll/db';
import type { WordState } from '@gll/srs-engine-v2';
import { DEFAULT_SHELVING_CONFIG } from '@gll/srs-shelving';

// ---------------------------------------------------------------------------
// DB mock — override getDb() to return a fresh in-memory DB per test
// ---------------------------------------------------------------------------

type TestDb = ReturnType<typeof drizzle<typeof schema>>;
let testDb: TestDb;
let testSqlite: Database.Database;

vi.mock('@gll/db', async (importOriginal) => {
  const orig = await importOriginal<typeof import('@gll/db')>();
  return { ...orig, getDb: () => testDb };
});

beforeEach(async () => {
  testSqlite = new Database(':memory:');
  initDb(testSqlite);
  testDb = drizzle(testSqlite, { schema }) as TestDb;

  // Reset config override between tests
  await app.request('/api/test/config/shelving', { method: 'DELETE' });
});

// ---------------------------------------------------------------------------
// Import app AFTER mock is set up so routes pick up mocked getDb
// ---------------------------------------------------------------------------

const { default: app } = await import('../app.js');

// ---------------------------------------------------------------------------
// Helper types matching the ScenarioFixture schema from DS03
// ---------------------------------------------------------------------------

interface ScenarioFixture {
  name: string;
  description: string;
  deckId: string;
  wordStates: Array<{
    wordId: string;
    seen: number;
    correct: number;
    mastery: number;
    correctStreak: number;
    wrongStreak: number;
    lapses: number;
  }>;
  stagnationCounters: Array<{
    wordId: string;
    count: number;
    lastBoundaryMastery: number;
  }>;
  shelvedWords: Array<{
    wordId: string;
    shelvedAtBatch: number;
  }>;
  reviewCards?: Array<{
    wordId: string;
    performance?: { correctStreak: number; lapses: number; correctRatio: number };
    dueOffsetMs?: number;
  }>;
  config?: {
    stagnationBatchWindow?: number;
    maxShelved?: number;
  };
}

const baseFixture: ScenarioFixture = {
  name: 'test-fixture',
  description: 'Test fixture',
  deckId: 'deck-eat',
  wordStates: [
    { wordId: 'th::หิว', seen: 3, correct: 1, mastery: 1, correctStreak: 1, wrongStreak: 0, lapses: 0 },
    { wordId: 'th::กิน', seen: 4, correct: 2, mastery: 2, correctStreak: 2, wrongStreak: 0, lapses: 0 },
  ],
  stagnationCounters: [],
  shelvedWords: [],
};

async function seed(fixture: ScenarioFixture) {
  return app.request('/api/test/seed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fixture),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/test/seed', () => {
  it('clears existing word states and inserts seeded word states', async () => {
    // Pre-seed an existing word state so we can verify it gets cleared
    const store = new SqliteLearningStore(testDb);
    const existingWord: WordState = {
      wordId: 'th::old-word',
      seen: 5, correct: 3, mastery: 2, correctStreak: 1, wrongStreak: 0, lapses: 0,
    };
    await store.upsertWordState('demo-user', existingWord);
    expect((await store.getAllWordStates('demo-user')).has('th::old-word')).toBe(true);

    const res = await seed(baseFixture);

    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: null };
    expect(body.success).toBe(true);

    const after = await store.getAllWordStates('demo-user');
    expect(after.has('th::old-word')).toBe(false);
    expect(after.has('th::หิว')).toBe(true);
    expect(after.has('th::กิน')).toBe(true);
    expect(after.get('th::หิว')?.mastery).toBe(1);
    expect(after.get('th::กิน')?.mastery).toBe(2);
  });

  it('inserts stagnation counters into user_deck_word_tracking', async () => {
    const fixture: ScenarioFixture = {
      ...baseFixture,
      stagnationCounters: [
        { wordId: 'th::หิว', count: 2, lastBoundaryMastery: 0 },
      ],
    };

    const res = await seed(fixture);
    expect(res.status).toBe(200);

    // Verify via getStagnantWords — threshold 2 should return th::หิว (count=2 >= 2)
    const stagnantRes = await app.request('/api/stagnation/stagnant?deckId=deck-eat&threshold=2');
    expect(stagnantRes.status).toBe(200);
    const stagnantBody = await stagnantRes.json() as { success: boolean; data: { stagnantWordIds: string[] } };
    expect(stagnantBody.data.stagnantWordIds).toContain('th::หิว');

    // Threshold 3 should NOT return it (count=2 < 3)
    const stagnantRes2 = await app.request('/api/stagnation/stagnant?deckId=deck-eat&threshold=3');
    const stagnantBody2 = await stagnantRes2.json() as { success: boolean; data: { stagnantWordIds: string[] } };
    expect(stagnantBody2.data.stagnantWordIds).not.toContain('th::หิว');
  });

  it('inserts shelved words into user_shelved_words', async () => {
    const fixture: ScenarioFixture = {
      ...baseFixture,
      shelvedWords: [
        { wordId: 'th::หิว', shelvedAtBatch: 3 },
      ],
    };

    const res = await seed(fixture);
    expect(res.status).toBe(200);

    const shelvedRes = await app.request('/api/shelving?deckId=deck-eat');
    expect(shelvedRes.status).toBe(200);
    const shelvedBody = await shelvedRes.json() as { success: boolean; data: Array<{ wordId: string; shelvedAtBatch: number }> };
    expect(shelvedBody.data).toHaveLength(1);
    expect(shelvedBody.data[0].wordId).toBe('th::หิว');
    expect(shelvedBody.data[0].shelvedAtBatch).toBe(3);
  });

  it('seeds a review card that is immediately due, without going through /api/answer', async () => {
    const fixture: ScenarioFixture = {
      ...baseFixture,
      reviewCards: [{ wordId: 'th::หิว' }],
    };

    const res = await seed(fixture);
    expect(res.status).toBe(200);

    const reviewsRes = await app.request('/api/reviews');
    expect(reviewsRes.status).toBe(200);
    const reviewsBody = await reviewsRes.json() as { success: boolean; data: { reviews: Array<{ wordId: string; due: string }> } };
    expect(reviewsBody.data.reviews.map((r) => r.wordId)).toContain('th::หิว');
  });

  it('reviewCards respects a custom dueOffsetMs (future due does not appear yet)', async () => {
    const fixture: ScenarioFixture = {
      ...baseFixture,
      reviewCards: [{ wordId: 'th::หิว', dueOffsetMs: 1000 * 60 * 60 * 24 }],
    };

    const res = await seed(fixture);
    expect(res.status).toBe(200);

    const reviewsRes = await app.request('/api/reviews');
    const reviewsBody = await reviewsRes.json() as { success: boolean; data: { reviews: Array<{ wordId: string; due: string }> } };
    expect(reviewsBody.data.reviews.map((r) => r.wordId)).not.toContain('th::หิว');
  });

  // EP39: a positive dueOffsetMs seeds a NOT-DUE learned card — the fixture the
  // Practice-Anytime path needs. It is absent from /api/reviews (due-only) yet
  // present in /api/reviews/anytime (all learned words), end-to-end via the seed.
  it('a future-due (not-due) seeded card is served by /api/reviews/anytime but not /api/reviews', async () => {
    const fixture: ScenarioFixture = {
      ...baseFixture,
      reviewCards: [
        { wordId: 'th::หิว', dueOffsetMs: -1000 * 60 * 60 }, // due (an hour ago)
        { wordId: 'th::กิน', dueOffsetMs: 1000 * 60 * 60 * 24 }, // not-due (tomorrow)
      ],
    };

    const res = await seed(fixture);
    expect(res.status).toBe(200);

    const dueBody = (await (await app.request('/api/reviews')).json()) as {
      data: { reviews: Array<{ wordId: string }> };
    };
    const dueIds = dueBody.data.reviews.map((r) => r.wordId);
    expect(dueIds).toContain('th::หิว');
    expect(dueIds).not.toContain('th::กิน'); // not-due excluded from due list

    const anytimeBody = (await (await app.request('/api/reviews/anytime')).json()) as {
      data: { reviews: Array<{ wordId: string }> };
    };
    const anytimeIds = anytimeBody.data.reviews.map((r) => r.wordId);
    expect(anytimeIds).toContain('th::หิว'); // due word present
    expect(anytimeIds).toContain('th::กิน'); // AND the not-due word — the anytime fixture works
  });

  it('is idempotent — calling twice produces same state', async () => {
    await seed(baseFixture);
    const res = await seed(baseFixture);
    expect(res.status).toBe(200);

    const store = new SqliteLearningStore(testDb);
    const states = await store.getAllWordStates('demo-user');
    expect(states.size).toBe(2); // only the seeded words, no duplicates
  });
});

describe('rejected store write propagation', () => {
  it('surfaces a rejected upsertWordState as a 500 error response, not a silently swallowed floating promise', async () => {
    const spy = vi
      .spyOn(SqliteLearningStore.prototype, 'upsertWordState')
      .mockRejectedValueOnce(new Error('simulated write failure'));

    const res = await app.request('/api/state/word', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wordId: 'th::หิว' }),
    });

    expect(res.status).toBe(500);
    const body = await res.json() as { success: boolean; error: { message: string } };
    expect(body.success).toBe(false);
    expect(body.error.message).toContain('simulated write failure');

    spy.mockRestore();
  });
});

describe('POST /api/test/config/shelving', () => {
  it('overrides shelving config and GET returns effective config', async () => {
    const res = await app.request('/api/test/config/shelving', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stagnationBatchWindow: 2, maxShelved: 1 }),
    });
    expect(res.status).toBe(200);

    const getRes = await app.request('/api/test/config/shelving');
    expect(getRes.status).toBe(200);
    const body = await getRes.json() as { success: boolean; data: { stagnationBatchWindow: number; maxShelved: number } };
    expect(body.data.stagnationBatchWindow).toBe(2);
    expect(body.data.maxShelved).toBe(1);
  });

  it('seed fixture config sets override', async () => {
    const fixture: ScenarioFixture = {
      ...baseFixture,
      config: { stagnationBatchWindow: 2 },
    };

    await seed(fixture);

    const getRes = await app.request('/api/test/config/shelving');
    const body = await getRes.json() as { success: boolean; data: { stagnationBatchWindow: number; maxShelved: number } };
    expect(body.data.stagnationBatchWindow).toBe(2);
    expect(body.data.maxShelved).toBe(DEFAULT_SHELVING_CONFIG.maxShelved);
  });
});

describe('DELETE /api/test/config/shelving', () => {
  it('resets config to DEFAULT_SHELVING_CONFIG', async () => {
    // Set an override
    await app.request('/api/test/config/shelving', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stagnationBatchWindow: 1 }),
    });

    // Reset
    const deleteRes = await app.request('/api/test/config/shelving', { method: 'DELETE' });
    expect(deleteRes.status).toBe(204);

    // GET should return defaults
    const getRes = await app.request('/api/test/config/shelving');
    const body = await getRes.json() as { success: boolean; data: { stagnationBatchWindow: number; maxShelved: number } };
    expect(body.data.stagnationBatchWindow).toBe(DEFAULT_SHELVING_CONFIG.stagnationBatchWindow);
    expect(body.data.maxShelved).toBe(DEFAULT_SHELVING_CONFIG.maxShelved);
  });
});
