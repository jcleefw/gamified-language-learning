import { describe, it, expect, afterAll } from 'vitest';
import { existsSync, unlinkSync } from 'fs';
import { SqliteLearningStore } from '../../persistence/sqlite-learning-store.js';
import type { WordState } from '../../types/word-state.js';
import type { SentenceState } from '../../types/sentence-state.js';

const DB_PATH = '/tmp/test-learning-store.db';
const USER = 'test-user';

const store = new SqliteLearningStore(DB_PATH);

afterAll(() => {
  store.close();
  if (existsSync(DB_PATH)) unlinkSync(DB_PATH);
});

const wordA: WordState = {
  wordId: 'th::กิน',
  seen: 5,
  correct: 4,
  mastery: 2,
  correctStreak: 2,
  wrongStreak: 0,
};

const wordB: WordState = {
  wordId: 'th::ไป',
  seen: 3,
  correct: 1,
  mastery: 0,
  correctStreak: 0,
  wrongStreak: 2,
};

const sentenceA: SentenceState = {
  sentenceId: 'sent-001',
  sentenceStreak: 3,
  lastBatchSeen: 2,
  dailyCount: 4,
  sessionWrongStreak: 0,
  active: true,
};

const sentenceB: SentenceState = {
  sentenceId: 'sent-002',
  sentenceStreak: 0,
  lastBatchSeen: -1,
  dailyCount: 0,
  sessionWrongStreak: 2,
  active: false,
};

describe('SqliteLearningStore — word states', () => {
  it('upsert then getAll returns the same WordState', () => {
    store.upsertWordState(USER, wordA);
    const result = store.getAllWordStates(USER);
    expect(result.get(wordA.wordId)).toEqual(wordA);
  });

  it('getAll returns all rows after multiple upserts', () => {
    store.upsertWordState(USER, wordB);
    const result = store.getAllWordStates(USER);
    expect(result.size).toBe(2);
    expect(result.get(wordB.wordId)).toEqual(wordB);
  });

  it('second upsert with same wordId overwrites — no duplicate rows', () => {
    const updated: WordState = { ...wordA, seen: 10, mastery: 3 };
    store.upsertWordState(USER, updated);
    const result = store.getAllWordStates(USER);
    expect(result.size).toBe(2);
    expect(result.get(wordA.wordId)).toEqual(updated);
  });

  it('user_id scopes results — different user sees empty state', () => {
    const result = store.getAllWordStates('other-user');
    expect(result.size).toBe(0);
  });
});

describe('SqliteLearningStore — sentence states', () => {
  it('upsert then getAll returns the same SentenceState', () => {
    store.upsertSentenceState(USER, sentenceA);
    const result = store.getAllSentenceStates(USER);
    expect(result.get(sentenceA.sentenceId)).toEqual(sentenceA);
  });

  it('preserves active: false and lastBatchSeen: -1 sentinel', () => {
    store.upsertSentenceState(USER, sentenceB);
    const result = store.getAllSentenceStates(USER);
    const s = result.get(sentenceB.sentenceId);
    expect(s?.active).toBe(false);
    expect(s?.lastBatchSeen).toBe(-1);
  });

  it('getAll returns all rows after multiple upserts', () => {
    const result = store.getAllSentenceStates(USER);
    expect(result.size).toBe(2);
  });

  it('second upsert with same sentenceId overwrites — no duplicate rows', () => {
    const updated: SentenceState = { ...sentenceA, sentenceStreak: 99 };
    store.upsertSentenceState(USER, updated);
    const result = store.getAllSentenceStates(USER);
    expect(result.size).toBe(2);
    expect(result.get(sentenceA.sentenceId)).toEqual(updated);
  });

  it('user_id scopes results — different user sees empty state', () => {
    const result = store.getAllSentenceStates('other-user');
    expect(result.size).toBe(0);
  });
});
