import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { asc } from 'drizzle-orm';
import { describe, it, expect, beforeEach } from 'vitest';
import * as schema from '../schema';
import { initDb } from '../init-db';
import { SqliteReviewAnswerEventStore } from '../sqlite-review-answer-event-store';
import type { ReviewAnswerEventRecord } from '../types/review-answer-event-store';
import type { DbClient } from '../types/db-client';

function makeTestDb(): DbClient {
  const sqlite = new Database(':memory:');
  initDb(sqlite);
  return drizzle(sqlite, { schema }) as DbClient;
}

const record = (
  o: Partial<ReviewAnswerEventRecord> = {},
): ReviewAnswerEventRecord => ({
  correlationId: null,
  userId: 'demo-user',
  wordId: 'w1',
  correct: true,
  latencyMs: 1000,
  questionType: 'mcq',
  rating: 'good',
  createdAt: '2026-07-08T00:00:00.000Z',
  ...o,
});

describe('SqliteReviewAnswerEventStore', () => {
  let db: DbClient;

  beforeEach(() => {
    db = makeTestDb();
  });

  it('defaults to a NoopLogger (constructs and appends with no logger arg)', async () => {
    const store = new SqliteReviewAnswerEventStore(db);
    await expect(
      store.appendReviewAnswerEvent(record()),
    ).resolves.toBeUndefined();
  });

  it('appends one row carrying all fields', async () => {
    const store = new SqliteReviewAnswerEventStore(db);
    await store.appendReviewAnswerEvent(
      record({
        correlationId: 'corr-1',
        correct: false,
        latencyMs: 4200,
        questionType: 'word-block',
        rating: 'again',
      }),
    );

    const rows = db.select().from(schema.review_answer_events).all();
    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row.correlation_id).toBe('corr-1');
    expect(row.user_id).toBe('demo-user');
    expect(row.word_id).toBe('w1');
    expect(row.correct).toBe(false);
    expect(row.latency_ms).toBe(4200);
    expect(row.question_type).toBe('word-block');
    expect(row.rating).toBe('again');
    expect(row.created_at).toBe('2026-07-08T00:00:00.000Z');
  });

  it('orders rows by a monotonic id (append-only)', async () => {
    const store = new SqliteReviewAnswerEventStore(db);
    await store.appendReviewAnswerEvent(record({ wordId: 'a' }));
    await store.appendReviewAnswerEvent(record({ wordId: 'b' }));
    await store.appendReviewAnswerEvent(record({ wordId: 'c' }));

    const rows = db
      .select()
      .from(schema.review_answer_events)
      .orderBy(asc(schema.review_answer_events.id))
      .all();
    expect(rows.map((r) => r.id)).toEqual([1, 2, 3]);
    expect(rows.map((r) => r.word_id)).toEqual(['a', 'b', 'c']);
  });

  it('re-throws on insert failure so the caller owns fail-open', async () => {
    db.$client.exec('DROP TABLE review_answer_events');
    const store = new SqliteReviewAnswerEventStore(db);
    await expect(
      store.appendReviewAnswerEvent(record()),
    ).rejects.toThrow();
  });
});
