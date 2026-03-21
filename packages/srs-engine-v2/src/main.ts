import { mockConsonants } from '../data/mock/mock-consonants.js';
import { wordPool } from '../data/mock/mock-word-pool.js';
import { mockDecks } from '../data/mock/mock-decks.js';
import { selectDeck, runAdaptiveLoop } from './runner/interactive.js';
import { type RunState, isMastered } from './types/word-state.js';
import { CorrectAnswerStrategy } from './types/answer-strategy.js';
import type { AnswerStrategy } from './types/answer-strategy.js';

// AUTO_MODE: Set to true to run automated quiz answering without user input
const AUTO_MODE = true;
const config = {
  foundationalWordsCount: 2,
  questionLimit: 6,
  masteryThreshold: 2,
  maxMastery: 2,
  correctStreakThreshold: 2,
  wrongStreakThreshold: 2,
};

const streakThresholds = {
  correctStreakThreshold: config.correctStreakThreshold,
  wrongStreakThreshold: config.wrongStreakThreshold,
  maxMastery: config.maxMastery,
};

/**
 * Test Scenarios for Auto Mode
 *
 * Uncomment one of the scenarios below to run that test configuration.
 * Each scenario uses a different answer strategy to validate different aspects
 * of the SRS engine behavior.
 */
function selectStrategy(): AnswerStrategy {
  // Scenario 1: Perfect Run — all questions answered correctly
  // Expected: All words reach mastery, 100% accuracy
  return new CorrectAnswerStrategy();

  // Scenario 2: Realistic 80/20 — 80% accuracy with some errors
  // Expected: Mixed mastery levels, ~80% accuracy, some recheck behavior
  // return new WeightedAccuracyStrategy(0.8);

  // Scenario 3: Edge Cases — random answers
  // Expected: Unpredictable results, validates engine handles variable accuracy
  // return new RandomAnswerStrategy();
}

let runState: RunState = new Map();

for (; ;) {
  // Select deck (auto or interactive)
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  const deck = AUTO_MODE ? mockDecks[0] : await selectDeck(mockDecks);

  const deckWords = deck.wordIds.flatMap(id => {
    const w = wordPool.find(word => word.id === id);
    return w !== undefined ? [w] : [];
  });
  const words = [
    ...deckWords,
    ...mockConsonants.slice(0, config.foundationalWordsCount),
  ];

  const recheckIds = new Set(
    deck.wordIds.filter(id => {
      const ws = runState.get(id);
      return ws != null && isMastered(ws, config.masteryThreshold);
    })
  );

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  const strategy = AUTO_MODE ? selectStrategy() : undefined;

  runState = await runAdaptiveLoop(
    words,
    wordPool,
    mockConsonants,
    config.questionLimit,
    config.masteryThreshold,
    streakThresholds,
    runState,
    recheckIds,
    strategy,
  );

  // In auto mode, exit after one run; in interactive mode, loop
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (AUTO_MODE) break;
}
