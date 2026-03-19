import { describe, it, expect } from 'vitest';
import { mockConsonants } from '../../../data/mock/mock-consonants.js';
import { mockWords } from '../../../data/mock/mock-words.js';
import { generateBatches } from '../../engine/compose-deck.js';
import { Deck, BatchConfig } from '../../types/deck.js';

const deck: Deck = {
  wordPool: mockWords.slice(0, 3),
  foundationalPool: mockConsonants.slice(0, 3),
};

const batchConfig: BatchConfig = {
  nonFoundationalFocusCount: 1,
  foundationalFocusCount: 1,
  questionLimit: 2,
};

describe('generateBatches', () => {
  it('returns correct number of batches', () => {
    const batches = generateBatches(deck, batchConfig);
    expect(batches).toHaveLength(3);
  });

  it('each batch has the correct focusWords count', () => {
    const batches = generateBatches(deck, batchConfig);
    for (const batch of batches) {
      expect(batch.focusWords).toHaveLength(batchConfig.nonFoundationalFocusCount);
    }
  });

  it('each batch has the correct focusFoundational count', () => {
    const batches = generateBatches(deck, batchConfig);
    for (const batch of batches) {
      expect(batch.focusFoundational).toHaveLength(batchConfig.foundationalFocusCount);
    }
  });

  it('batches cover all words in wordPool with no repeats', () => {
    const batches = generateBatches(deck, batchConfig);
    const allFocusIds = batches.flatMap(b => b.focusWords.map(w => w.id));
    const expectedIds = deck.wordPool.map(w => w.id);
    expect(allFocusIds.sort()).toEqual(expectedIds.sort());
  });

  it('each batch carries the correct questionLimit', () => {
    const batches = generateBatches(deck, batchConfig);
    for (const batch of batches) {
      expect(batch.questionLimit).toBe(batchConfig.questionLimit);
    }
  });
});
