import { mockConsonants } from '../data/mock/mock-consonants.js';
import { wordPool } from '../data/mock/mock-word-pool.js';
import { mockDecks } from '../data/mock/mock-decks.js';
import { selectDeck, runAdaptiveLoop } from './runner/interactive.js';
import { RunState, isMastered } from './types/word-state.js';

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

let runState: RunState = new Map();

while (true) {
  const deck = await selectDeck(mockDecks);
  const deckWords = deck.wordIds.map(id => wordPool.find(w => w.id === id)!);
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

  runState = await runAdaptiveLoop(
    words,
    wordPool,
    mockConsonants,
    config.questionLimit,
    config.masteryThreshold,
    streakThresholds,
    runState,
    recheckIds,
  );
}
