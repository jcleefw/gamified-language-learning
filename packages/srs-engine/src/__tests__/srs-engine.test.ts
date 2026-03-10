import { describe, it, expect } from 'vitest';
import { SrsEngine } from '../srs-engine.js';
import type { WordState, SrsConfig } from '../types.js';

const baseConfig: SrsConfig = {
  masteryThreshold: { curated: 3, foundational: 2 },
  lapseThreshold: 3,
  batchSize: 10,
  activeWordLimit: 20,
  newWordsPerBatch: 5,
  shelveAfterBatches: 3,
  maxShelved: 2,
  continuousWrongThreshold: 3,
  questionTypeSplit: { mc: 0.7, wordBlock: 0.2, audio: 0.1 },
  foundationalAllocation: { active: 0.2, postDepletion: 0.05 },
  desiredRetention: 0.9,
  maxIntervalDays: 90,
};

function makeLearning(overrides: Partial<WordState> = {}): WordState {
  return {
    wordId: 'word-1',
    category: 'curated',
    masteryCount: 0,
    phase: 'learning',
    lapseCount: 0,
    correctCount: 0,
    wrongCount: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Config validation
// ---------------------------------------------------------------------------

describe('SrsEngine — config validation', () => {
  it('constructs without error given a valid config', () => {
    expect(() => new SrsEngine(baseConfig)).not.toThrow();
  });

  it('throws when batchSize is 0', () => {
    expect(() => new SrsEngine({ ...baseConfig, batchSize: 0 })).toThrow(
      'batchSize',
    );
  });

  it('throws when batchSize is negative', () => {
    expect(() => new SrsEngine({ ...baseConfig, batchSize: -1 })).toThrow(
      'batchSize',
    );
  });

  it('throws when masteryThreshold.curated is 0', () => {
    expect(
      () =>
        new SrsEngine({
          ...baseConfig,
          masteryThreshold: { curated: 0, foundational: 2 },
        }),
    ).toThrow('masteryThreshold.curated');
  });

  it('throws when masteryThreshold.foundational is 0', () => {
    expect(
      () =>
        new SrsEngine({
          ...baseConfig,
          masteryThreshold: { curated: 3, foundational: 0 },
        }),
    ).toThrow('masteryThreshold.foundational');
  });

  it('throws when lapseThreshold is 0', () => {
    expect(() => new SrsEngine({ ...baseConfig, lapseThreshold: 0 })).toThrow(
      'lapseThreshold',
    );
  });

  it('throws when activeWordLimit is 0', () => {
    expect(() => new SrsEngine({ ...baseConfig, activeWordLimit: 0 })).toThrow(
      'activeWordLimit',
    );
  });

  it('throws when newWordsPerBatch is 0', () => {
    expect(() => new SrsEngine({ ...baseConfig, newWordsPerBatch: 0 })).toThrow(
      'newWordsPerBatch',
    );
  });

  it('throws when shelveAfterBatches is 0', () => {
    expect(
      () => new SrsEngine({ ...baseConfig, shelveAfterBatches: 0 }),
    ).toThrow('shelveAfterBatches');
  });

  it('throws when maxShelved is 0', () => {
    expect(() => new SrsEngine({ ...baseConfig, maxShelved: 0 })).toThrow(
      'maxShelved',
    );
  });

  it('throws when continuousWrongThreshold is 0', () => {
    expect(
      () => new SrsEngine({ ...baseConfig, continuousWrongThreshold: 0 }),
    ).toThrow('continuousWrongThreshold');
  });

  it('throws when desiredRetention is 0', () => {
    expect(() => new SrsEngine({ ...baseConfig, desiredRetention: 0 })).toThrow(
      'desiredRetention',
    );
  });

  it('throws when desiredRetention exceeds 1', () => {
    expect(
      () => new SrsEngine({ ...baseConfig, desiredRetention: 1.1 }),
    ).toThrow('desiredRetention');
  });

  it('throws when maxIntervalDays is 0', () => {
    expect(() => new SrsEngine({ ...baseConfig, maxIntervalDays: 0 })).toThrow(
      'maxIntervalDays',
    );
  });
});

// ---------------------------------------------------------------------------
// composeBatch
// ---------------------------------------------------------------------------

describe('SrsEngine — composeBatch', () => {
  it('returns a batch from word states', () => {
    const engine = new SrsEngine(baseConfig);
    const words = [
      makeLearning({ wordId: 'w1' }),
      makeLearning({ wordId: 'w2' }),
      makeLearning({ wordId: 'w3' }),
    ];
    const batch = engine.composeBatch(words);
    expect(batch.questions.length).toBeGreaterThan(0);
    expect(batch.batchSize).toBe(batch.questions.length);
  });

  it('excludes shelved words from the batch', () => {
    const engine = new SrsEngine(baseConfig);
    const shelvedUntil = new Date(Date.now() + 60_000);
    const words = [
      makeLearning({ wordId: 'w1' }),
      makeLearning({ wordId: 'w2', shelvedUntil }),
    ];
    const batch = engine.composeBatch(words);
    const ids = batch.questions.map((q) => q.wordId);
    expect(ids).toContain('w1');
    expect(ids).not.toContain('w2');
  });

  it('respects newWordsPerBatch limit for learning words', () => {
    const config = { ...baseConfig, newWordsPerBatch: 2, activeWordLimit: 20 };
    const engine = new SrsEngine(config);
    const words = Array.from({ length: 5 }, (_, i) =>
      makeLearning({ wordId: `w${i}` }),
    );
    const batch = engine.composeBatch(words);
    expect(batch.questions.length).toBe(2);
  });
});
