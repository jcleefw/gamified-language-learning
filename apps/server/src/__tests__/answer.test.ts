import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { initDb, schema, SqliteLearningStore } from '@gll/db';
import { updateRunState } from '@gll/srs-engine-v2';
import type { AnswerResponse, ApiResponse, WordStatePayload } from '@gll/api-contract';

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

async function post(body: unknown): Promise<Response> {
  return app.request('/api/answer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/answer', () => {
  it('runs the transition server-side, returns and persists the authoritative state', async () => {
    const res = await post({ wordId: 'w1', correct: true, latencyMs: 1200 });
    expect(res.status).toBe(200);

    const body = (await res.json()) as ApiResponse<AnswerResponse>;
    expect(body.success).toBe(true);
    if (!body.success) throw new Error('expected success');

    const expected = updateRunState(new Map(), 'w1', true, {
      correctStreakThreshold: 2,
      wrongStreakThreshold: 2,
      maxMastery: 2,
    }).get('w1');

    const expectedPayload: WordStatePayload = {
      wordId: 'w1',
      seen: expected!.seen,
      correct: expected!.correct,
      mastery: expected!.mastery,
      correctStreak: expected!.correctStreak,
      wrongStreak: expected!.wrongStreak,
      lapses: expected!.lapses,
    };

    expect(body.data.wordState).toEqual(expectedPayload);
    expect(body.data.graduated).toBe(false);

    // Persisted for demo-user
    const persisted = await new SqliteLearningStore(testDb).getAllWordStates('demo-user');
    expect(persisted.get('w1')).toEqual(expected);
  });

  it('graduates on the 3rd consecutive correct (mastery 0→1→2)', async () => {
    const graduated: boolean[] = [];
    const masteries: number[] = [];

    for (let i = 0; i < 3; i++) {
      const res = await post({ wordId: 'w2', correct: true, latencyMs: 1000 });
      const body = (await res.json()) as ApiResponse<AnswerResponse>;
      if (!body.success) throw new Error('expected success');
      graduated.push(body.data.graduated);
      masteries.push(body.data.wordState.mastery);
    }

    expect(masteries).toEqual([0, 1, 2]);
    expect(graduated).toEqual([false, false, true]);
  });

  it('wrong answer: not graduated, wrongStreak advances per engine', async () => {
    const res = await post({ wordId: 'w3', correct: false, latencyMs: 8000 });
    const body = (await res.json()) as ApiResponse<AnswerResponse>;
    if (!body.success) throw new Error('expected success');

    const expected = updateRunState(new Map(), 'w3', false, {
      correctStreakThreshold: 2,
      wrongStreakThreshold: 2,
      maxMastery: 2,
    }).get('w3');

    expect(body.data.graduated).toBe(false);
    expect(body.data.wordState.wrongStreak).toBe(expected!.wrongStreak);
    expect(body.data.wordState.correctStreak).toBe(0);
    expect(body.data.wordState.mastery).toBe(expected!.mastery);
  });

  it('rejects invalid bodies with 400 and leaves persisted state unchanged', async () => {
    const invalid: unknown[] = [
      { wordId: '', correct: true, latencyMs: 100 },
      { wordId: 'w4', correct: 'yes', latencyMs: 100 },
      { wordId: 'w4', correct: true, latencyMs: -1 },
      { wordId: 'w4', correct: true },
      { correct: true, latencyMs: 100 },
    ];

    for (const body of invalid) {
      const res = await post(body);
      expect(res.status).toBe(400);
    }

    const persisted = await new SqliteLearningStore(testDb).getAllWordStates('demo-user');
    expect(persisted.size).toBe(0);
  });

  it('fails open when the transition-channel append fails (state still persisted)', async () => {
    // Drop the events table so appendAnswerEvent throws inside the route.
    testDb.$client.exec('DROP TABLE answer_events');

    const res = await post({ wordId: 'w5', correct: true, latencyMs: 900 });
    expect(res.status).toBe(200);

    const body = (await res.json()) as ApiResponse<AnswerResponse>;
    if (!body.success) throw new Error('expected success');
    expect(body.data.wordState.wordId).toBe('w5');

    // State write is intact despite the event-append failure.
    const persisted = await new SqliteLearningStore(testDb).getAllWordStates('demo-user');
    expect(persisted.get('w5')?.seen).toBe(1);
  });

  it('does not affect the legacy POST /api/state/word path', async () => {
    const res = await app.request('/api/state/word', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wordId: 'legacy', seen: 3, correct: 2, mastery: 1, correctStreak: 1, wrongStreak: 0, lapses: 0 }),
    });
    expect(res.status).toBe(200);

    const persisted = await new SqliteLearningStore(testDb).getAllWordStates('demo-user');
    expect(persisted.get('legacy')?.mastery).toBe(1);
  });
});
