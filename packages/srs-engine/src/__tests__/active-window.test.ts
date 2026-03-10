import { describe, it, expect } from 'vitest';
import { getEligibleWords } from '../active-window.js';
import type { WordState, SrsConfig } from '../types.js';

const baseConfig: SrsConfig = {
  masteryThreshold: { curated: 10, foundational: 5 },
  lapseThreshold: 3,
  batchSize: 10,
  activeWordLimit: 8,
  newWordsPerBatch: 4,
  shelveAfterBatches: 3,
  maxShelved: 2,
  continuousWrongThreshold: 3,
  questionTypeSplit: { mc: 60, wordBlock: 30, audio: 10 },
  foundationalAllocation: { active: 3, postDepletion: 0 },
  desiredRetention: 0.9,
  maxIntervalDays: 90,
};

function makeWord(overrides: Partial<WordState> = {}): WordState {
  return {
    wordId: `word-${Math.random()}`,
    category: 'curated',
    masteryCount: 0,
    phase: 'learning',
    lapseCount: 0,
    correctCount: 0,
    wrongCount: 0,
    ...overrides,
  };
}

describe('getEligibleWords', () => {
  describe('active window filtering', () => {
    it('returns empty active array when no words in review phase', () => {
      const words = [
        makeWord({ phase: 'learning' }),
        makeWord({ phase: 'learning' }),
      ];
      const result = getEligibleWords(words, baseConfig);
      expect(result.active).toHaveLength(0);
    });

    it('returns words in srsM2_review phase as active', () => {
      const reviewWord = makeWord({
        wordId: 'review-1',
        phase: 'srsM2_review',
      });
      const learningWord = makeWord({
        wordId: 'learning-1',
        phase: 'learning',
      });
      const words = [reviewWord, learningWord];
      const result = getEligibleWords(words, baseConfig);
      expect(result.active).toHaveLength(1);
      expect(result.active[0].wordId).toBe('review-1');
    });

    it('correctly identifies multiple active words', () => {
      const words = [
        makeWord({ wordId: 'review-1', phase: 'srsM2_review' }),
        makeWord({ wordId: 'review-2', phase: 'srsM2_review' }),
        makeWord({ wordId: 'learning-1', phase: 'learning' }),
      ];
      const result = getEligibleWords(words, baseConfig);
      expect(result.active).toHaveLength(2);
      expect(result.active.map((w) => w.wordId)).toEqual([
        'review-1',
        'review-2',
      ]);
    });
  });

  describe('new slots calculation', () => {
    it('returns 4 slots when no active words (activeWordLimit=8, newWordsPerBatch=4)', () => {
      const words = [makeWord({ phase: 'learning' })];
      const result = getEligibleWords(words, baseConfig);
      expect(result.newSlots).toBe(4);
    });

    it('returns 4 slots when 4 active words (8-4=4 available, cap is 4)', () => {
      const words = Array.from({ length: 4 }, (_, i) =>
        makeWord({ wordId: `review-${i}`, phase: 'srsM2_review' }),
      ).concat(makeWord({ phase: 'learning' }));
      const result = getEligibleWords(words, baseConfig);
      expect(result.newSlots).toBe(4);
    });

    it('returns 0 slots when exactly 8 active words (activeWordLimit reached)', () => {
      const words = Array.from({ length: 8 }, (_, i) =>
        makeWord({ wordId: `review-${i}`, phase: 'srsM2_review' }),
      );
      const result = getEligibleWords(words, baseConfig);
      expect(result.newSlots).toBe(0);
    });

    it('returns 2 slots when 6 active words (8-6=2 available, cap is 4)', () => {
      const words = Array.from({ length: 6 }, (_, i) =>
        makeWord({ wordId: `review-${i}`, phase: 'srsM2_review' }),
      ).concat(makeWord({ phase: 'learning' }));
      const result = getEligibleWords(words, baseConfig);
      expect(result.newSlots).toBe(2);
    });

    it('returns 1 slot when 7 active words (8-7=1 available, cap is 4)', () => {
      const words = Array.from({ length: 7 }, (_, i) =>
        makeWord({ wordId: `review-${i}`, phase: 'srsM2_review' }),
      );
      const result = getEligibleWords(words, baseConfig);
      expect(result.newSlots).toBe(1);
    });

    it('caps at newWordsPerBatch even when more slots available', () => {
      const configWith3NewPerBatch = { ...baseConfig, newWordsPerBatch: 3 };
      const words = [makeWord({ phase: 'learning' })];
      const result = getEligibleWords(words, configWith3NewPerBatch);
      expect(result.newSlots).toBe(3);
    });
  });

  describe('eligible candidates filtering', () => {
    it('returns empty eligible array when all words in review phase', () => {
      const words = [
        makeWord({ phase: 'srsM2_review' }),
        makeWord({ phase: 'srsM2_review' }),
      ];
      const result = getEligibleWords(words, baseConfig);
      expect(result.eligible).toHaveLength(0);
    });

    it('returns learning phase words as eligible', () => {
      const learningWord = makeWord({
        wordId: 'learning-1',
        phase: 'learning',
      });
      const reviewWord = makeWord({
        wordId: 'review-1',
        phase: 'srsM2_review',
      });
      const words = [learningWord, reviewWord];
      const result = getEligibleWords(words, baseConfig);
      expect(result.eligible).toHaveLength(1);
      expect(result.eligible[0].wordId).toBe('learning-1');
    });

    it('returns all learning words as eligible', () => {
      const words = [
        makeWord({ wordId: 'learning-1', phase: 'learning' }),
        makeWord({ wordId: 'learning-2', phase: 'learning' }),
        makeWord({ wordId: 'learning-3', phase: 'learning' }),
        makeWord({ wordId: 'review-1', phase: 'srsM2_review' }),
      ];
      const result = getEligibleWords(words, baseConfig);
      expect(result.eligible).toHaveLength(3);
      expect(result.eligible.map((w) => w.wordId)).toEqual([
        'learning-1',
        'learning-2',
        'learning-3',
      ]);
    });
  });

  describe('immutability', () => {
    it('does not mutate input array', () => {
      const words = [
        makeWord({ phase: 'learning' }),
        makeWord({ phase: 'srsM2_review' }),
      ];
      const originalLength = words.length;
      getEligibleWords(words, baseConfig);
      expect(words).toHaveLength(originalLength);
    });

    it('does not mutate word states', () => {
      const word = makeWord({ phase: 'learning', masteryCount: 5 });
      const words = [word];
      getEligibleWords(words, baseConfig);
      expect(word.masteryCount).toBe(5);
      expect(word.phase).toBe('learning');
    });
  });

  describe('edge cases', () => {
    it('handles empty word list', () => {
      const result = getEligibleWords([], baseConfig);
      expect(result.active).toHaveLength(0);
      expect(result.eligible).toHaveLength(0);
      expect(result.newSlots).toBe(4);
    });

    it('handles single word in learning phase', () => {
      const words = [makeWord({ phase: 'learning' })];
      const result = getEligibleWords(words, baseConfig);
      expect(result.active).toHaveLength(0);
      expect(result.eligible).toHaveLength(1);
      expect(result.newSlots).toBe(4);
    });

    it('handles single word in review phase', () => {
      const words = [makeWord({ phase: 'srsM2_review' })];
      const result = getEligibleWords(words, baseConfig);
      expect(result.active).toHaveLength(1);
      expect(result.eligible).toHaveLength(0);
      expect(result.newSlots).toBe(4);
    });

    it('handles activeWordLimit=0 (edge config)', () => {
      const edgeConfig = { ...baseConfig, activeWordLimit: 0 };
      const words = [makeWord({ phase: 'learning' })];
      const result = getEligibleWords(words, edgeConfig);
      expect(result.newSlots).toBe(0);
    });

    it('handles newWordsPerBatch=0 (edge config)', () => {
      const edgeConfig = { ...baseConfig, newWordsPerBatch: 0 };
      const words = [makeWord({ phase: 'learning' })];
      const result = getEligibleWords(words, edgeConfig);
      expect(result.newSlots).toBe(0);
    });

    it('returns correct result with exactly 8 active and 0 eligible', () => {
      const words = Array.from({ length: 8 }, (_, i) =>
        makeWord({ wordId: `review-${i}`, phase: 'srsM2_review' }),
      );
      const result = getEligibleWords(words, baseConfig);
      expect(result.active).toHaveLength(8);
      expect(result.eligible).toHaveLength(0);
      expect(result.newSlots).toBe(0);
    });
  });
});
