import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { initDb, schema, type ResolvedThresholds } from '@gll/db';
import type { WordState } from '@gll/srs-engine-v2/learn';
import type { ApiResponse } from '@gll/api-contract';
import type { DebugTransitionsResponse } from '../routes/debug.js';

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

const THRESHOLDS: ResolvedThresholds = {
  masteryThreshold: 2,
  streakThresholds: { correctStreakThreshold: 2, wrongStreakThreshold: 2, maxMastery: 2 },
};

function ws(wordId: string, mastery: number): WordState {
  return {
    wordId,
    seen: mastery,
    correct: mastery,
    mastery,
    correctStreak: mastery,
    wrongStreak: 0,
    lapses: 0,
  };
}

function insertEvent(row: {
  correlationId: string;
  wordId: string;
  before: WordState | null;
  after: WordState;
  thresholds?: ResolvedThresholds;
}) {
  testDb
    .insert(schema.answer_events)
    .values({
      correlation_id: row.correlationId,
      user_id: 'demo-user',
      word_id: row.wordId,
      correct: true,
      latency_ms: 0,
      before_state: row.before ? JSON.stringify(row.before) : null,
      after_state: JSON.stringify(row.after),
      graduated: false,
      recheck: false,
      resolved_thresholds: JSON.stringify(row.thresholds ?? THRESHOLDS),
      created_at: new Date().toISOString(),
    })
    .run();
}

async function post(correlationIds: unknown): Promise<Response> {
  return app.request('/api/debug/transitions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ correlationIds }),
  });
}

describe('POST /api/debug/transitions (EP40-ST07)', () => {
  it('assembles ordered inputs, a lazy baseline, and uniform thresholds', async () => {
    insertEvent({ correlationId: 'c1', wordId: 'w1', before: null, after: ws('w1', 1) });
    insertEvent({ correlationId: 'c2', wordId: 'w2', before: ws('w2', 0), after: ws('w2', 1) });
    insertEvent({ correlationId: 'c3', wordId: 'w1', before: ws('w1', 1), after: ws('w1', 2) });

    const res = await post(['c1', 'c2', 'c3']);
    expect(res.status).toBe(200);
    const body = (await res.json()) as ApiResponse<DebugTransitionsResponse>;
    if (!body.success) throw new Error('expected success');

    // inputs: one per row, in request order, afterState → recordedAfter.
    expect(body.data.inputs.map((i) => i.correlationId)).toEqual(['c1', 'c2', 'c3']);
    expect(body.data.inputs[2].recordedAfter).toEqual(ws('w1', 2));
    // baseline: first beforeState per touched word; w1's first (c1) was brand-new → skipped.
    expect(body.data.baseline).toEqual([ws('w2', 0)]);
    expect(body.data.thresholds).toEqual(THRESHOLDS);
  });

  it('skips ids with no answer_events row (e.g. sentence serves)', async () => {
    insertEvent({ correlationId: 'c1', wordId: 'w1', before: ws('w1', 0), after: ws('w1', 1) });
    const res = await post(['c0-sentence', 'c1', 'c9-missing']);
    const body = (await res.json()) as ApiResponse<DebugTransitionsResponse>;
    if (!body.success) throw new Error('expected success');
    expect(body.data.inputs.map((i) => i.correlationId)).toEqual(['c1']);
  });

  it('returns 400 when the recording spans a non-uniform threshold set', async () => {
    insertEvent({ correlationId: 'c1', wordId: 'w1', before: ws('w1', 0), after: ws('w1', 1) });
    insertEvent({
      correlationId: 'c2',
      wordId: 'w2',
      before: ws('w2', 0),
      after: ws('w2', 1),
      thresholds: {
        masteryThreshold: 2,
        streakThresholds: { correctStreakThreshold: 3, wrongStreakThreshold: 2, maxMastery: 2 },
      },
    });
    const res = await post(['c1', 'c2']);
    expect(res.status).toBe(400);
  });

  it('returns an empty slice (thresholds null) when no ids match', async () => {
    const res = await post(['nope']);
    const body = (await res.json()) as ApiResponse<DebugTransitionsResponse>;
    if (!body.success) throw new Error('expected success');
    expect(body.data).toEqual({ thresholds: null, baseline: [], inputs: [] });
  });

  it('returns 400 on a malformed body', async () => {
    const res = await post('not-an-array');
    expect(res.status).toBe(400);
  });
});

async function postRecent(body: unknown): Promise<Response> {
  return app.request('/api/debug/transitions-recent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/debug/transitions-recent (EP40 post-hoc dump)', () => {
  it('assembles a replayable slice from the most recent answers, no correlation ids needed', async () => {
    // Un-armed rows carry a null correlation id — the post-hoc path must still recover them.
    insertEvent({ correlationId: '', wordId: 'w1', before: null, after: ws('w1', 1) });
    insertEvent({ correlationId: '', wordId: 'w1', before: ws('w1', 1), after: ws('w1', 2) });

    const res = await postRecent({ lastN: 100 });
    expect(res.status).toBe(200);
    const body = (await res.json()) as ApiResponse<DebugTransitionsResponse>;
    if (!body.success) throw new Error('expected success');

    expect(body.data.inputs.map((i) => i.wordId)).toEqual(['w1', 'w1']);
    expect(body.data.inputs[1].recordedAfter).toEqual(ws('w1', 2));
    expect(body.data.thresholds).toEqual(THRESHOLDS);
  });

  it('honours lastN, taking only the newest rows in application order', async () => {
    insertEvent({ correlationId: '', wordId: 'old', before: null, after: ws('old', 1) });
    insertEvent({ correlationId: '', wordId: 'mid', before: null, after: ws('mid', 1) });
    insertEvent({ correlationId: '', wordId: 'new', before: null, after: ws('new', 1) });

    const res = await postRecent({ lastN: 2 });
    const body = (await res.json()) as ApiResponse<DebugTransitionsResponse>;
    if (!body.success) throw new Error('expected success');
    expect(body.data.inputs.map((i) => i.wordId)).toEqual(['mid', 'new']);
  });

  it('defaults lastN when the body is empty', async () => {
    insertEvent({ correlationId: '', wordId: 'w1', before: null, after: ws('w1', 1) });
    const res = await postRecent({});
    const body = (await res.json()) as ApiResponse<DebugTransitionsResponse>;
    if (!body.success) throw new Error('expected success');
    expect(body.data.inputs).toHaveLength(1);
  });

  it('returns an empty slice when there are no answers yet', async () => {
    const res = await postRecent({ lastN: 50 });
    const body = (await res.json()) as ApiResponse<DebugTransitionsResponse>;
    if (!body.success) throw new Error('expected success');
    expect(body.data).toEqual({ thresholds: null, baseline: [], inputs: [] });
  });

  it('returns 400 on a non-positive lastN', async () => {
    const res = await postRecent({ lastN: -3 });
    expect(res.status).toBe(400);
  });

  it('returns 400 when recent rows span a non-uniform threshold set', async () => {
    insertEvent({ correlationId: '', wordId: 'w1', before: null, after: ws('w1', 1) });
    insertEvent({
      correlationId: '',
      wordId: 'w2',
      before: null,
      after: ws('w2', 1),
      thresholds: {
        masteryThreshold: 2,
        streakThresholds: { correctStreakThreshold: 3, wrongStreakThreshold: 2, maxMastery: 2 },
      },
    });
    const res = await postRecent({ lastN: 100 });
    expect(res.status).toBe(400);
  });
});
