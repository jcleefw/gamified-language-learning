import type { WordState, SrsConfig, QuizAnswer, Batch } from './types.js';
import { composeBatch, type ComposeBatchOptions } from './batch.js';
import { updateMastery } from './mastery.js';
import { getEligibleWords } from './active-window.js';
import { detectStuckWords, shelveWord, isShelved } from './stuck-words.js';
import { applyFoundationalWrongRule } from './foundational.js';
import { FsrsScheduler } from './scheduling/FsrsScheduler.js';

const SHELVE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

/** Orchestrates word learning sessions — composes quiz batches and processes answers. */
export class SrsEngine {
  private readonly config: SrsConfig;
  private readonly scheduler: FsrsScheduler;

  constructor(config: SrsConfig) {
    validateConfig(config);
    this.config = config;
    this.scheduler = new FsrsScheduler(config);
  }

  /**
   * Builds the next quiz batch, skipping shelved words
   * and respecting the active word limit.
   */
  composeBatch(wordStates: WordState[], options?: ComposeBatchOptions): Batch {
    const unshelved = wordStates.filter((w) => !isShelved(w));
    const { active, newSlots, eligible } = getEligibleWords(
      unshelved,
      this.config,
    );
    const mastered = unshelved.filter((w) => w.phase === 'mastered');
    const forBatch = [...active, ...eligible.slice(0, newSlots), ...mastered];
    return composeBatch(forBatch, this.config, options);
  }

  /**
   * Applies a set of quiz answers to word states. Updates mastery,
   * schedules future reviews, and shelves any words that are stuck.
   */
  processAnswers(answers: QuizAnswer[], wordStates: WordState[]): WordState[] {
    const answersMap = new Map(answers.map((a) => [a.wordId, a]));

    let updated = wordStates.map((state) => {
      const answer = answersMap.get(state.wordId);
      if (answer === undefined) return state;

      // 1. Mastery update
      let next = updateMastery(state, answer.isCorrect, this.config);

      // 2. FSRS scheduling — for words in srsM2_review or mastered before this answer
      if (state.phase === 'srsM2_review' || state.phase === 'mastered') {
        const result = this.scheduler.scheduleReview(state, answer.isCorrect);
        next = { ...next, fsrsState: result.updatedFsrsState };
      }

      // 3. Foundational wrong/correct rule — only for learning-phase foundational words
      if (state.category === 'foundational' && state.phase === 'learning') {
        if (!answer.isCorrect) {
          next = applyFoundationalWrongRule(next, this.config);
        } else {
          next = { ...next, consecutiveWrongCount: 0 };
        }
      }

      // 4. Track batches without mastery progress (learning phase only)
      if (state.phase === 'learning') {
        const madeProgress = next.masteryCount > state.masteryCount;
        next = {
          ...next,
          batchesSinceLastProgress: madeProgress
            ? 0
            : (state.batchesSinceLastProgress ?? 0) + 1,
        };
      }

      return next;
    });

    // 5. Detect stuck words and shelve them
    const { toShelve } = detectStuckWords(updated, this.config);
    if (toShelve.length > 0) {
      const shelveIds = new Set(toShelve.map((w) => w.wordId));
      updated = updated.map((w) =>
        shelveIds.has(w.wordId) ? shelveWord(w, SHELVE_DURATION_MS) : w,
      );
    }

    return updated;
  }
}

/** Throws if any config value is out of the expected range. */
function validateConfig(config: SrsConfig): void {
  const fieldsToCheck: [number, string][] = [
    [config.batchSize, 'batchSize'],
    [config.masteryThreshold.curated, 'masteryThreshold.curated'],
    [config.masteryThreshold.foundational, 'masteryThreshold.foundational'],
    [config.lapseThreshold, 'lapseThreshold'],
    [config.activeWordLimit, 'activeWordLimit'],
    [config.newWordsPerBatch, 'newWordsPerBatch'],
    [config.shelveAfterBatches, 'shelveAfterBatches'],
    [config.maxShelved, 'maxShelved'],
    [config.continuousWrongThreshold, 'continuousWrongThreshold'],
    [config.maxIntervalDays, 'maxIntervalDays'],
  ];
  for (const [value, name] of fieldsToCheck) {
    if (value <= 0) throw new Error(`SrsConfig: ${name} must be > 0`);
  }
  if (config.desiredRetention <= 0 || config.desiredRetention > 1)
    throw new Error(
      'SrsConfig: desiredRetention must be between 0 (exclusive) and 1 (inclusive)',
    );
}
