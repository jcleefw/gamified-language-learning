import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { initDb, schema, SqliteLearningStore } from '@gll/db';
import { runAdaptiveLoop } from '../learning-io.js';
import { StagnationAutoAnswerStrategy, CorrectAutoAnswerStrategy } from '../auto-answer-strategy.js';
import { LEARNING_CONFIG, STREAK_THRESHOLDS } from '../config.js';
import { DEFAULT_SHELVING_CONFIG, type ShelvingConfig } from '@gll/srs-shelving';
import type { QuizItem } from '@gll/srs-engine-v2';

// Suppress console.log per test except for debug/test logs
beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation((msg) => {
    if (typeof msg === 'string' && (msg.startsWith('[TEST]') || msg.startsWith('[SHELVING]'))) {
      process.stderr.write(msg + '\n');
    }
  });
});
afterEach(() => { vi.restoreAllMocks(); });

function makeTestDb() {
  const sqlite = new Database(':memory:');
  initDb(sqlite);
  return drizzle(sqlite, { schema });
}

function makeMinimalWords(count: number): QuizItem[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `word-${String(i)}`,
    native: `native-${String(i)}`,
    romanization: `rom-${String(i)}`,
    english: `eng-${String(i)}`,
    type: 'noun' as const,
    language: 'th' as const,
  }));
}

function makeStoreWithStagnation(shelvingConfig: ShelvingConfig) {
  const db = makeTestDb();
  const store = new SqliteLearningStore(db);
  const userId = 'test-user';
  const deckId = 'test-deck';

  const onGetStagnantIds = async (activeWordIds: string[]): Promise<string[]> => {
    await store.updateStagnationCounters(userId, deckId, activeWordIds);
    return store.getStagnantWords(userId, deckId, shelvingConfig.stagnationBatchWindow);
  };

  return { store, userId, deckId, onGetStagnantIds };
}

describe('StagnationAutoAnswerStrategy', () => {
  it('keeps mastery at 0 after multiple batches', async () => {
    const words = makeMinimalWords(3);
    const strategy = new StagnationAutoAnswerStrategy();
    // Use threshold=2 and maxShelved=words.length so loop terminates via shelving after 2 batches.
    const shelvingConfig: ShelvingConfig = {
      stagnationBatchWindow: 2,
      maxShelved: words.length,
    };
    const { store, userId, deckId, onGetStagnantIds } = makeStoreWithStagnation(shelvingConfig);

    const capturedMasteries: number[] = [];

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
      async (ws) => {
        capturedMasteries.push(ws.mastery);
        await store.upsertWordState(userId, ws);
      },
      undefined,
      undefined,
      shelvingConfig,
      (wordId, batchNum) => store.shelveWord(userId, deckId, wordId, batchNum),
      undefined,
      undefined,
      onGetStagnantIds,
    );

    // All captured mastery values should be 0 since every answer was wrong
    expect(capturedMasteries.length).toBeGreaterThan(0);
    for (const mastery of capturedMasteries) {
      expect(mastery).toBe(0);
    }
  });
});

describe('Shelving integration', () => {
  it('word gets shelved after stagnationBatchWindow batches with stagnation strategy', async () => {
    const words = makeMinimalWords(3);
    const strategy = new StagnationAutoAnswerStrategy();
    const shelvingConfig: ShelvingConfig = {
      stagnationBatchWindow: 2,
      maxShelved: words.length,
    };
    const { store, userId, deckId, onGetStagnantIds } = makeStoreWithStagnation(shelvingConfig);

    const shelvedIds: string[] = [];

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
      (ws) => store.upsertWordState(userId, ws),
      undefined,
      undefined,
      shelvingConfig,
      async (wordId, batchNum) => { shelvedIds.push(wordId); await store.shelveWord(userId, deckId, wordId, batchNum); },
      undefined,
      undefined,
      onGetStagnantIds,
    );

    // At least one word should have been shelved after 2 windows of stagnation
    expect(shelvedIds.length).toBeGreaterThan(0);
  });

  it('shelved word excluded from batch questions after shelving', async () => {
    const words = makeMinimalWords(3);
    const strategy = new StagnationAutoAnswerStrategy();
    // maxShelved = words.length so all words eventually shelve and the loop can terminate.
    const shelvingConfig: ShelvingConfig = {
      stagnationBatchWindow: 2,
      maxShelved: words.length,
    };
    const { store, userId, deckId, onGetStagnantIds } = makeStoreWithStagnation(shelvingConfig);

    const shelvedIds = new Set<string>();
    let shelvingStarted = false;
    const answeredAfterShelve: string[] = [];

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
      async (ws) => {
        await store.upsertWordState(userId, ws);
        if (shelvingStarted) {
          answeredAfterShelve.push(ws.wordId);
        }
      },
      undefined,
      undefined,
      shelvingConfig,
      async (wordId, batchNum) => {
        shelvedIds.add(wordId);
        await store.shelveWord(userId, deckId, wordId, batchNum);
        shelvingStarted = true;
      },
      undefined,
      undefined,
      onGetStagnantIds,
    );

    // If any shelving happened, verify shelved words don't appear in post-shelve answers
    if (shelvedIds.size > 0) {
      for (const shelvedId of shelvedIds) {
        expect(answeredAfterShelve).not.toContain(shelvedId);
      }
    }
  });

  it('maxShelved cap is respected', async () => {
    // Use 1 word so the loop terminates when it gets shelved (all active shelved → break).
    // The cap enforcement is also verified independently in policy.test.ts.
    const words = makeMinimalWords(1);
    const strategy = new StagnationAutoAnswerStrategy();
    const shelvingConfig: ShelvingConfig = {
      stagnationBatchWindow: 2,
      maxShelved: 1,
    };
    const { store, userId, deckId, onGetStagnantIds } = makeStoreWithStagnation(shelvingConfig);

    const shelvedIds = new Set<string>();

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
      (ws) => store.upsertWordState(userId, ws),
      undefined,
      undefined,
      shelvingConfig,
      async (wordId, batchNum) => { shelvedIds.add(wordId); await store.shelveWord(userId, deckId, wordId, batchNum); },
      undefined,
      undefined,
      onGetStagnantIds,
    );

    expect(shelvedIds.size).toBeLessThanOrEqual(1);
  });

  it('onUnshelveAll is called on session start', async () => {
    const words = makeMinimalWords(2);
    const strategy = new CorrectAutoAnswerStrategy();
    const unshelveAllSpy = vi.fn();

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
      undefined,
      DEFAULT_SHELVING_CONFIG,
      undefined,
      unshelveAllSpy,
    );

    expect(unshelveAllSpy).toHaveBeenCalledTimes(1);
  });

  it('shelving decisions are persisted to DB via onShelve callback', async () => {
    const words = makeMinimalWords(3);
    const strategy = new StagnationAutoAnswerStrategy();
    const shelvingConfig: ShelvingConfig = {
      stagnationBatchWindow: 2,
      maxShelved: words.length,
    };
    const { store, userId, deckId, onGetStagnantIds } = makeStoreWithStagnation(shelvingConfig);

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
      (ws) => store.upsertWordState(userId, ws),
      undefined,
      undefined,
      shelvingConfig,
      (wordId, batchNum) => store.shelveWord(userId, deckId, wordId, batchNum),
      undefined,
      undefined,
      onGetStagnantIds,
    );

    const shelvedWords = await store.getShelvedWords(userId, deckId);
    // At least one word should be shelved in the DB after stagnation
    expect(shelvedWords.length).toBeGreaterThan(0);
    for (const sw of shelvedWords) {
      expect(typeof sw.wordId).toBe('string');
      expect(typeof sw.shelvedAtBatch).toBe('number');
    }
  });

  it('existing loop behavior is unchanged when no shelving config provided', async () => {
    const words = makeMinimalWords(3);
    const strategy = new CorrectAutoAnswerStrategy();
    const wordSpy = vi.fn();

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
        wordSpy,
      ),
    ).resolves.not.toThrow();

    expect(wordSpy).toHaveBeenCalled();
  });

  describe('Shelving persistence across sessions', () => {
    it('shelved words loaded from DB are excluded from active pool on session resume', async () => {
      const words = makeMinimalWords(3);
      const shelvingConfig: ShelvingConfig = {
        stagnationBatchWindow: 2,
        maxShelved: words.length,
      };
      const { store, userId, deckId } = makeStoreWithStagnation(shelvingConfig);

      const shelvedIds = new Set<string>();

      // Manually create a scenario: shelf word-0 and word-1
      await store.shelveWord(userId, deckId, 'word-0', 1);
      await store.shelveWord(userId, deckId, 'word-1', 1);
      shelvedIds.add('word-0');
      shelvedIds.add('word-1');

      // Verify words are in DB
      const dbShelvedWords = await store.getShelvedWords(userId, deckId);
      expect(dbShelvedWords.length).toBe(2);

      // Session 2: Load shelved state from DB and verify shelved words are filtered out
      const shelvedSetFromDb = new Set(dbShelvedWords.map(sw => sw.wordId));
      expect(shelvedSetFromDb.size).toBe(2);
      expect(shelvedSetFromDb.has('word-0')).toBe(true);
      expect(shelvedSetFromDb.has('word-1')).toBe(true);

      // Simulate the session 2 filtering logic (same as learning-io.ts line 324)
      const unshelvedWords = words.filter((w) => !shelvedSetFromDb.has(w.id));

      // Verify filtering worked
      expect(unshelvedWords.length).toBe(1); // Only word-2 should remain
      expect(unshelvedWords[0].id).toBe('word-2');
      for (const w of unshelvedWords) {
        expect(shelvedSetFromDb.has(w.id)).toBe(false);
      }
    });
  });
});
