/**
 * Integration: foundational active limit and continuous wrong rule lifecycle
 *
 * Tests the cross-module boundary between mastery progression (updateMastery)
 * and foundational mechanics (getActiveFoundationalWords, applyFoundationalWrongRule).
 * Unit tests for foundational.ts use hand-crafted fixtures; these tests verify
 * that words driven through real updateMastery progressions are correctly
 * classified and transformed by the foundational module.
 *
 * Scenarios:
 * - Foundational words partially mastered via updateMastery are counted as active
 * - Active limit reports availableSlots=0 when 3+ foundational words are in learning
 * - 3 consecutive wrongs via applyFoundationalWrongRule resets mastery built by updateMastery
 * - Correct answer via updateMastery after 2 wrongs preserves consecutiveWrongCount (separate functions)
 * - Curated words promoted via updateMastery are unaffected by applyFoundationalWrongRule
 */
import { describe, it, expect } from 'vitest';
import {
  updateMastery,
  getActiveFoundationalWords,
  applyFoundationalWrongRule,
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
  category: WordState['category'] = 'foundational',
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

function applyCorrectAnswers(word: WordState, count: number): WordState {
  let w = word;
  for (let i = 0; i < count; i++) w = updateMastery(w, true, config);
  return w;
}

function promoteToReview(word: WordState): WordState {
  let w = word;
  while (w.phase === 'learning') w = updateMastery(w, true, config);
  return w;
}

describe('foundational-lifecycle integration', () => {
  it('foundational words partially mastered via updateMastery are counted as active', () => {
    const partial1 = applyCorrectAnswers(makeLearningWord('uno'), 2);
    const partial2 = applyCorrectAnswers(makeLearningWord('dos'), 3);
    const promoted = promoteToReview(makeLearningWord('tres'));

    expect(partial1.phase).toBe('learning');
    expect(partial2.phase).toBe('learning');
    expect(promoted.phase).toBe('srsM2_review');

    const result = getActiveFoundationalWords(
      [partial1, partial2, promoted],
    );

    expect(result.active.length).toBe(2);
    expect(result.availableSlots).toBe(1);
    expect(result.eligible.length).toBe(1);
    expect(result.eligible[0].wordId).toBe('tres');
  });

  it('active limit reports availableSlots=0 when 3+ foundational words are in learning', () => {
    const word1 = applyCorrectAnswers(makeLearningWord('uno'), 1);
    const word2 = applyCorrectAnswers(makeLearningWord('dos'), 2);
    const word3 = applyCorrectAnswers(makeLearningWord('tres'), 3);
    const word4 = applyCorrectAnswers(makeLearningWord('cuatro'), 4);

    const result = getActiveFoundationalWords(
      [word1, word2, word3, word4],
    );

    expect(result.active.length).toBe(4);
    expect(result.availableSlots).toBe(0);
  });

  it('3 consecutive wrongs via applyFoundationalWrongRule resets mastery built by updateMastery', () => {
    let word = applyCorrectAnswers(makeLearningWord('uno'), 4);
    expect(word.masteryCount).toBe(4);
    expect(word.phase).toBe('learning');

    word = applyFoundationalWrongRule(word, config);
    expect(word.masteryCount).toBe(4);
    expect(word.consecutiveWrongCount).toBe(1);

    word = applyFoundationalWrongRule(word, config);
    expect(word.masteryCount).toBe(4);
    expect(word.consecutiveWrongCount).toBe(2);

    word = applyFoundationalWrongRule(word, config);
    expect(word.masteryCount).toBe(0);
    expect(word.consecutiveWrongCount).toBe(0);
    expect(word.phase).toBe('learning');
  });

  it('correct answer via updateMastery after 2 wrongs preserves consecutiveWrongCount', () => {
    let word = applyCorrectAnswers(makeLearningWord('uno'), 3);
    expect(word.masteryCount).toBe(3);

    word = applyFoundationalWrongRule(word, config);
    word = applyFoundationalWrongRule(word, config);
    expect(word.consecutiveWrongCount).toBe(2);

    word = updateMastery(word, true, config);
    expect(word.masteryCount).toBe(4);
    expect(word.consecutiveWrongCount).toBe(2);
  });

  it('curated words promoted via updateMastery are unaffected by applyFoundationalWrongRule', () => {
    const curated = applyCorrectAnswers(makeLearningWord('hola', 'curated'), 5);
    expect(curated.phase).toBe('learning');
    expect(curated.masteryCount).toBe(5);

    const afterRule = applyFoundationalWrongRule(curated, config);

    expect(afterRule).toEqual(curated);
  });
});
