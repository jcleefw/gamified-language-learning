import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { initDb, schema } from '@gll/db';
import type { ApiResponse } from '@gll/api-contract';
import { parseArtifact, type ReplayArtifact } from '../replay/artifact.js';
import { replayArtifact } from '../replay/replay-artifact.js';
import { makeMemoryLearningStore } from '../replay/memory-store.js';
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

async function answer(wordId: string, correct: boolean, correlationId: string): Promise<void> {
  const res = await app.request('/api/answer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-correlation-id': correlationId },
    body: JSON.stringify({ wordId, correct, latencyMs: 0 }),
  });
  expect(res.status).toBe(200);
}

async function transitions(correlationIds: string[]): Promise<DebugTransitionsResponse> {
  const res = await app.request('/api/debug/transitions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ correlationIds }),
  });
  const body = (await res.json()) as ApiResponse<DebugTransitionsResponse>;
  if (!body.success) throw new Error('expected success');
  return body.data;
}

describe('record → replay round-trip (EP40-ST07)', () => {
  it('a session recorded across the live answer path replays byte-exact on a fresh store', async () => {
    // A recording spanning two "decks" (w1/w2 then w3/w4) — the artifact inputs
    // must span both, and replay must reproduce them with no origin-DB access.
    const cids = ['c1', 'c2', 'c3', 'c4', 'c5'];
    await answer('w1', true, cids[0]);
    await answer('w2', true, cids[1]);
    await answer('w1', true, cids[2]); // second answer to w1 (baseline non-null on this row)
    await answer('w3', true, cids[3]);
    await answer('w4', false, cids[4]);

    const slice = await transitions(cids);
    // The slice spans both decks and every served answer.
    expect(slice.inputs.map((i) => i.wordId)).toEqual(['w1', 'w2', 'w1', 'w3', 'w4']);
    expect(slice.thresholds).not.toBeNull();

    // Assemble exactly as the browser recorder would: server slice + meta + appearance.
    const assembled = {
      version: 1,
      meta: {
        createdAt: '2026-07-12T00:00:00.000Z',
        sessionId: 's-roundtrip',
        phase: 'learning',
        originUserId: 'demo-user',
      },
      thresholds: slice.thresholds,
      baseline: slice.baseline,
      inputs: slice.inputs,
      appearance: [
        { correlationId: 'c1', kind: 'question-served', at: '2026-07-12T00:00:00.000Z', data: { wordId: 'w1' } },
      ],
    };

    // The downloaded JSON passes the DS01 contract parser…
    const artifact: ReplayArtifact = parseArtifact(assembled);

    // …and replays byte-exact on a fresh :memory: store with no origin-DB dependency.
    const result = await replayArtifact(artifact, {
      store: makeMemoryLearningStore(),
      userId: 'replay-user',
    });
    expect(result.ok).toBe(true);
    expect(result.steps).toBe(artifact.inputs.length);
    expect(result.divergence).toBeNull();
  });
});
