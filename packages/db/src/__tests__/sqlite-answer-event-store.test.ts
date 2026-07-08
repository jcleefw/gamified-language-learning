import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { asc } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type BetterSqlite3 from 'better-sqlite3';
import { describe, it, expect, beforeEach } from 'vitest';
import { updateRunState, type WordState } from '@gll/srs-engine-v2';
import * as schema from '../schema';
import { initDb } from '../init-db';
import { SqliteAnswerEventStore, type AnswerEventRecord } from '../answer-event-store';

type DbClient = BetterSQLite3Database<typeof schema> & { $client: BetterSqlite3.Database };

function makeTestDb(): DbClient {
  const sqlite = new Database(':memory:');
  initDb(sqlite);
  return drizzle(sqlite, { schema }) as DbClient;
}

const THRESHOLDS = { correctStreakThreshold: 2, wrongStreakThreshold: 2, maxMastery: 2 };

const record = (o: Partial<AnswerEventRecord> = {}): AnswerEventRecord => ({
  correlationId: null,
  userId: 'demo-user',
  wordId: 'w1',
  correct: true,
  latencyMs: 1000,
  beforeState: null,
  afterState: { wordId: 'w1', seen: 1, correct: 1, mastery: 0, correctStreak: 1, wrongStreak: 0, lapses: 0 },
  graduated: false,
  recheck: false,
  createdAt: '2026-07-08T00:00:00.000Z',
  ...o,
});

describe('SqliteAnswerEventStore', () => {
  let db: DbClient;

  beforeEach(() => {
    db = makeTestDb();
  });

  it('defaults to a NoopLogger (constructs and appends with no logger arg)', async () => {
    const store = new SqliteAnswerEventStore(db);
    await expect(store.appendAnswerEvent(record())).resolves.toBeUndefined();
  });

  it('appends one row with before/after JSON and all fields', async () => {
    const store = new SqliteAnswerEventStore(db);
    await store.appendAnswerEvent(
      record({ correlationId: 'corr-1', correct: true, latencyMs: 1500, graduated: false }),
    );

    const rows = db.select().from(schema.answer_events).all();
    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row.correlation_id).toBe('corr-1');
    expect(row.user_id).toBe('demo-user');
    expect(row.word_id).toBe('w1');
    expect(row.correct).toBe(true);
    expect(row.latency_ms).toBe(1500);
    expect(row.before_state).toBeNull();
    expect(JSON.parse(row.after_state)).toEqual(record().afterState);
    expect(row.graduated).toBe(false);
    expect(row.created_at).toBe('2026-07-08T00:00:00.000Z');
  });

  it('orders rows by a monotonic id', async () => {
    const store = new SqliteAnswerEventStore(db);
    await store.appendAnswerEvent(record({ wordId: 'a' }));
    await store.appendAnswerEvent(record({ wordId: 'b' }));
    await store.appendAnswerEvent(record({ wordId: 'c' }));

    const rows = db.select().from(schema.answer_events).orderBy(asc(schema.answer_events.id)).all();
    expect(rows.map((r) => r.id)).toEqual([1, 2, 3]);
    expect(rows.map((r) => r.word_id)).toEqual(['a', 'b', 'c']);
  });

  it('replay: folding updateRunState over events in id order reproduces stored afterState', async () => {
    const store = new SqliteAnswerEventStore(db);

    // Simulate a real answer sequence for w1: correct, wrong, correct.
    const answers = [true, false, true];
    let run = new Map<string, WordState>();
    for (const correct of answers) {
      const before = run.get('w1') ?? null;
      run = updateRunState(run, 'w1', correct, THRESHOLDS);
      const after = run.get('w1')!;
      await store.appendAnswerEvent(record({ correct, beforeState: before, afterState: after }));
    }

    // Replay from scratch.
    const rows = db.select().from(schema.answer_events).orderBy(asc(schema.answer_events.id)).all();
    let replay = new Map<string, WordState>();
    for (const row of rows) {
      replay = updateRunState(replay, row.word_id, row.correct, THRESHOLDS);
      expect(replay.get(row.word_id)).toEqual(JSON.parse(row.after_state));
    }
    expect(rows).toHaveLength(3);
  });
});
