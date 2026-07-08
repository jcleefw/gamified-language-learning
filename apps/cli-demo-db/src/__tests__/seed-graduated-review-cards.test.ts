import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type BetterSqlite3 from 'better-sqlite3';
import { describe, it, expect, beforeEach } from 'vitest';
import { schema, initDb, SqliteReviewStore } from '@gll/db';
import { FsrsScheduler } from '@gll/srs-review';
import type { WordState, RunState } from '@gll/srs-engine-v2';
import { seedGraduatedReviewCards } from '../seed-graduated-review-cards.js';

type DbClient = BetterSQLite3Database<typeof schema> & { $client: BetterSqlite3.Database };

function makeTestDb(): DbClient {
  const sqlite = new Database(':memory:') as unknown as BetterSqlite3.Database;
  initDb(sqlite);
  return drizzle(sqlite, { schema }) as DbClient;
}

function ws(overrides: Partial<WordState> = {}): WordState {
  return {
    seen: 6,
    correct: 5,
    mastery: 2,
    correctStreak: 3,
    wrongStreak: 0,
    lapses: 1,
    ...overrides,
  } as WordState;
}

const USER = 'cli-user';
const NOW = new Date('2026-07-08T00:00:00.000Z');

describe('seedGraduatedReviewCards', () => {
  let store: SqliteReviewStore;
  let scheduler: FsrsScheduler;

  beforeEach(() => {
    store = new SqliteReviewStore(makeTestDb());
    scheduler = new FsrsScheduler();
  });

  it('seeds and persists one card per graduated word with a future due', async () => {
    const runState: RunState = new Map([
      ['w1', ws()],
      ['w2', ws({ correctStreak: 4 })],
    ]);

    await seedGraduatedReviewCards(['w1', 'w2'], runState, scheduler, store, USER, NOW);

    const all = await store.getAllReviewCards(USER);
    expect(all.map((c) => c.wordId).sort()).toEqual(['w1', 'w2']);
    for (const c of all) {
      expect(c.due.getTime()).toBeGreaterThan(NOW.getTime());
    }
  });

  it('does not create a card for a word absent from runState', async () => {
    const runState: RunState = new Map([['w1', ws()]]);

    await seedGraduatedReviewCards(['w1', 'missing'], runState, scheduler, store, USER, NOW);

    const all = await store.getAllReviewCards(USER);
    expect(all.map((c) => c.wordId)).toEqual(['w1']);
  });
});
