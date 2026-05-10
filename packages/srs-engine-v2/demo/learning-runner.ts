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
import { AUTO_MODE, LEARNING_CONFIG, STREAK_THRESHOLDS } from './config.js';

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

let runState: RunState = new Map();

for (; ;) {
<<<<<<< HEAD:packages/srs-engine-v2/src/learning/learning-runner.ts
  // Select deck (auto or interactive)
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
=======
>>>>>>> 37a1051 (feat(srs-engine-v2): establish library boundary — src/index.ts, demo/, remove src/learning/):packages/srs-engine-v2/demo/learning-runner.ts
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
    LEARNING_CONFIG.questionLimit,
    LEARNING_CONFIG.masteryThreshold,
    STREAK_THRESHOLDS,
    runState,
    recheckIds,
    strategy,
  );

<<<<<<< HEAD:packages/srs-engine-v2/src/learning/learning-runner.ts
  // In auto mode, exit after one run; in interactive mode, loop
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
=======
>>>>>>> 37a1051 (feat(srs-engine-v2): establish library boundary — src/index.ts, demo/, remove src/learning/):packages/srs-engine-v2/demo/learning-runner.ts
  if (AUTO_MODE) break;
}
