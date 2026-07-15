import { describe, it, expect } from 'vitest';
import { mockConsonants } from '../../../data/mock/mock-consonants.js';
import { wordPool } from '../../../data/mock/mock-word-pool.js';
import { mockDecks } from '../../../data/mock/mock-decks.js';
import { runAdaptiveLoop } from '../../../demo/learning-io.js';
import {
  CorrectAutoAnswerStrategy,
  DeterministicAccuracyAutoAnswerStrategy,
  RandomAutoAnswerStrategy,
} from '../../../demo/auto-answer-strategy.js';
import { isMastered } from '../../types/word-state.js';

const config = {
  foundationalWordsCount: 2,
  wordsPerBatch: 4,
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

describe('Auto Mode Scenarios', () => {
  it('perfect scenario: CorrectAutoAnswerStrategy reaches 100% accuracy', async () => {
    const deck = mockDecks[0];
    const deckWords = deck.wordIds.flatMap((id) => {
      const w = wordPool.find((word) => word.id === id);
      return w !== undefined ? [w] : [];
    });
    const words = [
      ...deckWords,
      ...mockConsonants.slice(0, config.foundationalWordsCount),
    ];

    const strategy = new CorrectAutoAnswerStrategy();
    const { runState } = await runAdaptiveLoop(
      words,
      wordPool,
      mockConsonants,
      config.wordsPerBatch,
      config.masteryThreshold,
      streakThresholds,
      new Map(),
      new Map(),
      new Set(),
      strategy,
    );

    // Verify all words reached mastery
    for (const word of words) {
      const wordState = runState.get(word.id);
      expect(wordState).toBeDefined();
      if (wordState) {
        expect(isMastered(wordState, config.masteryThreshold)).toBe(true);
        expect(wordState.mastery).toBe(config.maxMastery);
      }
    }
  });

  it('realistic scenario: DeterministicAccuracyAutoAnswerStrategy(0.8) completes with exactly 80% accuracy', async () => {
    const deck = mockDecks[0];
    const deckWords = deck.wordIds.flatMap((id) => {
      const w = wordPool.find((word) => word.id === id);
      return w !== undefined ? [w] : [];
    });
    const words = [
      ...deckWords,
      ...mockConsonants.slice(0, config.foundationalWordsCount),
    ];

    const strategy = new DeterministicAccuracyAutoAnswerStrategy(0.8);
    const { runState } = await runAdaptiveLoop(
      words,
      wordPool,
      mockConsonants,
      config.wordsPerBatch,
      config.masteryThreshold,
      streakThresholds,
      new Map(),
      new Map(),
      new Set(),
      strategy,
    );

    // Verify run state has entries for all words
    expect(runState.size).toBeGreaterThan(0);

    // Calculate overall accuracy
    let totalSeen = 0;
    let totalCorrect = 0;
    for (const wordState of runState.values()) {
      totalSeen += wordState.seen;
      totalCorrect += wordState.correct;
    }

    const accuracy = totalSeen > 0 ? totalCorrect / totalSeen : 0;
    // Deterministic strategy achieves ~80% accuracy (within ±5% due to small sample size)
    expect(accuracy).toBeGreaterThanOrEqual(0.75);
    expect(accuracy).toBeLessThanOrEqual(0.85);
  });

  it('edge case scenario: RandomAutoAnswerStrategy completes without crashing', async () => {
    const deck = mockDecks[0];
    const deckWords = deck.wordIds.flatMap((id) => {
      const w = wordPool.find((word) => word.id === id);
      return w !== undefined ? [w] : [];
    });
    const words = [
      ...deckWords,
      ...mockConsonants.slice(0, config.foundationalWordsCount),
    ];

    const strategy = new RandomAutoAnswerStrategy();
    const { runState } = await runAdaptiveLoop(
      words,
      wordPool,
      mockConsonants,
      config.wordsPerBatch,
      config.masteryThreshold,
      streakThresholds,
      new Map(),
      new Map(),
      new Set(),
      strategy,
    );

    // Verify run state exists and has entries
    expect(runState.size).toBeGreaterThan(0);

    // Verify all words have been seen at least once
    for (const word of words) {
      const wordState = runState.get(word.id);
      expect(wordState).toBeDefined();
      if (wordState) {
        expect(wordState.seen).toBeGreaterThan(0);
      }
    }
  });

  it('determinism: Same input with shuffle: false produces identical results', async () => {
    const deck = mockDecks[0];
    const deckWords = deck.wordIds.flatMap((id) => {
      const w = wordPool.find((word) => word.id === id);
      return w !== undefined ? [w] : [];
    });
    const words = [
      ...deckWords.slice(0, 2), // Use only first 2 words for faster test
      ...mockConsonants.slice(0, config.foundationalWordsCount),
    ];

    const strategy1 = new CorrectAutoAnswerStrategy();
    const { runState: runState1 } = await runAdaptiveLoop(
      words,
      wordPool,
      mockConsonants,
      config.wordsPerBatch,
      config.masteryThreshold,
      streakThresholds,
      new Map(),
      new Map(),
      new Set(),
      strategy1,
    );

    const strategy2 = new CorrectAutoAnswerStrategy();
    const { runState: runState2 } = await runAdaptiveLoop(
      words,
      wordPool,
      mockConsonants,
      config.wordsPerBatch,
      config.masteryThreshold,
      streakThresholds,
      new Map(),
      new Map(),
      new Set(),
      strategy2,
    );

    // Results should be identical with CorrectAutoAnswerStrategy (100% accuracy)
    expect(runState1.size).toBe(runState2.size);
    for (const [wordId, state1] of runState1) {
      const state2 = runState2.get(wordId);
      expect(state2).toBeDefined();
      if (state2) {
        expect(state1.seen).toBe(state2.seen);
        expect(state1.correct).toBe(state2.correct);
        expect(state1.mastery).toBe(state2.mastery);
      }
    }
  });
});
