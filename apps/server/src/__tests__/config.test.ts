import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { initDb, schema } from '@gll/db';
import type { ApiResponse } from '@gll/api-contract';
import type { AppConfigResponse } from '../config/learning.js';

type TestDb = ReturnType<typeof drizzle<typeof schema>>;
let testDb: TestDb;

vi.mock('@gll/db', async (importOriginal) => {
  const orig = await importOriginal<typeof import('@gll/db')>();
  return { ...orig, getDb: () => testDb };
});

beforeEach(async () => {
  const sqlite = new Database(':memory:');
  initDb(sqlite);
  testDb = drizzle(sqlite, { schema }) as TestDb;
  // The write path targets an existing users row (put is a no-op otherwise).
  const { seedDemoUser } = await import('../seed/seed-db.js');
  seedDemoUser(testDb);
});

const { default: app } = await import('../app.js');

async function getConfig(): Promise<AppConfigResponse> {
  const res = await app.request('/api/user/config');
  expect(res.status).toBe(200);
  const body = (await res.json()) as ApiResponse<AppConfigResponse>;
  if (!body.success) throw new Error('expected success');
  return body.data;
}

async function put(body: unknown): Promise<Response> {
  return app.request('/api/user/config', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('GET /api/user/config', () => {
  it('resolves the two-section shape for a user with no overrides (default = normal)', async () => {
    const data = await getConfig();

    // user (T1): resolved from base ← overrides; default preset is `normal`.
    expect(data.user).toEqual({
      difficultyPreset: 'normal',
      streakThresholds: { correctStreakThreshold: 2, wrongStreakThreshold: 2, maxMastery: 2 },
      wordsPerBatch: 3,
      sentenceDirections: [
        'english-to-native',
        'romanization-to-native',
        'native-to-romanization',
      ],
    });

    // system (T3): fixed, served read-only.
    expect(data.system).toEqual({
      masteryThreshold: 2,
      maxRetryPerSession: 5,
      maxRetryPerWord: 2,
      sentenceScheduling: { minSeenForSentence: 1, sentenceBatchGap: 2 },
      sentenceGraduation: { sentenceCorrectStreakThreshold: 2, sentenceWrongStreakThreshold: 3 },
    });
  });

  it('drops the pedagogy key (the empty T2 tier is gone)', async () => {
    const data = await getConfig();
    expect(data).not.toHaveProperty('pedagogy');
  });
});

describe('PUT /api/user/config', () => {
  it('persists a valid preset selection and echoes the resolved config', async () => {
    const res = await put({ difficultyPreset: 'normal' });
    expect(res.status).toBe(200);
    const body = (await res.json()) as ApiResponse<AppConfigResponse>;
    if (!body.success) throw new Error('expected success');
    expect(body.data.user.difficultyPreset).toBe('normal');
    expect(body.data.user.streakThresholds).toEqual({
      correctStreakThreshold: 2,
      wrongStreakThreshold: 2,
      maxMastery: 2,
    });
  });

  it('persists a valid standalone pref (partial patch) and reflects it on GET', async () => {
    const res = await put({ wordsPerBatch: 4 });
    expect(res.status).toBe(200);
    const after = await getConfig();
    expect(after.user.wordsPerBatch).toBe(4);
    // Untouched fields keep their defaults.
    expect(after.user.difficultyPreset).toBe('normal');
  });

  it.each([
    ['unknown key (a T3 field)', { masteryThreshold: 5 }],
    ['deferred preset intense', { difficultyPreset: 'intense' }],
    ['deferred preset gentle', { difficultyPreset: 'gentle' }],
    ['unknown preset', { difficultyPreset: 'turbo' }],
    ['out-of-range wordsPerBatch', { wordsPerBatch: 0 }],
    // Empty directions would silently disable all sentence questions — not "no preference".
    ['empty sentenceDirections', { sentenceDirections: [] }],
  ])('rejects %s with 400 and persists nothing', async (_label, payload) => {
    const res = await put(payload);
    expect(res.status).toBe(400);
    // Nothing was written — GET still returns the untouched defaults.
    const after = await getConfig();
    expect(after.user.difficultyPreset).toBe('normal');
    expect(after.user.wordsPerBatch).toBe(3);
  });
});
