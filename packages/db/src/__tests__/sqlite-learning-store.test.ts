import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type BetterSqlite3 from 'better-sqlite3';
import { describe, it, expect, beforeEach } from 'vitest';
import * as schema from '../schema';
import { initDb } from '../init-db';
import { SqliteLearningStore } from '../sqlite-learning-store';
import type { WordState } from '@gll/srs-engine-v2';
import type { SentenceState } from '@gll/srs-engine-v2';

type DbClient = BetterSQLite3Database<typeof schema> & { $client: BetterSqlite3.Database };

function makeTestDb(): { db: DbClient; sqlite: BetterSqlite3.Database } {
  const sqlite = new Database(':memory:');
  initDb(sqlite);
  const db = drizzle(sqlite, { schema }) as DbClient;
  return { db, sqlite };
}

describe('SqliteLearningStore', () => {
  let store: SqliteLearningStore;

  beforeEach(() => {
    const { db } = makeTestDb();
    store = new SqliteLearningStore(db);
  });

  it('upsert then getAll returns same WordState including lapses', async () => {
    const ws: WordState = {
      wordId: 'word-1',
      seen: 10,
      correct: 7,
      mastery: 3,
      correctStreak: 2,
      wrongStreak: 0,
      lapses: 4,
    };

    await store.upsertWordState('user-a', ws);
    const result = await store.getAllWordStates('user-a');

    expect(result.get('word-1')).toEqual(ws);
  });

  it('upsert then getAll returns same SentenceState with active:false and lastBatchSeen:-1', async () => {
    const ss: SentenceState = {
      sentenceId: 'sent-1',
      sentenceStreak: 5,
      lastBatchSeen: -1,
      dailyCount: 2,
      sessionWrongStreak: 0,
      active: false,
    };

    await store.upsertSentenceState('user-a', ss);
    const result = await store.getAllSentenceStates('user-a');

    expect(result.get('sent-1')).toEqual(ss);
  });

  it('second upsert with same (userId, wordId) overwrites — no duplicate rows', async () => {
    const ws1: WordState = {
      wordId: 'word-1',
      seen: 1,
      correct: 1,
      mastery: 1,
      correctStreak: 1,
      wrongStreak: 0,
      lapses: 0,
    };
    const ws2: WordState = {
      wordId: 'word-1',
      seen: 5,
      correct: 3,
      mastery: 2,
      correctStreak: 0,
      wrongStreak: 1,
      lapses: 1,
    };

    await store.upsertWordState('user-a', ws1);
    await store.upsertWordState('user-a', ws2);
    const result = await store.getAllWordStates('user-a');

    expect(result.size).toBe(1);
    expect(result.get('word-1')).toEqual(ws2);
  });

  it('a rejected store write propagates as a rejected promise, not a swallowed error', async () => {
    const badDb = {
      insert: () => {
        throw new Error('simulated write failure');
      },
    } as unknown as DbClient;
    const failingStore = new SqliteLearningStore(badDb);

    await expect(
      failingStore.upsertWordState('user-a', {
        wordId: 'word-1',
        seen: 1,
        correct: 1,
        mastery: 1,
        correctStreak: 1,
        wrongStreak: 0,
        lapses: 0,
      }),
    ).rejects.toThrow('simulated write failure');
  });
});

describe('shelving (deck-scoped)', () => {
  let store: SqliteLearningStore;

  beforeEach(() => {
    const { db } = makeTestDb();
    store = new SqliteLearningStore(db);
  });

  it('shelveWord + getShelvedWords round-trips', async () => {
    await store.shelveWord('user-a', 'deck-1', 'w1', 3);
    const result = await store.getShelvedWords('user-a', 'deck-1');
    expect(result).toEqual([{ wordId: 'w1', shelvedAtBatch: 3 }]);
  });

  it('getShelvedWords returns [] when nothing shelved', async () => {
    const result = await store.getShelvedWords('user-a', 'deck-1');
    expect(result).toEqual([]);
  });

  it('shelving same word twice upserts — single entry with latest batch', async () => {
    await store.shelveWord('user-a', 'deck-1', 'w1', 3);
    await store.shelveWord('user-a', 'deck-1', 'w1', 5);
    const result = await store.getShelvedWords('user-a', 'deck-1');
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ wordId: 'w1', shelvedAtBatch: 5 });
  });

  it('unshelveWord removes one word, leaves others', async () => {
    await store.shelveWord('user-a', 'deck-1', 'w1', 1);
    await store.shelveWord('user-a', 'deck-1', 'w2', 2);
    await store.unshelveWord('user-a', 'deck-1', 'w1');
    const result = await store.getShelvedWords('user-a', 'deck-1');
    expect(result).toEqual([{ wordId: 'w2', shelvedAtBatch: 2 }]);
  });

  it('unshelveWord on non-shelved word is a no-op — no error thrown', async () => {
    await store.unshelveWord('user-a', 'deck-1', 'w-nonexistent');
  });

  it('unshelveAllWords clears all for a user+deck', async () => {
    await store.shelveWord('user-a', 'deck-1', 'w1', 1);
    await store.shelveWord('user-a', 'deck-1', 'w2', 2);
    await store.shelveWord('user-a', 'deck-1', 'w3', 3);
    await store.unshelveAllWords('user-a', 'deck-1');
    expect(await store.getShelvedWords('user-a', 'deck-1')).toEqual([]);
  });

  it('unshelveAllWords does not affect other users', async () => {
    await store.shelveWord('user-a', 'deck-1', 'w1', 1);
    await store.shelveWord('user-b', 'deck-1', 'w2', 2);
    await store.unshelveAllWords('user-a', 'deck-1');
    expect(await store.getShelvedWords('user-a', 'deck-1')).toEqual([]);
    expect(await store.getShelvedWords('user-b', 'deck-1')).toEqual([{ wordId: 'w2', shelvedAtBatch: 2 }]);
  });

  it('unshelveAllWords does not affect other decks for same user', async () => {
    await store.shelveWord('user-a', 'deck-1', 'w1', 1);
    await store.shelveWord('user-a', 'deck-2', 'w2', 2);
    await store.unshelveAllWords('user-a', 'deck-1');
    expect(await store.getShelvedWords('user-a', 'deck-1')).toEqual([]);
    expect(await store.getShelvedWords('user-a', 'deck-2')).toEqual([{ wordId: 'w2', shelvedAtBatch: 2 }]);
  });

  it('clearUserState also clears shelved words', async () => {
    await store.shelveWord('user-a', 'deck-1', 'w1', 1);
    await store.clearUserState('user-a');
    expect(await store.getShelvedWords('user-a', 'deck-1')).toEqual([]);
  });

  it('getShelvedWords returns multiple words with correct data', async () => {
    await store.shelveWord('user-a', 'deck-1', 'w1', 1);
    await store.shelveWord('user-a', 'deck-1', 'w2', 2);
    await store.shelveWord('user-a', 'deck-1', 'w3', 3);
    const result = await store.getShelvedWords('user-a', 'deck-1');
    expect(result).toHaveLength(3);
    expect(result).toContainEqual({ wordId: 'w1', shelvedAtBatch: 1 });
    expect(result).toContainEqual({ wordId: 'w2', shelvedAtBatch: 2 });
    expect(result).toContainEqual({ wordId: 'w3', shelvedAtBatch: 3 });
  });
});

describe('stagnation counters', () => {
  let store: SqliteLearningStore;

  beforeEach(() => {
    const { db } = makeTestDb();
    store = new SqliteLearningStore(db);
  });

  async function seedWordState(store: SqliteLearningStore, userId: string, wordId: string, mastery: number): Promise<void> {
    await store.upsertWordState(userId, {
      wordId,
      seen: 1,
      correct: 1,
      mastery,
      correctStreak: 1,
      wrongStreak: 0,
      lapses: 0,
    });
  }

  it('counter increments when mastery is unchanged at batch boundary', async () => {
    await seedWordState(store, 'user-a', 'w1', 2);
    await store.updateStagnationCounters('user-a', 'deck-1', ['w1']);
    await store.updateStagnationCounters('user-a', 'deck-1', ['w1']);
    const stagnant = await store.getStagnantWords('user-a', 'deck-1', 2);
    expect(stagnant).toContain('w1');
  });

  it('counter resets to 0 when mastery changes', async () => {
    await seedWordState(store, 'user-a', 'w1', 1);
    await store.updateStagnationCounters('user-a', 'deck-1', ['w1']);
    await store.updateStagnationCounters('user-a', 'deck-1', ['w1']);

    // Mastery advances
    await seedWordState(store, 'user-a', 'w1', 2);
    await store.updateStagnationCounters('user-a', 'deck-1', ['w1']);

    // Only 1 batch at new mastery — should not be stagnant at threshold 2
    const stagnant = await store.getStagnantWords('user-a', 'deck-1', 2);
    expect(stagnant).not.toContain('w1');
  });

  it('getStagnantWords returns word IDs with stagnation_count >= threshold', async () => {
    await seedWordState(store, 'user-a', 'w1', 0);
    await seedWordState(store, 'user-a', 'w2', 0);
    // w1: 3 boundaries with same mastery
    await store.updateStagnationCounters('user-a', 'deck-1', ['w1', 'w2']);
    await store.updateStagnationCounters('user-a', 'deck-1', ['w1', 'w2']);
    await store.updateStagnationCounters('user-a', 'deck-1', ['w1']);
    // w1 count=3, w2 count=2
    expect(await store.getStagnantWords('user-a', 'deck-1', 3)).toContain('w1');
    expect(await store.getStagnantWords('user-a', 'deck-1', 3)).not.toContain('w2');
  });

  it('getStagnantWords returns [] when no words meet threshold', async () => {
    await seedWordState(store, 'user-a', 'w1', 0);
    await store.updateStagnationCounters('user-a', 'deck-1', ['w1']);
    expect(await store.getStagnantWords('user-a', 'deck-1', 3)).toEqual([]);
  });

  it('resetStagnationCounters zeroes all counters for user+deck', async () => {
    await seedWordState(store, 'user-a', 'w1', 0);
    await store.updateStagnationCounters('user-a', 'deck-1', ['w1']);
    await store.updateStagnationCounters('user-a', 'deck-1', ['w1']);
    await store.updateStagnationCounters('user-a', 'deck-1', ['w1']);
    await store.resetStagnationCounters('user-a', 'deck-1');
    expect(await store.getStagnantWords('user-a', 'deck-1', 1)).toEqual([]);
  });

  it('stagnation is deck-scoped — deck-2 is unaffected by deck-1 counters', async () => {
    await seedWordState(store, 'user-a', 'w1', 0);
    await store.updateStagnationCounters('user-a', 'deck-1', ['w1']);
    await store.updateStagnationCounters('user-a', 'deck-1', ['w1']);
    await store.updateStagnationCounters('user-a', 'deck-1', ['w1']);
    expect(await store.getStagnantWords('user-a', 'deck-1', 3)).toContain('w1');
    expect(await store.getStagnantWords('user-a', 'deck-2', 3)).not.toContain('w1');
  });

  it('clearUserState clears stagnation counters', async () => {
    await seedWordState(store, 'user-a', 'w1', 0);
    await store.updateStagnationCounters('user-a', 'deck-1', ['w1']);
    await store.updateStagnationCounters('user-a', 'deck-1', ['w1']);
    await store.updateStagnationCounters('user-a', 'deck-1', ['w1']);
    await store.clearUserState('user-a');
    expect(await store.getStagnantWords('user-a', 'deck-1', 1)).toEqual([]);
  });

  it('resetStagnationCountersForWords resets only the specified word, leaves others', async () => {
    await seedWordState(store, 'user-a', 'w1', 0);
    await seedWordState(store, 'user-a', 'w2', 0);
    await store.updateStagnationCounters('user-a', 'deck-1', ['w1', 'w2']);
    await store.updateStagnationCounters('user-a', 'deck-1', ['w1', 'w2']);
    await store.updateStagnationCounters('user-a', 'deck-1', ['w1', 'w2']);
    await store.resetStagnationCountersForWords('user-a', 'deck-1', ['w1']);
    expect(await store.getStagnantWords('user-a', 'deck-1', 3)).not.toContain('w1');
    expect(await store.getStagnantWords('user-a', 'deck-1', 3)).toContain('w2');
  });

  it('resetStagnationCountersForWords with empty array is a no-op', async () => {
    await seedWordState(store, 'user-a', 'w1', 0);
    await store.updateStagnationCounters('user-a', 'deck-1', ['w1']);
    await store.updateStagnationCounters('user-a', 'deck-1', ['w1']);
    await store.updateStagnationCounters('user-a', 'deck-1', ['w1']);
    await store.resetStagnationCountersForWords('user-a', 'deck-1', []);
    expect(await store.getStagnantWords('user-a', 'deck-1', 3)).toContain('w1');
  });
});
