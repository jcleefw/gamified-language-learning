import {
  FSRS,
  Rating,
  State,
  createEmptyCard,
  generatorParameters,
} from 'ts-fsrs';
import type { Card } from 'ts-fsrs';
import type { FsrsCardState, SrsConfig, WordState } from '../types.js';
import type { SpacedRepetitionScheduler } from './scheduler.interface.js';
import type { ReviewResult } from './types.js';

export class FsrsScheduler implements SpacedRepetitionScheduler {
  private readonly fsrs: FSRS;
  private readonly maxIntervalDays: number;

  constructor(config: Pick<SrsConfig, 'desiredRetention' | 'maxIntervalDays'>) {
    // enable_short_term: false — without this, ts-fsrs schedules new cards in minutes (scheduled_days=0).
    // Day-based scheduling from the first review is required for our word review system.
    this.fsrs = new FSRS(
      generatorParameters({
        request_retention: config.desiredRetention,
        maximum_interval: config.maxIntervalDays,
        enable_short_term: false,
      }),
    );
    this.maxIntervalDays = config.maxIntervalDays;
  }

  /**
   * Calculates the next review interval for a word based on
   * whether the answer was correct, using the FSRS algorithm.
   */
  scheduleReview(state: WordState, isCorrect: boolean): ReviewResult {
    const card = state.fsrsState
      ? this.toFsrsCard(state.fsrsState)
      : createEmptyCard(new Date());

    const rating = isCorrect ? Rating.Good : Rating.Again;
    const result = this.fsrs.next(card, new Date(), rating);
    const newCard = result.card;

    return {
      nextIntervalDays: Math.min(newCard.scheduled_days, this.maxIntervalDays),
      updatedFsrsState: this.toFsrsCardState(newCard),
      isLapse: !isCorrect,
    };
  }

  /** Returns how many days until this word should be reviewed next. */
  getNextInterval(state: WordState): number {
    if (!state.fsrsState) {
      return 1;
    }
    return Math.min(state.fsrsState.scheduledDays, this.maxIntervalDays);
  }

  private toFsrsCard(fsrsState: FsrsCardState): Card {
    return {
      stability: fsrsState.stability,
      difficulty: fsrsState.difficulty,
      // TODO: elapsed_days is deprecated in ts-fsrs — migrate when API stabilises
      elapsed_days: fsrsState.elapsedDays,
      scheduled_days: fsrsState.scheduledDays,
      learning_steps: 0,
      reps: fsrsState.reps,
      lapses: fsrsState.lapses,
      state: State.Review,
      due:
        fsrsState.lastReview !== null
          ? new Date(
              fsrsState.lastReview.getTime() +
                fsrsState.scheduledDays * 86_400_000,
            )
          : new Date(),
      last_review: fsrsState.lastReview ?? undefined,
    };
  }

  private toFsrsCardState(card: Card): FsrsCardState {
    return {
      stability: card.stability,
      difficulty: card.difficulty,
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      elapsedDays: card.elapsed_days,
      scheduledDays: card.scheduled_days,
      reps: card.reps,
      lapses: card.lapses,
      lastReview: card.last_review ?? null,
    };
  }
}
