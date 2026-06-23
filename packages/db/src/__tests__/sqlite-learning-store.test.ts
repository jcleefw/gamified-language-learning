import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { describe, it, expect, beforeEach } from 'vitest';
import * as schema from '../schema';
import { initDb } from '../init-db';
import { SqliteLearningStore } from '../sqlite-learning-store';
import type { WordState } from '@gll/srs-engine-v2';
import type { SentenceState } from '@gll/srs-engine-v2';

function makeTestDb() {
  const sqlite = new Database(':memory:');
  initDb(sqlite);
  const db = drizzle(sqlite, { schema });
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
