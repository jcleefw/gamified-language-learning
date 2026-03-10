/**
 * Integration: SRS lifecycle across `updateMastery` + `FsrsScheduler`
 *
 * Tests the cross-module boundary between mastery counting (updateMastery) and
 * FSRS scheduling (FsrsScheduler). These scenarios cannot be covered by unit
 * tests because they depend on the output of one module being valid input to
 * another across a realistic progression.
 *
 * Scenarios:
 * - Wrong answers in Learning floor at mastery=0 (no negative mastery)
 * - 10 correct answers in Learning promote word to srsM2_review phase
 * - FSRS review intervals grow monotonically across successive correct reviews
 * - 3 lapses in srsM2_review reset word back to Learning (mastery=0, lapseCount=0)
 */
import { describe, it, expect } from 'vitest';
import { updateMastery, FsrsScheduler } from '../../src/index.js';
import type { SrsConfig, WordState } from '../../src/index.js';

const config: SrsConfig = {
  masteryThreshold: { curated: 10, foundational: 5 },
  lapseThreshold: 3,
  batchSize: 10,
  activeWordLimit: 20,
  newWordsPerBatch: 3,
  shelveAfterBatches: 5,
  maxShelved: 50,
  continuousWrongThreshold: 3,
  questionTypeSplit: { mc: 0.6, wordBlock: 0.3, audio: 0.1 },
  foundationalAllocation: { active: 5, postDepletion: 0 },
  desiredRetention: 0.9,
  maxIntervalDays: 90,
};

function makeLearningWord(wordId: string): WordState {
  return {
    wordId,
    category: 'curated',
    masteryCount: 0,
    phase: 'learning',
    lapseCount: 0,
    correctCount: 0,
    wrongCount: 0,
  };
}

describe('SRS lifecycle integration', () => {
  it('wrong answers in Learning phase decrement mastery without going below 0', () => {
    let word = makeLearningWord('hola');
    // Build to mastery=3
    word = updateMastery(word, true, config);
    word = updateMastery(word, true, config);
    word = updateMastery(word, true, config);
    expect(word.masteryCount).toBe(3);

    // Two wrong hits
    word = updateMastery(word, false, config);
    word = updateMastery(word, false, config);
    expect(word.masteryCount).toBe(1);
    expect(word.phase).toBe('learning');

    // Wrong when mastery=0 stays at 0
    word = updateMastery(word, false, config);
    word = updateMastery(word, false, config);
    expect(word.masteryCount).toBe(0);
  });

  it('10 correct answers in Learning transition word to srsM2_review', () => {
    let word = makeLearningWord('gracias');
    for (let i = 0; i < 10; i++) {
      word = updateMastery(word, true, config);
    }
    expect(word.phase).toBe('srsM2_review');
    expect(word.masteryCount).toBe(10);
  });

  it('ANKI interval grows across successive correct reviews', () => {
    // Start in srsM2_review (already promoted)
    let word = makeLearningWord('buenas');
    for (let i = 0; i < 10; i++) {
      word = updateMastery(word, true, config);
    }
    expect(word.phase).toBe('srsM2_review');

    const scheduler = new FsrsScheduler(config);
    const intervals: number[] = [];

    for (let i = 0; i < 5; i++) {
      const result = scheduler.scheduleReview(word, true);
      // Backdate lastReview to simulate the card coming due on schedule
      word = {
        ...word,
        fsrsState: {
          ...result.updatedFsrsState,
          lastReview: new Date(
            Date.now() - result.nextIntervalDays * 86_400_000,
          ),
        },
      };
      intervals.push(result.nextIntervalDays);
    }

    // Each interval should be greater than or equal to the previous
    for (let i = 1; i < intervals.length; i++) {
      expect(intervals[i]).toBeGreaterThanOrEqual(intervals[i - 1]);
    }
    // First interval should be a small number of days (FSRS starts at ~3)
    expect(intervals[0]).toBeLessThan(10);
    // Final interval should approach the cap
    expect(intervals[intervals.length - 1]).toBeGreaterThan(10);
  });

  it('3 lapses in srsM2_review reset word to Learning with mastery=0 and lapseCount=0', () => {
    let word = makeLearningWord('adios');
    // Promote to srsM2_review
    for (let i = 0; i < 10; i++) {
      word = updateMastery(word, true, config);
    }
    expect(word.phase).toBe('srsM2_review');

    // First two lapses — still in srsM2_review
    word = updateMastery(word, false, config);
    expect(word.phase).toBe('srsM2_review');
    expect(word.lapseCount).toBe(1);

    word = updateMastery(word, false, config);
    expect(word.phase).toBe('srsM2_review');
    expect(word.lapseCount).toBe(2);

    // Third lapse triggers reset
    word = updateMastery(word, false, config);
    expect(word.phase).toBe('learning');
    expect(word.masteryCount).toBe(0);
    expect(word.lapseCount).toBe(0);
  });
});
