import { describe, it, expect } from 'vitest';
import { composeBatch } from '../batch.js';
import type { WordState, SrsConfig } from '../types.js';

const baseConfig: SrsConfig = {
  masteryThreshold: { curated: 10, foundational: 5 },
  lapseThreshold: 3,
  batchSize: 15,
  activeWordLimit: 20,
  newWordsPerBatch: 3,
  shelveAfterBatches: 3,
  maxShelved: 50,
  continuousWrongThreshold: 3,
  questionTypeSplit: { mc: 70, wordBlock: 20, audio: 10 },
  foundationalAllocation: { active: 3, postDepletion: 0 },
  desiredRetention: 0.9,
  maxIntervalDays: 90,
};

function makeWordState(overrides: Partial<WordState> = {}): WordState {
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

describe('composeBatch — priority ordering', () => {
  it('prioritizes carry-over (curated, srsM2_review) first', () => {
    const carryOver = [
      makeWordState({
        wordId: 'carry-1',
        category: 'curated',
        phase: 'srsM2_review',
      }),
      makeWordState({
        wordId: 'carry-2',
        category: 'curated',
        phase: 'srsM2_review',
      }),
    ];
    const newWords = [
      makeWordState({
        wordId: 'new-1',
        category: 'curated',
        phase: 'learning',
      }),
    ];

    const batch = composeBatch([...newWords, ...carryOver], baseConfig);

    expect(batch.questions[0].wordId).toBe('carry-1');
    expect(batch.questions[1].wordId).toBe('carry-2');
    expect(batch.questions[2].wordId).toBe('new-1');
  });

  it('prioritizes foundational revision (foundational, srsM2_review) second', () => {
    const carryOver = [
      makeWordState({
        wordId: 'carry-1',
        category: 'curated',
        phase: 'srsM2_review',
      }),
    ];
    const foundRevision = [
      makeWordState({
        wordId: 'found-rev-1',
        category: 'foundational',
        phase: 'srsM2_review',
      }),
    ];
    const newWords = [
      makeWordState({
        wordId: 'new-1',
        category: 'curated',
        phase: 'learning',
      }),
    ];

    const batch = composeBatch(
      [...newWords, ...foundRevision, ...carryOver],
      baseConfig,
    );

    expect(batch.questions[0].wordId).toBe('carry-1');
    expect(batch.questions[1].wordId).toBe('found-rev-1');
    expect(batch.questions[2].wordId).toBe('new-1');
  });

  it('prioritizes new words (curated, learning) third', () => {
    const carryOver = [
      makeWordState({
        wordId: 'carry-1',
        category: 'curated',
        phase: 'srsM2_review',
      }),
    ];
    const foundRevision = [
      makeWordState({
        wordId: 'found-rev-1',
        category: 'foundational',
        phase: 'srsM2_review',
      }),
    ];
    const newWords = [
      makeWordState({
        wordId: 'new-1',
        category: 'curated',
        phase: 'learning',
      }),
      makeWordState({
        wordId: 'new-2',
        category: 'curated',
        phase: 'learning',
      }),
    ];
    const foundLearning = [
      makeWordState({
        wordId: 'found-learn-1',
        category: 'foundational',
        phase: 'learning',
      }),
    ];

    const batch = composeBatch(
      [...foundLearning, ...newWords, ...foundRevision, ...carryOver],
      baseConfig,
    );

    expect(batch.questions[0].wordId).toBe('carry-1');
    expect(batch.questions[1].wordId).toBe('found-rev-1');
    expect(batch.questions[2].wordId).toBe('new-1');
    expect(batch.questions[3].wordId).toBe('new-2');
    expect(batch.questions[4].wordId).toBe('found-learn-1');
  });

  it('includes foundational learning (foundational, learning) last', () => {
    const foundLearning = [
      makeWordState({
        wordId: 'found-learn-1',
        category: 'foundational',
        phase: 'learning',
      }),
      makeWordState({
        wordId: 'found-learn-2',
        category: 'foundational',
        phase: 'learning',
      }),
    ];
    const batch = composeBatch(foundLearning, baseConfig);

    expect(batch.questions[0].wordId).toBe('found-learn-1');
    expect(batch.questions[1].wordId).toBe('found-learn-2');
  });

  it('respects batchSize limit', () => {
    const words = Array.from({ length: 25 }, (_, i) =>
      makeWordState({
        wordId: `word-${i}`,
        category: 'curated',
        phase: 'learning',
      }),
    );

    const batch = composeBatch(words, baseConfig);

    expect(batch.questions.length).toBe(15);
  });

  it('returns fewer questions when pool is smaller than batchSize', () => {
    const words = Array.from({ length: 10 }, (_, i) =>
      makeWordState({
        wordId: `word-${i}`,
        category: 'curated',
        phase: 'learning',
      }),
    );

    const batch = composeBatch(words, baseConfig);

    expect(batch.questions.length).toBe(10);
    expect(batch.batchSize).toBe(10);
  });

  it('returns empty batch when no words available', () => {
    const batch = composeBatch([], baseConfig);

    expect(batch.questions.length).toBe(0);
    expect(batch.batchSize).toBe(0);
  });

  it('does not mutate input wordStates', () => {
    const words = [
      makeWordState({
        wordId: 'word-1',
        category: 'curated',
        phase: 'learning',
      }),
    ];
    const original = JSON.stringify(words);

    composeBatch(words, baseConfig);

    expect(JSON.stringify(words)).toBe(original);
  });
});

describe('composeBatch — question type distribution', () => {
  it('distributes question types with ~70% MC, ~20% word-block, ~10% audio', () => {
    const words = Array.from({ length: 100 }, (_, i) =>
      makeWordState({
        wordId: `word-${i}`,
        category: 'curated',
        phase: 'learning',
      }),
    );
    const configWith100 = { ...baseConfig, batchSize: 100 };

    const batch = composeBatch(words, configWith100);

    // Check distribution is approximately correct (with integer rounding)
    expect(batch.distributionBreakdown.mc).toBeGreaterThanOrEqual(65);
    expect(batch.distributionBreakdown.mc).toBeLessThanOrEqual(75);
    expect(batch.distributionBreakdown.wordBlock).toBeGreaterThanOrEqual(15);
    expect(batch.distributionBreakdown.wordBlock).toBeLessThanOrEqual(25);
    expect(batch.distributionBreakdown.audio).toBeGreaterThanOrEqual(5);
    expect(batch.distributionBreakdown.audio).toBeLessThanOrEqual(15);
  });

  it('assigns correct number of each question type in questions array', () => {
    const words = Array.from({ length: 20 }, (_, i) =>
      makeWordState({
        wordId: `word-${i}`,
        category: 'curated',
        phase: 'learning',
      }),
    );
    const configWith20 = { ...baseConfig, batchSize: 20 };

    const batch = composeBatch(words, configWith20);

    const mcCount = batch.questions.filter(
      (q): boolean => q.type === 'mc',
    ).length;
    const wordBlockCount = batch.questions.filter(
      (q): boolean => q.type === 'wordBlock',
    ).length;
    const audioCount = batch.questions.filter(
      (q): boolean => q.type === 'audio',
    ).length;

    expect(mcCount).toBe(batch.distributionBreakdown.mc);
    expect(wordBlockCount).toBe(batch.distributionBreakdown.wordBlock);
    expect(audioCount).toBe(batch.distributionBreakdown.audio);
  });

  it('sums to batchSize: mc + wordBlock + audio = batchSize', () => {
    const words = Array.from({ length: 50 }, (_, i) =>
      makeWordState({
        wordId: `word-${i}`,
        category: 'curated',
        phase: 'learning',
      }),
    );
    const configWith50 = { ...baseConfig, batchSize: 50 };

    const batch = composeBatch(words, configWith50);

    const sum =
      batch.distributionBreakdown.mc +
      batch.distributionBreakdown.wordBlock +
      batch.distributionBreakdown.audio;

    expect(sum).toBe(batch.batchSize);
  });
});

describe('composeBatch — audio redistribution', () => {
  it('redistributes audio slots to MC when audioAvailable is false', () => {
    const words = Array.from({ length: 30 }, (_, i) =>
      makeWordState({
        wordId: `word-${i}`,
        category: 'curated',
        phase: 'learning',
      }),
    );
    const configWith30 = { ...baseConfig, batchSize: 30 };

    const batchWithAudio = composeBatch(words, configWith30, {
      audioAvailable: true,
    });
    const batchWithoutAudio = composeBatch(words, configWith30, {
      audioAvailable: false,
    });

    // Without audio, audio count should be 0
    expect(batchWithoutAudio.distributionBreakdown.audio).toBe(0);

    // Without audio, MC should increase by the audio count
    expect(batchWithoutAudio.distributionBreakdown.mc).toBe(
      batchWithAudio.distributionBreakdown.mc +
        batchWithAudio.distributionBreakdown.audio,
    );

    // Total should remain the same
    expect(
      batchWithoutAudio.distributionBreakdown.mc +
        batchWithoutAudio.distributionBreakdown.wordBlock,
    ).toBe(
      batchWithAudio.distributionBreakdown.mc +
        batchWithAudio.distributionBreakdown.wordBlock +
        batchWithAudio.distributionBreakdown.audio,
    );
  });

  it('defaults to audioAvailable=true when option not provided', () => {
    const words = Array.from({ length: 20 }, (_, i) =>
      makeWordState({
        wordId: `word-${i}`,
        category: 'curated',
        phase: 'learning',
      }),
    );
    const configWith20 = { ...baseConfig, batchSize: 20 };

    const batchDefault = composeBatch(words, configWith20);
    const batchExplicit = composeBatch(words, configWith20, {
      audioAvailable: true,
    });

    expect(batchDefault.distributionBreakdown.audio).toBe(
      batchExplicit.distributionBreakdown.audio,
    );
    expect(batchDefault.distributionBreakdown.mc).toBe(
      batchExplicit.distributionBreakdown.mc,
    );
  });

  it('assigns audio types to actual questions only when audioAvailable=true', () => {
    const words = Array.from({ length: 15 }, (_, i) =>
      makeWordState({
        wordId: `word-${i}`,
        category: 'curated',
        phase: 'learning',
      }),
    );

    const batchWithAudio = composeBatch(words, baseConfig, {
      audioAvailable: true,
    });
    const batchWithoutAudio = composeBatch(words, baseConfig, {
      audioAvailable: false,
    });

    const audioQuestionsWithAudio = batchWithAudio.questions.filter(
      (q): boolean => q.type === 'audio',
    );
    const audioQuestionsWithoutAudio = batchWithoutAudio.questions.filter(
      (q): boolean => q.type === 'audio',
    );

    expect(audioQuestionsWithAudio.length).toBeGreaterThan(0);
    expect(audioQuestionsWithoutAudio.length).toBe(0);
  });

  it('maintains batchSize when redistributing audio', () => {
    const words = Array.from({ length: 25 }, (_, i) =>
      makeWordState({
        wordId: `word-${i}`,
        category: 'curated',
        phase: 'learning',
      }),
    );
    const configWith25 = { ...baseConfig, batchSize: 25 };

    const batchWithAudio = composeBatch(words, configWith25, {
      audioAvailable: true,
    });
    const batchWithoutAudio = composeBatch(words, configWith25, {
      audioAvailable: false,
    });

    expect(batchWithAudio.batchSize).toBe(batchWithoutAudio.batchSize);
    expect(batchWithAudio.questions.length).toBe(
      batchWithoutAudio.questions.length,
    );
  });
});
