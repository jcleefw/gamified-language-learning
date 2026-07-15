import './env.js';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'node:path';
import { mkdirSync } from 'node:fs';
import { getDb, closeDb, SqliteLearningStore, SqliteReviewStore } from '@gll/db';
import { FsrsScheduler } from '@gll/srs-review';
import { seedGraduatedReviewCards } from './seed-graduated-review-cards.js';
import { CorrectAutoAnswerStrategy } from './auto-answer-strategy.js';
import {
  buildQuizItems,
  buildFoundationalPool,
  buildSentenceCorpus,
} from './db-query.js';
import { runAdaptiveLoop } from './learning-io.js';
import { AUTO_MODE, LEARNING_CONFIG, STREAK_THRESHOLDS } from './config.js';
import { DEFAULT_SHELVING_CONFIG } from '@gll/srs-shelving';
import type { DbClient } from './db-tools.js';

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const DB_PATH = process.env.GLL_DB_PATH ?? resolve(dirname(fileURLToPath(import.meta.url)), '../../../.data/learning-state.db');
  mkdirSync(dirname(DB_PATH), { recursive: true });
  const CLI_USER_ID = 'cli-user';
  // Stagnation and shelving are deck-scoped; use a fixed ID for the CLI session.
  const DECK_ID = 'cli-deck';

  const db = getDb(DB_PATH) as DbClient;
  const store = new SqliteLearningStore(db);
  const reviewStore = new SqliteReviewStore(db);
  const scheduler = new FsrsScheduler();

  const allWords = buildQuizItems(db);
  const wordPool = allWords;
  const foundationalPool = await buildFoundationalPool();
  const corpus = buildSentenceCorpus(db);

  const initialRunState = await store.getAllWordStates(CLI_USER_ID);
  const initialSentenceRunState = await store.getAllSentenceStates(CLI_USER_ID);

  const words = allWords.filter((w) => {
    const ws = initialRunState.get(w.id);
    return !ws || ws.mastery < LEARNING_CONFIG.masteryThreshold;
  });

  const strategy = AUTO_MODE ? new CorrectAutoAnswerStrategy() : undefined;

  await runAdaptiveLoop(
    words,
    wordPool,
    foundationalPool,
    LEARNING_CONFIG.wordsPerBatch,
    LEARNING_CONFIG.masteryThreshold,
    STREAK_THRESHOLDS,
    initialRunState,
    initialSentenceRunState,
    new Set(),
    strategy,
    corpus,
    (ws) => store.upsertWordState(CLI_USER_ID, ws),
    (ss) => store.upsertSentenceState(CLI_USER_ID, ss),
    async (ids, runState) => {
      if (ids.length > 0) {
        console.log('[INFO] Graduated:', ids);
        await seedGraduatedReviewCards(ids, runState, scheduler, reviewStore, CLI_USER_ID);
      }
    },
    DEFAULT_SHELVING_CONFIG,
    (wordId, batchNum) =>
      store.shelveWord(CLI_USER_ID, DECK_ID, wordId, batchNum),
    async () => {
      await store.unshelveAllWords(CLI_USER_ID, DECK_ID);
      await store.resetStagnationCounters(CLI_USER_ID, DECK_ID);
    },
    new Set(), // always start with empty shelved set — unshelve-all runs on session start
    async (activeWordIds) => {
      await store.updateStagnationCounters(CLI_USER_ID, DECK_ID, activeWordIds);
      return store.getStagnantWords(
        CLI_USER_ID,
        DECK_ID,
        DEFAULT_SHELVING_CONFIG.stagnationBatchWindow,
      );
    },
  );

  closeDb();
}
