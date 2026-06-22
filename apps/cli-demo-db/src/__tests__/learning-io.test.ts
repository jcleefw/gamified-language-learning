import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { initDb, schema, SqliteLearningStore } from '@gll/db';
import { runAdaptiveLoop } from '../learning-io.js';
import { CorrectAutoAnswerStrategy } from '../auto-answer-strategy.js';
import { LEARNING_CONFIG, STREAK_THRESHOLDS } from '../config.js';
import type { WordState, SentenceState, SentenceContext, RunState, GraduationHook } from '@gll/srs-engine-v2';

// Suppress and clear console.log per test — runAdaptiveLoop prints batch/score lines
beforeEach(() => { vi.spyOn(console, 'log').mockImplementation(() => {}); });
afterEach(() => { vi.restoreAllMocks(); });

function makeTestDb() {
  const sqlite = new Database(':memory:');
  initDb(sqlite);
  return drizzle(sqlite, { schema });
}

function makeMinimalWords(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `word-${String(i)}`,
    native: `native-${String(i)}`,
    romanization: `rom-${String(i)}`,
    english: `eng-${String(i)}`,
    type: 'noun' as const,
    language: 'th' as const,
  }));
}

// Build a RunState where all words have seen >= minSeenForSentence and mastery < threshold
// so they stay active and corpus sentences become eligible.
function makeSeenRunState(wordIds: string[], seen: number): RunState {
  const state: RunState = new Map();
  for (const wordId of wordIds) {
    state.set(wordId, { wordId, seen, correct: seen, mastery: 0, correctStreak: 0, wrongStreak: 0, lapses: 0 });
  }
  return state;
}

// Build a minimal SentenceContext using word ids from makeMinimalWords(3)
function makeMinimalCorpus(wordIds: string[]): SentenceContext[] {
  return [
    {
      sentenceId: 'sent-0',
      englishSentence: 'A test sentence.',
      wordOrder: wordIds,
    },
  ];
}

describe('onWordAnswer callback', () => {
  it('is called once per unique word after each batch', async () => {
    const words = makeMinimalWords(3);
    const spy = vi.fn<(state: WordState) => void>();
    const strategy = new CorrectAutoAnswerStrategy();

    await runAdaptiveLoop(
      words,
      words,
      [],
      LEARNING_CONFIG.wordsPerBatch,
      LEARNING_CONFIG.masteryThreshold,
      STREAK_THRESHOLDS,
      new Map(),
      new Map(),
      new Set(),
      strategy,
      [],
      spy,
    );

    expect(spy).toHaveBeenCalled();
    const calledWordIds = spy.mock.calls.map((c) => c[0].wordId);
    for (const word of words) {
      expect(calledWordIds).toContain(word.id);
    }
  });

  it('captured WordState has correct structure (seen > 0, wordId is a string)', async () => {
    const words = makeMinimalWords(3);
    const capturedStates: WordState[] = [];
    const strategy = new CorrectAutoAnswerStrategy();

    await runAdaptiveLoop(
      words,
      words,
      [],
      LEARNING_CONFIG.wordsPerBatch,
      LEARNING_CONFIG.masteryThreshold,
      STREAK_THRESHOLDS,
      new Map(),
      new Map(),
      new Set(),
      strategy,
      [],
      (ws) => capturedStates.push(ws),
    );

    expect(capturedStates.length).toBeGreaterThan(0);
    for (const ws of capturedStates) {
      expect(ws.seen).toBeGreaterThan(0);
      expect(typeof ws.wordId).toBe('string');
      expect(ws.wordId.length).toBeGreaterThan(0);
    }
  });

  it('does not throw when omitted', async () => {
    const words = makeMinimalWords(2);
    const strategy = new CorrectAutoAnswerStrategy();

    await expect(
      runAdaptiveLoop(
        words,
        words,
        [],
        LEARNING_CONFIG.wordsPerBatch,
        LEARNING_CONFIG.masteryThreshold,
        STREAK_THRESHOLDS,
        new Map(),
        new Map(),
        new Set(),
        strategy,
        [],
      ),
    ).resolves.not.toThrow();
  });
});

describe('onSentenceAnswer callback', () => {
  // Uses DB-free setup: 3 minimal words with seen >= minSeenForSentence, so corpus sentence is eligible.
  // Words start unmastered so they drive at least one batch; sentence fires in that batch.
  it('is called once per sentence result after updateSentenceRunState', async () => {
    const words = makeMinimalWords(3);
    const corpus = makeMinimalCorpus(words.map((w) => w.id));
    const initialRunState = makeSeenRunState(words.map((w) => w.id), LEARNING_CONFIG.minSeenForSentence);
    const strategy = new CorrectAutoAnswerStrategy();
    const capturedStates: SentenceState[] = [];

    await runAdaptiveLoop(
      words,
      words,
      [],
      LEARNING_CONFIG.wordsPerBatch,
      LEARNING_CONFIG.masteryThreshold,
      STREAK_THRESHOLDS,
      initialRunState,
      new Map(),
      new Set(),
      strategy,
      corpus,
      undefined,
      (ss) => capturedStates.push(ss),
    );

    expect(capturedStates.length).toBeGreaterThan(0);
    for (const ss of capturedStates) {
      expect(typeof ss.sentenceId).toBe('string');
      expect(ss.sentenceId.length).toBeGreaterThan(0);
    }
  });

  it('does not throw when onSentenceAnswer is omitted', async () => {
    const words = makeMinimalWords(3);
    const corpus = makeMinimalCorpus(words.map((w) => w.id));
    const initialRunState = makeSeenRunState(words.map((w) => w.id), LEARNING_CONFIG.minSeenForSentence);
    const strategy = new CorrectAutoAnswerStrategy();

    await expect(
      runAdaptiveLoop(
        words,
        words,
        [],
        LEARNING_CONFIG.wordsPerBatch,
        LEARNING_CONFIG.masteryThreshold,
        STREAK_THRESHOLDS,
        initialRunState,
        new Map(),
        new Set(),
        strategy,
        corpus,
      ),
    ).resolves.not.toThrow();
  });
});

describe('callbacks are independent', () => {
  it('providing only onWordAnswer works even when sentences appear', async () => {
    const words = makeMinimalWords(3);
    const corpus = makeMinimalCorpus(words.map((w) => w.id));
    const initialRunState = makeSeenRunState(words.map((w) => w.id), LEARNING_CONFIG.minSeenForSentence);
    const strategy = new CorrectAutoAnswerStrategy();
    const wordSpy = vi.fn<(state: WordState) => void>();

    await expect(
      runAdaptiveLoop(
        words,
        words,
        [],
        LEARNING_CONFIG.wordsPerBatch,
        LEARNING_CONFIG.masteryThreshold,
        STREAK_THRESHOLDS,
        initialRunState,
        new Map(),
        new Set(),
        strategy,
        corpus,
        wordSpy,
      ),
    ).resolves.not.toThrow();

    expect(wordSpy).toHaveBeenCalled();
  });
});

describe('write-on-answer integration', () => {
  it('word states are persisted after each batch via onWordAnswer callback', async () => {
    const words = makeMinimalWords(3);
    const db = makeTestDb();
    const store = new SqliteLearningStore(db);
    const strategy = new CorrectAutoAnswerStrategy();

    await runAdaptiveLoop(
      words,
      words,
      [],
      LEARNING_CONFIG.wordsPerBatch,
      LEARNING_CONFIG.masteryThreshold,
      STREAK_THRESHOLDS,
      new Map(),
      new Map(),
      new Set(),
      strategy,
      [],
      (ws) => store.upsertWordState('cli-user', ws),
    );

    const persisted = store.getAllWordStates('cli-user');
    expect(persisted.size).toBeGreaterThan(0);
    for (const [, ws] of persisted) {
      expect(ws.seen).toBeGreaterThan(0);
    }
  });
});

describe('onGraduation callback', () => {
  it('is called once at session end with graduated word IDs', async () => {
    const words = makeMinimalWords(3);
    const spy = vi.fn<GraduationHook>();
    const strategy = new CorrectAutoAnswerStrategy();

    await runAdaptiveLoop(
      words,
      words,
      [],
      LEARNING_CONFIG.wordsPerBatch,
      LEARNING_CONFIG.masteryThreshold,
      STREAK_THRESHOLDS,
      new Map(),
      new Map(),
      new Set(),
      strategy,
      [],
      undefined,
      undefined,
      spy,
    );

    expect(spy).toHaveBeenCalledTimes(1);
    const [ids] = spy.mock.calls[0];
    expect(ids.length).toBeGreaterThan(0);
  });

  it('receives final RunState as second argument, each graduated id is mastered', async () => {
    const words = makeMinimalWords(3);
    const capturedArgs: Parameters<GraduationHook>[] = [];
    const strategy = new CorrectAutoAnswerStrategy();

    await runAdaptiveLoop(
      words,
      words,
      [],
      LEARNING_CONFIG.wordsPerBatch,
      LEARNING_CONFIG.masteryThreshold,
      STREAK_THRESHOLDS,
      new Map(),
      new Map(),
      new Set(),
      strategy,
      [],
      undefined,
      undefined,
      (ids, rs) => capturedArgs.push([ids, rs]),
    );

    expect(capturedArgs.length).toBe(1);
    const [ids, rs] = capturedArgs[0];
    expect(rs instanceof Map).toBe(true);
    expect(rs.size).toBeGreaterThan(0);
    for (const id of ids) {
      const ws = rs.get(id);
      expect(ws).toBeDefined();
      expect(ws!.mastery).toBeGreaterThanOrEqual(LEARNING_CONFIG.masteryThreshold);
    }
  });

  it('is called with an empty array when no words graduate', async () => {
    const words = makeMinimalWords(3);
    // Pre-master all words so they go into recheckIds and do not cross the threshold again
    const premastered: RunState = new Map(
      words.map((w) => [w.id, { wordId: w.id, seen: 5, correct: 5, mastery: LEARNING_CONFIG.masteryThreshold, correctStreak: 3, wrongStreak: 0, lapses: 0 }]),
    );
    const recheckIds = new Set(words.map((w) => w.id));
    const spy = vi.fn<GraduationHook>();
    const strategy = new CorrectAutoAnswerStrategy();

    await runAdaptiveLoop(
      words,
      words,
      [],
      LEARNING_CONFIG.wordsPerBatch,
      LEARNING_CONFIG.masteryThreshold,
      STREAK_THRESHOLDS,
      premastered,
      new Map(),
      recheckIds,
      strategy,
      [],
      undefined,
      undefined,
      spy,
    );

    expect(spy).toHaveBeenCalledTimes(1);
    const [ids] = spy.mock.calls[0];
    expect(ids).toEqual([]);
  });

  it('does not throw when omitted', async () => {
    const words = makeMinimalWords(2);
    const strategy = new CorrectAutoAnswerStrategy();

    await expect(
      runAdaptiveLoop(
        words,
        words,
        [],
        LEARNING_CONFIG.wordsPerBatch,
        LEARNING_CONFIG.masteryThreshold,
        STREAK_THRESHOLDS,
        new Map(),
        new Map(),
        new Set(),
        strategy,
        [],
      ),
    ).resolves.not.toThrow();
  });

  it('fires after all onWordAnswer calls', async () => {
    const words = makeMinimalWords(3);
    const order: string[] = [];
    const strategy = new CorrectAutoAnswerStrategy();

    await runAdaptiveLoop(
      words,
      words,
      [],
      LEARNING_CONFIG.wordsPerBatch,
      LEARNING_CONFIG.masteryThreshold,
      STREAK_THRESHOLDS,
      new Map(),
      new Map(),
      new Set(),
      strategy,
      [],
      () => order.push('word'),
      undefined,
      () => order.push('graduation'),
    );

    const graduationIdx = order.lastIndexOf('graduation');
    const lastWordIdx = order.lastIndexOf('word');
    expect(graduationIdx).toBeGreaterThan(lastWordIdx);
  });
});
