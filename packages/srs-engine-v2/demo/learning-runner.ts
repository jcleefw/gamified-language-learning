import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { mockConsonants } from '../data/mock/mock-consonants.js';
import { mockVowels } from '../data/mock/mock-vowels.js';
import { mockTones } from '../data/mock/mock-tones.js';
import { wordPool } from '../data/mock/mock-word-pool.js';
import { mockDecks } from '../data/mock/mock-decks.js';
import { selectDeck, runAdaptiveLoop } from './learning-io.js';
import { isMastered } from '../src/index.js';
import type { RunState } from '../src/index.js';
import {
  CorrectAutoAnswerStrategy,
} from './auto-answer-strategy.js';
import type { AutoAnswerStrategy } from './auto-answer-strategy.js';
import { AUTO_MODE, ENABLE_MOCK_DB, LEARNING_CONFIG, STREAK_THRESHOLDS } from './config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE_FILE = path.join(__dirname, '.demo-state.json');

function loadRunState(): RunState {
  if (!ENABLE_MOCK_DB) {
    return new Map();
  }
  if (existsSync(STATE_FILE)) {
    try {
      const data = readFileSync(STATE_FILE, 'utf-8');
      const parsed = JSON.parse(data) as [string, any][];
      console.log(`\n[INFO] Loaded learning history from ${STATE_FILE}`);
      return new Map(parsed);
    } catch (e) {
      console.warn(`\n[WARN] Failed to parse learning state file. Starting fresh.`, e);
    }
  }
  return new Map();
}

function saveRunState(state: RunState): void {
  if (!ENABLE_MOCK_DB) {
    return;
  }
  try {
    const serialized = JSON.stringify(Array.from(state.entries()), null, 2);
    writeFileSync(STATE_FILE, serialized, 'utf-8');
    console.log(`[INFO] Saved learning history to ${STATE_FILE}`);
  } catch (e) {
    console.error(`\n[ERROR] Failed to save learning history.`, e);
  }
}

/**
 * Test Scenarios for Auto Mode
 *
 * Uncomment one of the scenarios below to run that test configuration.
 * Each scenario uses a different answer strategy to validate different aspects
 * of the SRS engine behavior.
 */
function selectStrategy(): AutoAnswerStrategy {
  // Scenario 1: Perfect Run — all questions answered correctly
  // Expected: All words reach mastery, 100% accuracy
  return new CorrectAutoAnswerStrategy();

  // Scenario 2: Realistic 80/20 — 80% accuracy with some errors
  // Expected: Mixed mastery levels, ~80% accuracy, some recheck behavior
  // return new WeightedAccuracyAutoAnswerStrategy(0.8);

  // Scenario 3: Edge Cases — random answers
  // Expected: Unpredictable results, validates engine handles variable accuracy
  // return new RandomAutoAnswerStrategy();
}

const mockFoundational = [
  ...mockConsonants,
  ...mockVowels,
  ...mockTones,
];

let runState: RunState = loadRunState();

for (; ;) {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  const deck = AUTO_MODE ? mockDecks[0] : await selectDeck(mockDecks);

  const deckWords = deck.wordIds.flatMap(id => {
    const w = wordPool.find(word => word.id === id);
    return w !== undefined ? [w] : [];
  });

  const words = [
    mockConsonants[0],
    mockVowels[0],
    mockTones[0],
    ...deckWords,
  ];

  const recheckIds = new Set(
    deck.wordIds.filter(id => {
      const ws = runState.get(id);
      return ws != null && isMastered(ws, LEARNING_CONFIG.masteryThreshold);
    })
  );

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  const strategy = AUTO_MODE ? selectStrategy() : undefined;

  runState = await runAdaptiveLoop(
    words,
    wordPool,
    mockFoundational,
    LEARNING_CONFIG.wordsPerBatch,
    LEARNING_CONFIG.masteryThreshold,
    STREAK_THRESHOLDS,
    runState,
    recheckIds,
    strategy,
  );

  saveRunState(runState);

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (AUTO_MODE) break;
}
