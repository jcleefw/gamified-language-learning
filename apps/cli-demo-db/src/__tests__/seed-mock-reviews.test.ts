import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type BetterSqlite3 from 'better-sqlite3';
import { describe, it, expect, beforeEach } from 'vitest';
import { schema, initDb, SqliteReviewStore } from '@gll/db';
import { FsrsScheduler } from '@gll/srs-engine/review';
import { seedMockReviews } from '../seed-mock-reviews.js';

const WORD_IDS = ['word:a', 'word:b', 'word:c'];

type DbClient = BetterSQLite3Database<typeof schema> & { $client: BetterSqlite3.Database };

function makeTestDb(): DbClient {
  const sqlite = new Database(':memory:') as unknown as BetterSqlite3.Database;
  initDb(sqlite);
  return drizzle(sqlite, { schema }) as DbClient;
}

const USER = 'cli-user';
const NOW = new Date('2026-07-08T00:00:00.000Z');

describe('seedMockReviews', () => {
  let store: SqliteReviewStore;
  let scheduler: FsrsScheduler;

  beforeEach(() => {
    store = new SqliteReviewStore(makeTestDb());
    scheduler = new FsrsScheduler();
  });

  it('seeds the given word ids as due-now cards', async () => {
    await seedMockReviews(scheduler, store, USER, WORD_IDS, NOW);

    const due = await store.getDueReviewCards(USER, NOW);
    expect(due.map((c) => c.wordId).sort()).toEqual([...WORD_IDS].sort());
    for (const c of due) {
      expect(c.due.getTime()).toBeLessThanOrEqual(NOW.getTime());
    }
  });

  it('produces schedulerData that FsrsScheduler.schedule accepts without throwing', async () => {
    await seedMockReviews(scheduler, store, USER, WORD_IDS, NOW);
    const due = await store.getDueReviewCards(USER, NOW);

    for (const card of due) {
      expect(() => scheduler.schedule(card, 'good', NOW)).not.toThrow();
    }
  });
});
