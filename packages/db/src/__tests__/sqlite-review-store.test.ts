import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type BetterSqlite3 from 'better-sqlite3';
import { describe, it, expect, beforeEach } from 'vitest';
import * as schema from '../schema';
import { initDb } from '../init-db';
import { SqliteReviewStore } from '../sqlite-review-store';
import type { ReviewCard } from '@gll/srs-review';

type DbClient = BetterSQLite3Database<typeof schema> & { $client: BetterSqlite3.Database };

function makeTestDb(): { db: DbClient; sqlite: BetterSqlite3.Database } {
  const sqlite = new Database(':memory:');
  initDb(sqlite);
  const db = drizzle(sqlite, { schema }) as DbClient;
  return { db, sqlite };
}

const card = (o: Partial<ReviewCard> = {}): ReviewCard => ({
  wordId: 'w1',
  due: new Date('2026-07-08T00:00:00.000Z'),
  schedulerData: { stability: 3, difficulty: 5, state: 2 },
  ...o,
});

describe('SqliteReviewStore', () => {
  let store: SqliteReviewStore;
  let db: DbClient;

  beforeEach(() => {
    ({ db } = makeTestDb());
    store = new SqliteReviewStore(db);
  });

  it('upsert then getReviewCard round-trips due as a Date and schedulerData structurally intact', async () => {
    const c = card();
    await store.upsertReviewCard('user-a', c);
    const result = await store.getReviewCard('user-a', 'w1');

    expect(result).not.toBeNull();
    expect(result!.due).toBeInstanceOf(Date);
    expect(result!.due.getTime()).toBe(c.due.getTime());
    expect(result!.schedulerData).toEqual(c.schedulerData);
    expect(result!.wordId).toBe('w1');
  });

  it('getReviewCard returns null for an unknown (userId, wordId)', async () => {
    const result = await store.getReviewCard('user-a', 'nonexistent');
    expect(result).toBeNull();
  });

  it('second upsert with same (userId, wordId) overwrites — no duplicate rows', async () => {
    await store.upsertReviewCard('user-a', card({ due: new Date('2026-07-08T00:00:00.000Z') }));
    await store.upsertReviewCard('user-a', card({ due: new Date('2026-07-10T00:00:00.000Z') }));

    const all = await store.getAllReviewCards('user-a');
    expect(all).toHaveLength(1);
    expect(all[0].due.toISOString()).toBe('2026-07-10T00:00:00.000Z');
  });

  it('getAllReviewCards returns [] when nothing seeded', async () => {
    const result = await store.getAllReviewCards('user-a');
    expect(result).toEqual([]);
  });

  it('getDueReviewCards excludes due > now, includes due <= now, ordered by due ascending', async () => {
    const now = new Date('2026-07-08T12:00:00.000Z');
    await store.upsertReviewCard('user-a', card({ wordId: 'future', due: new Date('2026-07-09T00:00:00.000Z') }));
    await store.upsertReviewCard('user-a', card({ wordId: 'due-now', due: now }));
    await store.upsertReviewCard('user-a', card({ wordId: 'overdue', due: new Date('2026-07-01T00:00:00.000Z') }));

    const result = await store.getDueReviewCards('user-a', now);

    expect(result.map((c) => c.wordId)).toEqual(['overdue', 'due-now']);
  });

  it('getDueReviewCards is scoped to the given userId', async () => {
    const now = new Date('2026-07-08T12:00:00.000Z');
    await store.upsertReviewCard('user-a', card({ wordId: 'w1', due: new Date('2026-07-01T00:00:00.000Z') }));
    await store.upsertReviewCard('user-b', card({ wordId: 'w2', due: new Date('2026-07-01T00:00:00.000Z') }));

    const result = await store.getDueReviewCards('user-a', now);
    expect(result.map((c) => c.wordId)).toEqual(['w1']);
  });

  it('getDueReviewCardsForDeck returns only words present in deck_words for that deck', async () => {
    const now = new Date('2026-07-08T12:00:00.000Z');
    db.insert(schema.deck_words).values([
      { deck_id: 'deck-1', word_id: 'in-deck' },
    ]).run();

    await store.upsertReviewCard('user-a', card({ wordId: 'in-deck', due: new Date('2026-07-01T00:00:00.000Z') }));
    await store.upsertReviewCard('user-a', card({ wordId: 'not-in-deck', due: new Date('2026-07-01T00:00:00.000Z') }));

    const result = await store.getDueReviewCardsForDeck('user-a', 'deck-1', now);
    expect(result.map((c) => c.wordId)).toEqual(['in-deck']);
  });

  it('getDueReviewCardsForDeck excludes future-due cards within the deck', async () => {
    const now = new Date('2026-07-08T12:00:00.000Z');
    db.insert(schema.deck_words).values([
      { deck_id: 'deck-1', word_id: 'in-deck' },
    ]).run();

    await store.upsertReviewCard('user-a', card({ wordId: 'in-deck', due: new Date('2026-07-09T00:00:00.000Z') }));

    const result = await store.getDueReviewCardsForDeck('user-a', 'deck-1', now);
    expect(result).toEqual([]);
  });
});
