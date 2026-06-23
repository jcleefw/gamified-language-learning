import { fileURLToPath } from 'url';
import { getDb, closeDb, SqliteLearningStore } from '@gll/db';
import { CorrectAutoAnswerStrategy } from './auto-answer-strategy.js';
import { buildQuizItems, buildFoundationalPool, buildSentenceCorpus } from './db-query.js';
import { runAdaptiveLoop } from './learning-io.js';
import { AUTO_MODE, LEARNING_CONFIG, STREAK_THRESHOLDS } from './config.js';
import type { DbClient } from './db-tools.js';

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const DB_PATH = process.env.GLL_DB_PATH ?? './data/learning-state.db';
  const CLI_USER_ID = 'cli-user';

  const db = getDb(DB_PATH) as DbClient;
  const store = new SqliteLearningStore(db);

  const allWords = buildQuizItems(db);
  const wordPool = allWords;
  const foundationalPool = await buildFoundationalPool();
  const corpus = buildSentenceCorpus(db);

  const initialRunState = store.getAllWordStates(CLI_USER_ID);
  const initialSentenceRunState = store.getAllSentenceStates(CLI_USER_ID);

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
    (ids) => { if (ids.length > 0) console.log('[INFO] Graduated:', ids); },
  );

  closeDb();
}
