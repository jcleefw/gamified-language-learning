import { describe, it, expect } from 'vitest';
import {
  getActiveFoundationalWords,
  applyFoundationalWrongRule,
  getFoundationalAllocation,
} from '../foundational.js';
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
  foundationalAllocation: { active: 0.2, postDepletion: 0.05 },
  desiredRetention: 0.9,
  maxIntervalDays: 90,
};

function makeWord(overrides: Partial<WordState> = {}): WordState {
  return {
    wordId: `word-${Math.random().toString()}`,
    category: 'curated',
    masteryCount: 0,
    phase: 'learning',
    lapseCount: 0,
    correctCount: 0,
    wrongCount: 0,
    ...overrides,
  };
}

describe('getActiveFoundationalWords', () => {
  it('returns 3 available slots when no foundational words are active', () => {
    const words = [makeWord({ category: 'curated', phase: 'learning' })];
    const result = getActiveFoundationalWords(words);
    expect(result.active).toHaveLength(0);
    expect(result.availableSlots).toBe(3);
  });

  it('returns 1 available slot when 2 foundational words are active', () => {
    const words = [
      makeWord({ category: 'foundational', phase: 'learning', wordId: 'f1' }),
      makeWord({ category: 'foundational', phase: 'learning', wordId: 'f2' }),
    ];
    const result = getActiveFoundationalWords(words);
    expect(result.active).toHaveLength(2);
    expect(result.availableSlots).toBe(1);
  });

  it('returns 0 available slots when 3 foundational words are active', () => {
    const words = [
      makeWord({ category: 'foundational', phase: 'learning', wordId: 'f1' }),
      makeWord({ category: 'foundational', phase: 'learning', wordId: 'f2' }),
      makeWord({ category: 'foundational', phase: 'learning', wordId: 'f3' }),
    ];
    const result = getActiveFoundationalWords(words);
    expect(result.active).toHaveLength(3);
    expect(result.availableSlots).toBe(0);
  });

  it('returns 0 available slots when 4 foundational words are in learning (edge)', () => {
    const words = Array.from({ length: 4 }, (_, i) =>
      makeWord({
        category: 'foundational',
        phase: 'learning',
        wordId: `f${i.toString()}`,
      }),
    );
    const result = getActiveFoundationalWords(words);
    expect(result.active).toHaveLength(4);
    expect(result.availableSlots).toBe(0);
  });

  it('only counts foundational words as active, ignoring curated', () => {
    const words = [
      makeWord({ category: 'curated', phase: 'learning', wordId: 'c1' }),
      makeWord({ category: 'curated', phase: 'learning', wordId: 'c2' }),
      makeWord({ category: 'foundational', phase: 'learning', wordId: 'f1' }),
    ];
    const result = getActiveFoundationalWords(words);
    expect(result.active).toHaveLength(1);
    expect(result.active[0].wordId).toBe('f1');
    expect(result.availableSlots).toBe(2);
  });

  it('returns foundational words in review phase as eligible', () => {
    const words = [
      makeWord({ category: 'foundational', phase: 'learning', wordId: 'f1' }),
      makeWord({
        category: 'foundational',
        phase: 'srsM2_review',
        wordId: 'f2',
      }),
    ];
    const result = getActiveFoundationalWords(words);
    expect(result.active).toHaveLength(1);
    expect(result.eligible).toHaveLength(1);
    expect(result.eligible[0].wordId).toBe('f2');
  });
});

describe('applyFoundationalWrongRule', () => {
  it('increments consecutiveWrongCount on 1st wrong (no mastery reset)', () => {
    const word = makeWord({
      category: 'foundational',
      phase: 'learning',
      masteryCount: 2,
    });
    const result = applyFoundationalWrongRule(word, baseConfig);
    expect(result.consecutiveWrongCount).toBe(1);
    expect(result.masteryCount).toBe(2);
    expect(result.phase).toBe('learning');
  });

  it('increments consecutiveWrongCount on 2nd wrong (no mastery reset)', () => {
    const word = makeWord({
      category: 'foundational',
      phase: 'learning',
      masteryCount: 2,
      consecutiveWrongCount: 1,
    });
    const result = applyFoundationalWrongRule(word, baseConfig);
    expect(result.consecutiveWrongCount).toBe(2);
    expect(result.masteryCount).toBe(2);
  });

  it('resets mastery to 0 and consecutiveWrongCount on 3rd wrong', () => {
    const word = makeWord({
      category: 'foundational',
      phase: 'learning',
      masteryCount: 4,
      consecutiveWrongCount: 2,
    });
    const result = applyFoundationalWrongRule(word, baseConfig);
    expect(result.masteryCount).toBe(0);
    expect(result.consecutiveWrongCount).toBe(0);
    expect(result.phase).toBe('learning');
  });

  it('returns non-foundational word unchanged', () => {
    const word = makeWord({
      category: 'curated',
      phase: 'learning',
      masteryCount: 3,
      consecutiveWrongCount: 2,
    });
    const result = applyFoundationalWrongRule(word, baseConfig);
    expect(result).toEqual(word);
  });

  it('treats undefined consecutiveWrongCount as 0', () => {
    const word = makeWord({
      category: 'foundational',
      phase: 'learning',
      masteryCount: 1,
    });
    // consecutiveWrongCount is undefined by default
    expect(word.consecutiveWrongCount).toBeUndefined();
    const result = applyFoundationalWrongRule(word, baseConfig);
    expect(result.consecutiveWrongCount).toBe(1);
    expect(result.masteryCount).toBe(1);
  });
});

describe('getFoundationalAllocation', () => {
  it('returns 2 slots (20%) for active pool with batchSize 10', () => {
    const words = [
      makeWord({ category: 'foundational', masteryCount: 2 }),
      makeWord({ category: 'foundational', masteryCount: 3 }),
    ];
    const result = getFoundationalAllocation(10, words, baseConfig);
    expect(result.slots).toBe(2);
    expect(result.poolDepleted).toBe(false);
  });

  it('returns 3 slots (20%) for active pool with batchSize 15', () => {
    const words = [makeWord({ category: 'foundational', masteryCount: 1 })];
    const result = getFoundationalAllocation(15, words, baseConfig);
    expect(result.slots).toBe(3);
    expect(result.poolDepleted).toBe(false);
  });

  it('returns 1 slot (5%) for depleted pool with batchSize 10', () => {
    const words = [
      makeWord({ category: 'foundational', masteryCount: 5 }),
      makeWord({ category: 'foundational', masteryCount: 7 }),
    ];
    const result = getFoundationalAllocation(10, words, baseConfig);
    expect(result.slots).toBe(1);
    expect(result.poolDepleted).toBe(true);
  });

  it('returns 1 slot (5%) for depleted pool with batchSize 20', () => {
    const words = [makeWord({ category: 'foundational', masteryCount: 10 })];
    const result = getFoundationalAllocation(20, words, baseConfig);
    expect(result.slots).toBe(1);
    expect(result.poolDepleted).toBe(true);
  });

  it('treats empty foundational words as depleted', () => {
    const result = getFoundationalAllocation(10, [], baseConfig);
    expect(result.poolDepleted).toBe(true);
    expect(result.slots).toBe(1);
  });

  it('is not depleted when some words are below threshold', () => {
    const words = [
      makeWord({ category: 'foundational', masteryCount: 5 }),
      makeWord({ category: 'foundational', masteryCount: 2 }),
    ];
    const result = getFoundationalAllocation(10, words, baseConfig);
    expect(result.poolDepleted).toBe(false);
    expect(result.slots).toBe(2);
  });

  it('is depleted when all words are at or above threshold', () => {
    const words = [
      makeWord({ category: 'foundational', masteryCount: 5 }),
      makeWord({ category: 'foundational', masteryCount: 6 }),
    ];
    const result = getFoundationalAllocation(10, words, baseConfig);
    expect(result.poolDepleted).toBe(true);
    expect(result.slots).toBe(1);
  });

  it('returns 0 slots for batchSize 1 (round(0.2)=0, round(0.05)=0)', () => {
    const words = [makeWord({ category: 'foundational', masteryCount: 1 })];
    const result = getFoundationalAllocation(1, words, baseConfig);
    expect(result.slots).toBe(0);
    expect(result.poolDepleted).toBe(false);
  });

  it('returns 0 slots for batchSize 0', () => {
    const words = [makeWord({ category: 'foundational', masteryCount: 1 })];
    const result = getFoundationalAllocation(0, words, baseConfig);
    expect(result.slots).toBe(0);
    expect(result.poolDepleted).toBe(false);
  });
});
