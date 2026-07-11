import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { asc } from 'drizzle-orm';
import { describe, it, expect, beforeEach } from 'vitest';
import * as schema from '../schema';
import { initDb } from '../init-db';
import { SqliteReviewTransitionEventStore } from '../sqlite-review-transition-event-store';
import type { ReviewTransitionEventRecord } from '../types/review-transition-event-store';
import type { DbClient } from '../types/db-client';
import type { ReviewCard } from '@gll/srs-review';

function makeTestDb(): DbClient {
  const sqlite = new Database(':memory:');
  initDb(sqlite);
  return drizzle(sqlite, { schema }) as DbClient;
}

const card = (o: Partial<ReviewCard> = {}): ReviewCard => ({
  wordId: 'w1',
  due: new Date('2026-07-20T00:00:00.000Z'),
  schedulerData: { stability: 3.2, difficulty: 5.1, reps: 1 },
  ...o,
});

const record = (
  o: Partial<ReviewTransitionEventRecord> = {},
): ReviewTransitionEventRecord => ({
  correlationId: null,
  userId: 'demo-user',
  wordId: 'w1',
  beforeCard: card({ due: new Date('2026-07-08T00:00:00.000Z') }),
  afterCard: card({ due: new Date('2026-07-20T00:00:00.000Z') }),
  createdAt: '2026-07-08T00:00:00.000Z',
  ...o,
});

describe('SqliteReviewTransitionEventStore', () => {
  let db: DbClient;

  beforeEach(() => {
    db = makeTestDb();
  });

  it('defaults to a NoopLogger (constructs and appends with no logger arg)', async () => {
    const store = new SqliteReviewTransitionEventStore(db);
    await expect(
      store.appendReviewTransitionEvent(record()),
    ).resolves.toBeUndefined();
  });

  it('appends one row; before/after cards round-trip as JSON', async () => {
    const store = new SqliteReviewTransitionEventStore(db);
    const before = card({ due: new Date('2026-07-08T00:00:00.000Z') });
    const after = card({ due: new Date('2026-07-20T00:00:00.000Z') });
    await store.appendReviewTransitionEvent(
      record({ correlationId: 'corr-1', beforeCard: before, afterCard: after }),
    );

    const rows = db.select().from(schema.review_transition_events).all();
    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row.correlation_id).toBe('corr-1');
    expect(row.user_id).toBe('demo-user');
    expect(row.word_id).toBe('w1');
    expect(row.created_at).toBe('2026-07-08T00:00:00.000Z');
    expect(JSON.parse(row.before_card)).toEqual(JSON.parse(JSON.stringify(before)));
    expect(JSON.parse(row.after_card)).toEqual(JSON.parse(JSON.stringify(after)));
  });

  it('persists a null correlation id (graceful-degrade column)', async () => {
    const store = new SqliteReviewTransitionEventStore(db);
    await store.appendReviewTransitionEvent(record({ correlationId: null }));
    const rows = db.select().from(schema.review_transition_events).all();
    expect(rows[0].correlation_id).toBeNull();
  });

  it('orders rows by a monotonic id (append-only)', async () => {
    const store = new SqliteReviewTransitionEventStore(db);
    await store.appendReviewTransitionEvent(record({ wordId: 'a' }));
    await store.appendReviewTransitionEvent(record({ wordId: 'b' }));
    await store.appendReviewTransitionEvent(record({ wordId: 'c' }));

    const rows = db
      .select()
      .from(schema.review_transition_events)
      .orderBy(asc(schema.review_transition_events.id))
      .all();
    expect(rows.map((r) => r.id)).toEqual([1, 2, 3]);
    expect(rows.map((r) => r.word_id)).toEqual(['a', 'b', 'c']);
  });

  it('re-throws on insert failure so the caller owns fail-open', async () => {
    db.$client.exec('DROP TABLE review_transition_events');
    const store = new SqliteReviewTransitionEventStore(db);
    await expect(
      store.appendReviewTransitionEvent(record()),
    ).rejects.toThrow();
  });
});
