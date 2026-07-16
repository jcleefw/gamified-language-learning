import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { asc } from 'drizzle-orm';
import { describe, it, expect, beforeEach } from 'vitest';
import { updateRunState, type WordState } from '@gll/srs-engine-v2/learn';
import * as schema from '../schema';
import { initDb } from '../init-db';
import { SqliteAnswerEventStore } from '../sqlite-answer-event-store';
import type { AnswerEventRecord } from '../types/answer-event-store';
import type { DbClient } from '../types/db-client';

function makeTestDb(): DbClient {
  const sqlite = new Database(':memory:');
  initDb(sqlite);
  return drizzle(sqlite, { schema }) as DbClient;
}

const THRESHOLDS = {
  correctStreakThreshold: 2,
  wrongStreakThreshold: 2,
  maxMastery: 2,
};

const record = (o: Partial<AnswerEventRecord> = {}): AnswerEventRecord => ({
  correlationId: null,
  userId: 'demo-user',
  wordId: 'w1',
  correct: true,
  latencyMs: 1000,
  beforeState: null,
  afterState: {
    wordId: 'w1',
    seen: 1,
    correct: 1,
    mastery: 0,
    correctStreak: 1,
    wrongStreak: 0,
    lapses: 0,
  },
  graduated: false,
  recheck: false,
  resolvedThresholds: { masteryThreshold: 2, streakThresholds: THRESHOLDS },
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
      record({
        correlationId: 'corr-1',
        correct: true,
        latencyMs: 1500,
        graduated: false,
      }),
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

  it('persists the resolved thresholds the transition was computed under (round-trip)', async () => {
    const store = new SqliteAnswerEventStore(db);
    const resolvedThresholds = {
      masteryThreshold: 2,
      streakThresholds: { correctStreakThreshold: 3, wrongStreakThreshold: 1, maxMastery: 2 },
    };
    await store.appendAnswerEvent(record({ resolvedThresholds }));

    const rows = db.select().from(schema.answer_events).all();
    expect(JSON.parse(rows[0].resolved_thresholds)).toEqual(resolvedThresholds);
  });

  it('orders rows by a monotonic id', async () => {
    const store = new SqliteAnswerEventStore(db);
    await store.appendAnswerEvent(record({ wordId: 'a' }));
    await store.appendAnswerEvent(record({ wordId: 'b' }));
    await store.appendAnswerEvent(record({ wordId: 'c' }));

    const rows = db
      .select()
      .from(schema.answer_events)
      .orderBy(asc(schema.answer_events.id))
      .all();
    expect(rows.map((r) => r.id)).toEqual([1, 2, 3]);
    expect(rows.map((r) => r.word_id)).toEqual(['a', 'b', 'c']);
  });

  describe('getAnswerEventsByCorrelationIds (EP40-ST07)', () => {
    it('returns matching rows for the user in id order, parsing JSON fields', async () => {
      const store = new SqliteAnswerEventStore(db);
      await store.appendAnswerEvent(record({ correlationId: 'c1', wordId: 'w1', beforeState: null }));
      await store.appendAnswerEvent(
        record({
          correlationId: 'c2',
          wordId: 'w2',
          beforeState: { wordId: 'w2', seen: 0, correct: 0, mastery: 0, correctStreak: 0, wrongStreak: 0, lapses: 0 },
        }),
      );

      const out = await store.getAnswerEventsByCorrelationIds('demo-user', ['c2', 'c1']);
      // Ordered by insertion id, not the request order.
      expect(out.map((r) => r.correlationId)).toEqual(['c1', 'c2']);
      expect(out[0].beforeState).toBeNull();
      expect(out[1].beforeState?.wordId).toBe('w2');
      expect(out[1].resolvedThresholds.masteryThreshold).toBe(2);
    });

    it('scopes to the given user and ignores unknown ids', async () => {
      const store = new SqliteAnswerEventStore(db);
      await store.appendAnswerEvent(record({ correlationId: 'c1', userId: 'demo-user' }));
      await store.appendAnswerEvent(record({ correlationId: 'c2', userId: 'other-user' }));

      const out = await store.getAnswerEventsByCorrelationIds('demo-user', ['c1', 'c2', 'nope']);
      expect(out.map((r) => r.correlationId)).toEqual(['c1']);
    });

    it('returns [] for an empty id list without touching the db', async () => {
      const store = new SqliteAnswerEventStore(db);
      await store.appendAnswerEvent(record({ correlationId: 'c1' }));
      expect(await store.getAnswerEventsByCorrelationIds('demo-user', [])).toEqual([]);
    });
  });

  describe('getRecentAnswerEvents (EP40 post-hoc dump)', () => {
    it('returns the most recent `limit` rows in application (id ascending) order', async () => {
      const store = new SqliteAnswerEventStore(db);
      for (const wordId of ['a', 'b', 'c', 'd']) {
        await store.appendAnswerEvent(record({ wordId }));
      }
      // Newest 2 rows are c, d — returned oldest-first so a fold applies them in order.
      const out = await store.getRecentAnswerEvents('demo-user', 2);
      expect(out.map((r) => r.wordId)).toEqual(['c', 'd']);
    });

    it('returns all rows in id order when limit exceeds the row count', async () => {
      const store = new SqliteAnswerEventStore(db);
      await store.appendAnswerEvent(record({ wordId: 'a' }));
      await store.appendAnswerEvent(record({ wordId: 'b' }));
      const out = await store.getRecentAnswerEvents('demo-user', 100);
      expect(out.map((r) => r.wordId)).toEqual(['a', 'b']);
    });

    it('recovers rows with a null correlationId (the un-armed / post-hoc case)', async () => {
      const store = new SqliteAnswerEventStore(db);
      await store.appendAnswerEvent(record({ correlationId: null, wordId: 'a' }));
      const out = await store.getRecentAnswerEvents('demo-user', 10);
      expect(out).toHaveLength(1);
      expect(out[0].correlationId).toBeNull();
      expect(out[0].afterState.wordId).toBe('w1');
    });

    it('scopes to the given user', async () => {
      const store = new SqliteAnswerEventStore(db);
      await store.appendAnswerEvent(record({ wordId: 'mine', userId: 'demo-user' }));
      await store.appendAnswerEvent(record({ wordId: 'theirs', userId: 'other-user' }));
      const out = await store.getRecentAnswerEvents('demo-user', 10);
      expect(out.map((r) => r.wordId)).toEqual(['mine']);
    });

    it('returns [] for a non-positive limit without touching the db', async () => {
      const store = new SqliteAnswerEventStore(db);
      await store.appendAnswerEvent(record());
      expect(await store.getRecentAnswerEvents('demo-user', 0)).toEqual([]);
    });
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
      await store.appendAnswerEvent(
        record({ correct, beforeState: before, afterState: after }),
      );
    }

    // Replay from scratch.
    const rows = db
      .select()
      .from(schema.answer_events)
      .orderBy(asc(schema.answer_events.id))
      .all();
    let replay = new Map<string, WordState>();
    for (const row of rows) {
      replay = updateRunState(replay, row.word_id, row.correct, THRESHOLDS);
      expect(replay.get(row.word_id)).toEqual(JSON.parse(row.after_state));
    }
    expect(rows).toHaveLength(3);
  });
});
