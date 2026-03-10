import type { WordState } from '../types.js';
import type { ReviewResult } from './types.js';

export interface SpacedRepetitionScheduler {
  /**
   * Process a review and return the next interval + updated FSRS state.
   * Only call for words in 'srsM2_review' phase.
   */
  scheduleReview(state: WordState, isCorrect: boolean): ReviewResult;

  /**
   * Return days until next review without recording a review event.
   * Returns 1 for words with no prior FSRS state.
   */
  getNextInterval(state: WordState): number;
}
