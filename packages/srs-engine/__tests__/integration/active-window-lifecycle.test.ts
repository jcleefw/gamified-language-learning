/**
 * Integration: active window management and stuck word lifecycle
 *
 * Tests the cross-module boundary between mastery promotion (updateMastery),
 * active window slot calculation (getEligibleWords), and stuck word detection
 * (detectStuckWords / shelveWord / unshelveWord / isShelved). Unit tests for
 * each module use hand-crafted WordState fixtures; these tests verify that
 * words driven through real updateMastery progressions are correctly classified
 * by getEligibleWords, and that the shelve/unshelve state machine composes
 * correctly as a unit.
 *
 * Scenarios:
 * - Words promoted via updateMastery are counted as active by getEligibleWords
 * - newSlots decreases as the active window fills to activeWordLimit
 * - detectStuckWords identifies words at or above the shelveAfterBatches threshold
 * - shelveWord + isShelved + unshelveWord state transitions work end-to-end
 */
import { describe, it, expect } from 'vitest';
import {
  updateMastery,
  getEligibleWords,
  detectStuckWords,
  shelveWord,
  unshelveWord,
  isShelved,
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
  foundationalAllocation: { active: 5, postDepletion: 0 },
  desiredRetention: 0.9,
  maxIntervalDays: 90,
};

function makeLearningWord(
  wordId: string,
  category: WordState['category'] = 'curated',
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

describe('active-window-lifecycle integration', () => {
  it('words promoted via updateMastery are counted as active by getEligibleWords', () => {
    const active1 = promoteToReview(makeLearningWord('hola'));
    const active2 = promoteToReview(makeLearningWord('gracias'));
    const learning1 = makeLearningWord('buenas');
    const learning2 = makeLearningWord('adios');
    const learning3 = makeLearningWord('por favor');

    const result = getEligibleWords(
      [active1, active2, learning1, learning2, learning3],
      config,
    );

    expect(result.active.length).toBe(2);
    expect(result.eligible.length).toBe(3);
    expect(result.active.every((w) => w.phase === 'srsM2_review')).toBe(true);
    expect(result.eligible.every((w) => w.phase === 'learning')).toBe(true);
  });

  it('newSlots decreases as active window fills to activeWordLimit', () => {
    const windowConfig: SrsConfig = {
      ...config,
      activeWordLimit: 4,
      newWordsPerBatch: 3,
    };

    const active1 = promoteToReview(makeLearningWord('hola'), windowConfig);
    const active2 = promoteToReview(makeLearningWord('gracias'), windowConfig);
    const learning1 = makeLearningWord('buenas');
    const learning2 = makeLearningWord('adios');

    // 2 active → newSlots = min(3, 4-2) = 2
    const resultPartial = getEligibleWords(
      [active1, active2, learning1, learning2],
      windowConfig,
    );
    expect(resultPartial.active.length).toBe(2);
    expect(resultPartial.newSlots).toBe(2);

    // Fill window to 4 active → newSlots = 0
    const active3 = promoteToReview(makeLearningWord('si'), windowConfig);
    const active4 = promoteToReview(makeLearningWord('no'), windowConfig);

    const resultFull = getEligibleWords(
      [active1, active2, active3, active4, learning1],
      windowConfig,
    );
    expect(resultFull.active.length).toBe(4);
    expect(resultFull.newSlots).toBe(0);
  });

  it('detectStuckWords identifies words at or above the shelveAfterBatches threshold', () => {
    const shelveConfig: SrsConfig = {
      ...config,
      shelveAfterBatches: 3,
      maxShelved: 2,
    };

    const stuckWord1: WordState = {
      ...makeLearningWord('uno', 'foundational'),
      batchesSinceLastProgress: 3,
    };
    const stuckWord2: WordState = {
      ...makeLearningWord('dos', 'foundational'),
      batchesSinceLastProgress: 5,
    };
    const almostStuck: WordState = {
      ...makeLearningWord('tres', 'foundational'),
      batchesSinceLastProgress: 2,
    };
    const fineWord: WordState = {
      ...makeLearningWord('cuatro', 'foundational'),
      batchesSinceLastProgress: 0,
    };

    const result = detectStuckWords(
      [stuckWord1, stuckWord2, almostStuck, fineWord],
      shelveConfig,
    );

    expect(result.stuck.length).toBe(2);
    expect(result.stuck.map((w) => w.wordId)).toContain('uno');
    expect(result.stuck.map((w) => w.wordId)).toContain('dos');
    expect(result.toShelve.length).toBe(2);
    expect(result.canReShelve).toBe(true);
  });

  it('shelveWord + isShelved + unshelveWord state transitions work end-to-end', () => {
    const word = makeLearningWord('hola');

    // Shelve for 1 day → isShelved returns true
    const shelvedWord = shelveWord(word, 86_400_000);
    expect(isShelved(shelvedWord)).toBe(true);

    // Unshelve → isShelved returns false
    const unshelvedWord = unshelveWord(shelvedWord);
    expect(isShelved(unshelvedWord)).toBe(false);

    // Past shelvedUntil date → isShelved returns false (expired)
    const expiredWord: WordState = {
      ...word,
      shelvedUntil: new Date(Date.now() - 1000),
    };
    expect(isShelved(expiredWord)).toBe(false);
  });
});
