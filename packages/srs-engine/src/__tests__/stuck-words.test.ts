import { describe, it, expect } from 'vitest';
import {
  detectStuckWords,
  shelveWord,
  unshelveWord,
  isShelved,
} from '../stuck-words.js';
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
    wordId: `word-${Math.random().toString()}`,
    category: 'curated',
    masteryCount: 0,
    phase: 'learning',
    lapseCount: 0,
    correctCount: 0,
    wrongCount: 0,
    batchesSinceLastProgress: 0,
    shelvedUntil: null,
    ...overrides,
  };
}

describe('detectStuckWords', () => {
  describe('detection threshold', () => {
    it('does not flag words with progress < threshold (2 batches)', () => {
      const words = [makeWord({ batchesSinceLastProgress: 2 })];
      const result = detectStuckWords(words, baseConfig);
      expect(result.stuck).toHaveLength(0);
    });

    it('flags words at exactly threshold (3 batches)', () => {
      const words = [
        makeWord({ wordId: 'stuck-1', batchesSinceLastProgress: 3 }),
      ];
      const result = detectStuckWords(words, baseConfig);
      expect(result.stuck).toHaveLength(1);
      expect(result.stuck[0].wordId).toBe('stuck-1');
    });

    it('flags words above threshold (4 batches)', () => {
      const words = [makeWord({ batchesSinceLastProgress: 4 })];
      const result = detectStuckWords(words, baseConfig);
      expect(result.stuck).toHaveLength(1);
    });

    it('ignores words with undefined batchesSinceLastProgress (treats as 0)', () => {
      const words = [makeWord({ batchesSinceLastProgress: undefined })];
      const result = detectStuckWords(words, baseConfig);
      expect(result.stuck).toHaveLength(0);
    });

    it('identifies multiple stuck words', () => {
      const words = [
        makeWord({ wordId: 'stuck-1', batchesSinceLastProgress: 3 }),
        makeWord({ wordId: 'stuck-2', batchesSinceLastProgress: 4 }),
        makeWord({ wordId: 'ok-1', batchesSinceLastProgress: 2 }),
      ];
      const result = detectStuckWords(words, baseConfig);
      expect(result.stuck).toHaveLength(2);
      expect(result.stuck.map((w) => w.wordId)).toEqual(['stuck-1', 'stuck-2']);
    });
  });

  describe('shelving capacity & max-2 cap', () => {
    it('returns all stuck words in toShelve when none shelved and capacity available', () => {
      const words = [
        makeWord({ wordId: 'stuck-1', batchesSinceLastProgress: 3 }),
        makeWord({ wordId: 'stuck-2', batchesSinceLastProgress: 4 }),
      ];
      const result = detectStuckWords(words, baseConfig);
      expect(result.toShelve).toHaveLength(2);
      expect(result.toShelve.map((w) => w.wordId)).toEqual([
        'stuck-1',
        'stuck-2',
      ]);
      expect(result.canReShelve).toBe(true);
    });

    it('returns only 2 stuck words in toShelve when capacity is 2 and 3 stuck detected', () => {
      const words = [
        makeWord({ wordId: 'stuck-1', batchesSinceLastProgress: 3 }),
        makeWord({ wordId: 'stuck-2', batchesSinceLastProgress: 4 }),
        makeWord({ wordId: 'stuck-3', batchesSinceLastProgress: 5 }),
      ];
      const result = detectStuckWords(words, baseConfig);
      expect(result.toShelve).toHaveLength(2);
      expect(result.toShelve.map((w) => w.wordId)).toEqual([
        'stuck-1',
        'stuck-2',
      ]);
      expect(result.canReShelve).toBe(true); // capacity not yet exceeded
    });

    it('returns only newest stuck word when 2 already shelved (capacity = 0)', () => {
      const now = Date.now();
      const tomorrowMs = new Date(now + 86400000);
      const words = [
        makeWord({ wordId: 'shelved-1', shelvedUntil: tomorrowMs }),
        makeWord({ wordId: 'shelved-2', shelvedUntil: tomorrowMs }),
        makeWord({ wordId: 'stuck-1', batchesSinceLastProgress: 3 }),
        makeWord({ wordId: 'stuck-2', batchesSinceLastProgress: 4 }),
        makeWord({ wordId: 'stuck-3', batchesSinceLastProgress: 5 }),
      ];
      const result = detectStuckWords(words, baseConfig);
      expect(result.stuck).toHaveLength(3);
      expect(result.toShelve).toHaveLength(1);
      expect(result.toShelve[0].wordId).toBe('stuck-3'); // newest (last)
      expect(result.canReShelve).toBe(false);
    });

    it('returns partial toShelve when capacity is partially available', () => {
      const now = Date.now();
      const tomorrowMs = new Date(now + 86400000);
      const words = [
        makeWord({ wordId: 'shelved-1', shelvedUntil: tomorrowMs }),
        makeWord({ wordId: 'stuck-1', batchesSinceLastProgress: 3 }),
        makeWord({ wordId: 'stuck-2', batchesSinceLastProgress: 4 }),
        makeWord({ wordId: 'stuck-3', batchesSinceLastProgress: 5 }),
      ];
      const result = detectStuckWords(words, baseConfig);
      expect(result.toShelve).toHaveLength(1);
      expect(result.toShelve[0].wordId).toBe('stuck-1');
      expect(result.canReShelve).toBe(true);
    });
  });

  describe('isShelved status', () => {
    it('excludes expired shelves from current shelved count', () => {
      const now = Date.now();
      const pastMs = new Date(now - 1000); // 1 second ago
      const futureMs = new Date(now + 86400000); // 1 day from now
      const words = [
        makeWord({ wordId: 'expired-1', shelvedUntil: pastMs }),
        makeWord({ wordId: 'active-1', shelvedUntil: futureMs }),
        makeWord({ wordId: 'stuck-1', batchesSinceLastProgress: 3 }),
      ];
      const result = detectStuckWords(words, baseConfig);
      // Only 1 currently shelved word (expired doesn't count), so 1 stuck can be shelved
      expect(result.toShelve).toHaveLength(1);
      expect(result.canReShelve).toBe(true);
    });

    it('treats unshelved words as available capacity', () => {
      const words = [
        makeWord({ wordId: 'unshelved-1', shelvedUntil: null }),
        makeWord({ wordId: 'unshelved-2', shelvedUntil: null }),
        makeWord({ wordId: 'stuck-1', batchesSinceLastProgress: 3 }),
      ];
      const result = detectStuckWords(words, baseConfig);
      expect(result.toShelve).toHaveLength(1);
      expect(result.canReShelve).toBe(true);
    });
  });

  describe('canReShelve flag', () => {
    it('returns true when no words shelved', () => {
      const words = [makeWord()];
      const result = detectStuckWords(words, baseConfig);
      expect(result.canReShelve).toBe(true);
    });

    it('returns true when 1 word shelved (capacity = 1)', () => {
      const now = Date.now();
      const futureMs = new Date(now + 86400000);
      const words = [makeWord({ shelvedUntil: futureMs })];
      const result = detectStuckWords(words, baseConfig);
      expect(result.canReShelve).toBe(true);
    });

    it('returns false when 2 words shelved (capacity = 0)', () => {
      const now = Date.now();
      const futureMs = new Date(now + 86400000);
      const words = [
        makeWord({ shelvedUntil: futureMs }),
        makeWord({ shelvedUntil: futureMs }),
      ];
      const result = detectStuckWords(words, baseConfig);
      expect(result.canReShelve).toBe(false);
    });

    it('returns true when 1 of 2 shelved words has expired', () => {
      const now = Date.now();
      const pastMs = new Date(now - 1000);
      const futureMs = new Date(now + 86400000);
      const words = [
        makeWord({ shelvedUntil: pastMs }),
        makeWord({ shelvedUntil: futureMs }),
      ];
      const result = detectStuckWords(words, baseConfig);
      expect(result.canReShelve).toBe(true);
    });
  });

  describe('empty and edge inputs', () => {
    it('returns empty stuck array for empty word list', () => {
      const result = detectStuckWords([], baseConfig);
      expect(result.stuck).toHaveLength(0);
      expect(result.toShelve).toHaveLength(0);
      expect(result.canReShelve).toBe(true);
    });

    it('returns empty result when no words are stuck', () => {
      const words = [
        makeWord({ batchesSinceLastProgress: 0 }),
        makeWord({ batchesSinceLastProgress: 1 }),
        makeWord({ batchesSinceLastProgress: 2 }),
      ];
      const result = detectStuckWords(words, baseConfig);
      expect(result.stuck).toHaveLength(0);
      expect(result.toShelve).toHaveLength(0);
    });
  });

  describe('config variation', () => {
    it('respects different shelveAfterBatches threshold', () => {
      const configWith2Batches = { ...baseConfig, shelveAfterBatches: 2 };
      const words = [
        makeWord({ wordId: 'stuck-1', batchesSinceLastProgress: 2 }),
        makeWord({ wordId: 'ok-1', batchesSinceLastProgress: 1 }),
      ];
      const result = detectStuckWords(words, configWith2Batches);
      expect(result.stuck).toHaveLength(1);
      expect(result.stuck[0].wordId).toBe('stuck-1');
    });

    it('respects different maxShelved threshold', () => {
      const configWithMax3 = { ...baseConfig, maxShelved: 3 };
      const now = Date.now();
      const futureMs = new Date(now + 86400000);
      const words = [
        makeWord({ shelvedUntil: futureMs }),
        makeWord({ shelvedUntil: futureMs }),
        makeWord({ wordId: 'stuck-1', batchesSinceLastProgress: 3 }),
        makeWord({ wordId: 'stuck-2', batchesSinceLastProgress: 4 }),
      ];
      const result = detectStuckWords(words, configWithMax3);
      expect(result.toShelve).toHaveLength(1); // 1 slot available
      expect(result.canReShelve).toBe(true); // 2 more slots available
    });
  });
});

describe('shelveWord', () => {
  it('sets shelvedUntil to now + durationMs', () => {
    const now = Date.now();
    const word = makeWord();
    const durationMs = 86400000; // 1 day
    const shelved = shelveWord(word, durationMs);

    expect(shelved.shelvedUntil).not.toBeNull();
    expect(shelved.shelvedUntil!.getTime()).toBeGreaterThanOrEqual(
      now + durationMs,
    );
    expect(shelved.shelvedUntil!.getTime()).toBeLessThanOrEqual(
      now + durationMs + 100,
    ); // allow small timing variance
  });

  it('returns immutable copy (does not mutate original)', () => {
    const word = makeWord();
    const shelved = shelveWord(word, 86400000);

    expect(word.shelvedUntil).toBeNull();
    expect(shelved.shelvedUntil).not.toBeNull();
    expect(word).not.toBe(shelved);
  });

  it('preserves all other word properties', () => {
    const word = makeWord({
      wordId: 'test-1',
      masteryCount: 5,
      correctCount: 10,
      phase: 'srsM2_review',
    });
    const shelved = shelveWord(word, 86400000);

    expect(shelved.wordId).toBe('test-1');
    expect(shelved.masteryCount).toBe(5);
    expect(shelved.correctCount).toBe(10);
    expect(shelved.phase).toBe('srsM2_review');
  });

  it('works with different durations', () => {
    const now = Date.now();
    const word = makeWord();

    const shelved1h = shelveWord(word, 3600000);
    expect(shelved1h.shelvedUntil!.getTime()).toBeGreaterThanOrEqual(
      now + 3600000,
    );

    const shelved7d = shelveWord(word, 604800000);
    expect(shelved7d.shelvedUntil!.getTime()).toBeGreaterThanOrEqual(
      now + 604800000,
    );
  });
});

describe('unshelveWord', () => {
  it('clears shelvedUntil to null', () => {
    const now = Date.now();
    const futureMs = new Date(now + 86400000);
    const word = makeWord({ shelvedUntil: futureMs });
    const unshelved = unshelveWord(word);

    expect(unshelved.shelvedUntil).toBeNull();
  });

  it('returns immutable copy (does not mutate original)', () => {
    const now = Date.now();
    const futureMs = new Date(now + 86400000);
    const word = makeWord({ shelvedUntil: futureMs });
    const unshelved = unshelveWord(word);

    expect(word.shelvedUntil).not.toBeNull();
    expect(unshelved.shelvedUntil).toBeNull();
    expect(word).not.toBe(unshelved);
  });

  it('preserves all other word properties', () => {
    const now = Date.now();
    const futureMs = new Date(now + 86400000);
    const word = makeWord({
      wordId: 'test-1',
      masteryCount: 5,
      batchesSinceLastProgress: 3,
      shelvedUntil: futureMs,
    });
    const unshelved = unshelveWord(word);

    expect(unshelved.wordId).toBe('test-1');
    expect(unshelved.masteryCount).toBe(5);
    expect(unshelved.batchesSinceLastProgress).toBe(3);
  });

  it('works on already unshelved words', () => {
    const word = makeWord({ shelvedUntil: null });
    const unshelved = unshelveWord(word);

    expect(unshelved.shelvedUntil).toBeNull();
  });
});

describe('isShelved', () => {
  it('returns true for shelved word with future date', () => {
    const now = Date.now();
    const futureMs = new Date(now + 86400000);
    const word = makeWord({ shelvedUntil: futureMs });

    expect(isShelved(word)).toBe(true);
  });

  it('returns false for word with null shelvedUntil', () => {
    const word = makeWord({ shelvedUntil: null });
    expect(isShelved(word)).toBe(false);
  });

  it('returns false for expired shelved word (past date)', () => {
    const now = Date.now();
    const pastMs = new Date(now - 1000);
    const word = makeWord({ shelvedUntil: pastMs });

    expect(isShelved(word)).toBe(false);
  });

  it('returns false for word with undefined shelvedUntil', () => {
    const word = makeWord({ shelvedUntil: undefined });
    expect(isShelved(word)).toBe(false);
  });

  it('handles boundary at exact expiry time', () => {
    const now = Date.now();
    const word = makeWord({ shelvedUntil: new Date(now) });

    expect(isShelved(word)).toBe(false); // at exact time, not in future
  });

  it('handles immediate future (1ms from now)', () => {
    const now = Date.now();
    const word = makeWord({ shelvedUntil: new Date(now + 1) });

    expect(isShelved(word)).toBe(true);
  });
});

describe('integration: shelve → unshelve → isShelved flow', () => {
  it('shelves word and isShelved confirms it', () => {
    const word = makeWord();
    const shelved = shelveWord(word, 86400000);

    expect(isShelved(shelved)).toBe(true);
  });

  it('unshelves word and isShelved confirms it', () => {
    const now = Date.now();
    const futureMs = new Date(now + 86400000);
    const word = makeWord({ shelvedUntil: futureMs });
    const unshelved = unshelveWord(word);

    expect(isShelved(unshelved)).toBe(false);
  });

  it('cycle: shelve → unshelve → reshelve maintains consistency', () => {
    const word = makeWord();
    const shelved1 = shelveWord(word, 86400000);
    expect(isShelved(shelved1)).toBe(true);

    const unshelved = unshelveWord(shelved1);
    expect(isShelved(unshelved)).toBe(false);

    const shelved2 = shelveWord(unshelved, 86400000);
    expect(isShelved(shelved2)).toBe(true);
  });
});

describe('edge cases & time handling', () => {
  it('handles words with very long shelve duration', () => {
    const word = makeWord();
    const longDuration = 30 * 86400000; // 30 days
    const shelved = shelveWord(word, longDuration);

    expect(isShelved(shelved)).toBe(true);
  });

  it('handles zero duration shelf (immediately expires)', () => {
    const word = makeWord();
    const shelved = shelveWord(word, 0);

    // 0ms means it should be at or just past now, so immediately expired
    expect(isShelved(shelved)).toBe(false);
  });

  it('detectStuckWords handles all stuck, all capacity case', () => {
    const words = [
      makeWord({ wordId: 'stuck-1', batchesSinceLastProgress: 3 }),
      makeWord({ wordId: 'stuck-2', batchesSinceLastProgress: 4 }),
    ];
    const result = detectStuckWords(words, baseConfig);

    expect(result.stuck).toHaveLength(2);
    expect(result.toShelve).toHaveLength(2);
    expect(result.canReShelve).toBe(true);
  });

  it('detectStuckWords with mixed shelved and unshelved correctly counts capacity', () => {
    const now = Date.now();
    const futureMs = new Date(now + 86400000);
    const words = [
      makeWord({ wordId: 'shelved-1', shelvedUntil: futureMs }),
      makeWord({ wordId: 'stuck-1', batchesSinceLastProgress: 3 }),
      makeWord({ wordId: 'stuck-2', batchesSinceLastProgress: 4 }),
    ];
    const result = detectStuckWords(words, baseConfig);

    expect(result.stuck).toHaveLength(2);
    expect(result.toShelve).toHaveLength(1); // 1 slot available
    expect(result.toShelve[0].wordId).toBe('stuck-1');
    expect(result.canReShelve).toBe(true);
  });
});
