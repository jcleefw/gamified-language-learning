/**
 * Integration: foundational batch allocation lifecycle
 *
 * Tests the cross-module boundary between mastery progression (updateMastery),
 * foundational pool depletion (getFoundationalAllocation), and batch composition
 * (composeBatch). Unit tests cover each function in isolation; these tests verify
 * that real updateMastery-driven word states produce correct allocation modes
 * and that foundational words are ordered correctly within composed batches.
 *
 * Scenarios:
 * - Active pool (some foundational words below mastery threshold) returns poolDepleted=false and 20% slots
 * - Depleted pool (all foundational words past mastery threshold via updateMastery) returns poolDepleted=true and 5% slots
 * - Foundational srsM2_review words appear after curated carry-over and before new learning words in composeBatch
 * - Depletion transition: promoting remaining foundational words past threshold shifts allocation from 20% to 5%
 */
import { describe, it, expect } from 'vitest';
import {
  updateMastery,
  composeBatch,
  getFoundationalAllocation,
} from '../../src/index.js';
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
  foundationalAllocation: { active: 0.2, postDepletion: 0.05 },
  desiredRetention: 0.9,
  maxIntervalDays: 90,
};

function makeLearningWord(
  wordId: string,
  category: WordState['category'],
): WordState {
  return {
    wordId,
    category,
    masteryCount: 0,
    phase: 'learning',
    lapseCount: 0,
    correctCount: 0,
    wrongCount: 0,
  };
}

function promoteToReview(word: WordState, cfg: SrsConfig = config): WordState {
  let w = word;
  while (w.phase === 'learning') w = updateMastery(w, true, cfg);
  return w;
}

describe('foundational-allocation-lifecycle integration', () => {
  it('active pool returns poolDepleted=false and 20% slots when some foundational words are below threshold', () => {
    const foundBelow1 = makeLearningWord('uno', 'foundational');
    const foundBelow2 = makeLearningWord('dos', 'foundational');
    const foundAbove = promoteToReview(
      makeLearningWord('tres', 'foundational'),
    );

    const result = getFoundationalAllocation(
      config.batchSize,
      [foundBelow1, foundBelow2, foundAbove],
      config,
    );

    expect(result.poolDepleted).toBe(false);
    expect(result.slots).toBe(2); // Math.round(10 * 0.2) = 2
  });

  it('depleted pool returns poolDepleted=true and 5% slots when all foundational words are past threshold', () => {
    const depletedPool = [
      promoteToReview(makeLearningWord('uno', 'foundational')),
      promoteToReview(makeLearningWord('dos', 'foundational')),
      promoteToReview(makeLearningWord('tres', 'foundational')),
    ];

    const result = getFoundationalAllocation(
      config.batchSize,
      depletedPool,
      config,
    );

    expect(result.poolDepleted).toBe(true);
    expect(result.slots).toBe(1); // Math.round(10 * 0.05) = 1
  });

  it('foundational srsM2_review words appear after curated carry-over and before new learning words in composeBatch', () => {
    const curatedCarryOver = promoteToReview(
      makeLearningWord('hola', 'curated'),
    );
    const foundationalRevision = promoteToReview(
      makeLearningWord('uno', 'foundational'),
    );
    const newWord = makeLearningWord('buenas', 'curated');

    const batch = composeBatch(
      [foundationalRevision, newWord, curatedCarryOver],
      config,
    );

    expect(batch.questions[0].wordId).toBe('hola'); // curated carry-over first
    expect(batch.questions[1].wordId).toBe('uno'); // foundational revision second
    expect(batch.questions[2].wordId).toBe('buenas'); // new word third
  });

  it('depletion transition shifts allocation from 20% to 5% when remaining foundational words are promoted past threshold', () => {
    const word1 = makeLearningWord('uno', 'foundational');
    const word2 = makeLearningWord('dos', 'foundational');

    const promoted1 = promoteToReview(word1);

    // Active pool: promoted1 is above threshold, word2 is still in learning
    const activeResult = getFoundationalAllocation(
      config.batchSize,
      [promoted1, word2],
      config,
    );
    expect(activeResult.poolDepleted).toBe(false);
    expect(activeResult.slots).toBe(2); // Math.round(10 * 0.2) = 2

    // Depleted pool: promote word2 past threshold
    const promoted2 = promoteToReview(word2);
    const depletedResult = getFoundationalAllocation(
      config.batchSize,
      [promoted1, promoted2],
      config,
    );
    expect(depletedResult.poolDepleted).toBe(true);
    expect(depletedResult.slots).toBe(1); // Math.round(10 * 0.05) = 1
  });
});
