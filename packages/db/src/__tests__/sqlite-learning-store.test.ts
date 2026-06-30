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

  it('upsert then getAll returns same WordState including lapses', () => {
    const ws: WordState = {
      wordId: 'word-1',
      seen: 10,
      correct: 7,
      mastery: 3,
      correctStreak: 2,
      wrongStreak: 0,
      lapses: 4,
    };

    store.upsertWordState('user-a', ws);
    const result = store.getAllWordStates('user-a');

    expect(result.get('word-1')).toEqual(ws);
  });

  it('upsert then getAll returns same SentenceState with active:false and lastBatchSeen:-1', () => {
    const ss: SentenceState = {
      sentenceId: 'sent-1',
      sentenceStreak: 5,
      lastBatchSeen: -1,
      dailyCount: 2,
      sessionWrongStreak: 0,
      active: false,
    };

    store.upsertSentenceState('user-a', ss);
    const result = store.getAllSentenceStates('user-a');

    expect(result.get('sent-1')).toEqual(ss);
  });

  it('second upsert with same (userId, wordId) overwrites — no duplicate rows', () => {
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

    store.upsertWordState('user-a', ws1);
    store.upsertWordState('user-a', ws2);
    const result = store.getAllWordStates('user-a');

    expect(result.size).toBe(1);
    expect(result.get('word-1')).toEqual(ws2);
  });
});

describe('shelving (deck-scoped)', () => {
  let store: SqliteLearningStore;

  beforeEach(() => {
    const { db } = makeTestDb();
    store = new SqliteLearningStore(db);
  });

  it('shelveWord + getShelvedWords round-trips', () => {
    store.shelveWord('user-a', 'deck-1', 'w1', 3);
    const result = store.getShelvedWords('user-a', 'deck-1');
    expect(result).toEqual([{ wordId: 'w1', shelvedAtBatch: 3 }]);
  });

  it('getShelvedWords returns [] when nothing shelved', () => {
    const result = store.getShelvedWords('user-a', 'deck-1');
    expect(result).toEqual([]);
  });

  it('shelving same word twice upserts — single entry with latest batch', () => {
    store.shelveWord('user-a', 'deck-1', 'w1', 3);
    store.shelveWord('user-a', 'deck-1', 'w1', 5);
    const result = store.getShelvedWords('user-a', 'deck-1');
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ wordId: 'w1', shelvedAtBatch: 5 });
  });

  it('unshelveWord removes one word, leaves others', () => {
    store.shelveWord('user-a', 'deck-1', 'w1', 1);
    store.shelveWord('user-a', 'deck-1', 'w2', 2);
    store.unshelveWord('user-a', 'deck-1', 'w1');
    const result = store.getShelvedWords('user-a', 'deck-1');
    expect(result).toEqual([{ wordId: 'w2', shelvedAtBatch: 2 }]);
  });

  it('unshelveWord on non-shelved word is a no-op — no error thrown', () => {
    expect(() => { store.unshelveWord('user-a', 'deck-1', 'w-nonexistent'); }).not.toThrow();
  });

  it('unshelveAllWords clears all for a user+deck', () => {
    store.shelveWord('user-a', 'deck-1', 'w1', 1);
    store.shelveWord('user-a', 'deck-1', 'w2', 2);
    store.shelveWord('user-a', 'deck-1', 'w3', 3);
    store.unshelveAllWords('user-a', 'deck-1');
    expect(store.getShelvedWords('user-a', 'deck-1')).toEqual([]);
  });

  it('unshelveAllWords does not affect other users', () => {
    store.shelveWord('user-a', 'deck-1', 'w1', 1);
    store.shelveWord('user-b', 'deck-1', 'w2', 2);
    store.unshelveAllWords('user-a', 'deck-1');
    expect(store.getShelvedWords('user-a', 'deck-1')).toEqual([]);
    expect(store.getShelvedWords('user-b', 'deck-1')).toEqual([{ wordId: 'w2', shelvedAtBatch: 2 }]);
  });

  it('unshelveAllWords does not affect other decks for same user', () => {
    store.shelveWord('user-a', 'deck-1', 'w1', 1);
    store.shelveWord('user-a', 'deck-2', 'w2', 2);
    store.unshelveAllWords('user-a', 'deck-1');
    expect(store.getShelvedWords('user-a', 'deck-1')).toEqual([]);
    expect(store.getShelvedWords('user-a', 'deck-2')).toEqual([{ wordId: 'w2', shelvedAtBatch: 2 }]);
  });

  it('clearUserState also clears shelved words', () => {
    store.shelveWord('user-a', 'deck-1', 'w1', 1);
    store.clearUserState('user-a');
    expect(store.getShelvedWords('user-a', 'deck-1')).toEqual([]);
  });

  it('getShelvedWords returns multiple words with correct data', () => {
    store.shelveWord('user-a', 'deck-1', 'w1', 1);
    store.shelveWord('user-a', 'deck-1', 'w2', 2);
    store.shelveWord('user-a', 'deck-1', 'w3', 3);
    const result = store.getShelvedWords('user-a', 'deck-1');
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

  function seedWordState(store: SqliteLearningStore, userId: string, wordId: string, mastery: number): void {
    store.upsertWordState(userId, {
      wordId,
      seen: 1,
      correct: 1,
      mastery,
      correctStreak: 1,
      wrongStreak: 0,
      lapses: 0,
    });
  }

  it('counter increments when mastery is unchanged at batch boundary', () => {
    seedWordState(store, 'user-a', 'w1', 2);
    store.updateStagnationCounters('user-a', 'deck-1', ['w1']);
    store.updateStagnationCounters('user-a', 'deck-1', ['w1']);
    const stagnant = store.getStagnantWords('user-a', 'deck-1', 2);
    expect(stagnant).toContain('w1');
  });

  it('counter resets to 0 when mastery changes', () => {
    seedWordState(store, 'user-a', 'w1', 1);
    store.updateStagnationCounters('user-a', 'deck-1', ['w1']);
    store.updateStagnationCounters('user-a', 'deck-1', ['w1']);

    // Mastery advances
    seedWordState(store, 'user-a', 'w1', 2);
    store.updateStagnationCounters('user-a', 'deck-1', ['w1']);

    // Only 1 batch at new mastery — should not be stagnant at threshold 2
    const stagnant = store.getStagnantWords('user-a', 'deck-1', 2);
    expect(stagnant).not.toContain('w1');
  });

  it('getStagnantWords returns word IDs with stagnation_count >= threshold', () => {
    seedWordState(store, 'user-a', 'w1', 0);
    seedWordState(store, 'user-a', 'w2', 0);
    // w1: 3 boundaries with same mastery
    store.updateStagnationCounters('user-a', 'deck-1', ['w1', 'w2']);
    store.updateStagnationCounters('user-a', 'deck-1', ['w1', 'w2']);
    store.updateStagnationCounters('user-a', 'deck-1', ['w1']);
    // w1 count=3, w2 count=2
    expect(store.getStagnantWords('user-a', 'deck-1', 3)).toContain('w1');
    expect(store.getStagnantWords('user-a', 'deck-1', 3)).not.toContain('w2');
  });

  it('getStagnantWords returns [] when no words meet threshold', () => {
    seedWordState(store, 'user-a', 'w1', 0);
    store.updateStagnationCounters('user-a', 'deck-1', ['w1']);
    expect(store.getStagnantWords('user-a', 'deck-1', 3)).toEqual([]);
  });

  it('resetStagnationCounters zeroes all counters for user+deck', () => {
    seedWordState(store, 'user-a', 'w1', 0);
    store.updateStagnationCounters('user-a', 'deck-1', ['w1']);
    store.updateStagnationCounters('user-a', 'deck-1', ['w1']);
    store.updateStagnationCounters('user-a', 'deck-1', ['w1']);
    store.resetStagnationCounters('user-a', 'deck-1');
    expect(store.getStagnantWords('user-a', 'deck-1', 1)).toEqual([]);
  });

  it('stagnation is deck-scoped — deck-2 is unaffected by deck-1 counters', () => {
    seedWordState(store, 'user-a', 'w1', 0);
    store.updateStagnationCounters('user-a', 'deck-1', ['w1']);
    store.updateStagnationCounters('user-a', 'deck-1', ['w1']);
    store.updateStagnationCounters('user-a', 'deck-1', ['w1']);
    expect(store.getStagnantWords('user-a', 'deck-1', 3)).toContain('w1');
    expect(store.getStagnantWords('user-a', 'deck-2', 3)).not.toContain('w1');
  });

  it('clearUserState clears stagnation counters', () => {
    seedWordState(store, 'user-a', 'w1', 0);
    store.updateStagnationCounters('user-a', 'deck-1', ['w1']);
    store.updateStagnationCounters('user-a', 'deck-1', ['w1']);
    store.updateStagnationCounters('user-a', 'deck-1', ['w1']);
    store.clearUserState('user-a');
    expect(store.getStagnantWords('user-a', 'deck-1', 1)).toEqual([]);
  });
});
