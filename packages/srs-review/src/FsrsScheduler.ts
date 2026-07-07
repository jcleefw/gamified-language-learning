import {
  fsrs,
  generatorParameters,
  createEmptyCard,
  Rating,
  type Card,
  type CardInput,
  type Grade,
  type FSRSParameters,
} from 'ts-fsrs';
import type {
  ReviewScheduler,
  ReviewCard,
  ReviewRating,
  GraduationPerformance,
} from './types.js';

/** Domain rating → ts-fsrs grade. All four are valid Grades (Manual excluded). */
const RATING_TO_GRADE: Record<ReviewRating, Grade> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
};

// Seed heuristic thresholds — calibrate empirically (OQ5). Generous by intent.
const EASY_STREAK = 4; // final streak at/above this + zero lapses ⇒ easy
const GOOD_RATIO = 0.7; // correctRatio at/above this (≤2 lapses) ⇒ good

export class FsrsScheduler implements ReviewScheduler {
  private readonly engine: ReturnType<typeof fsrs>;

  constructor(params?: Partial<FSRSParameters>) {
    this.engine = fsrs(
      generatorParameters({
        enable_short_term: false, // day-scale only — no competing "learning" loop
        request_retention: 0.9,
        ...params,
      }),
    );
  }

  seed(wordId: string, performance: GraduationPerformance, now: Date): ReviewCard {
    const fresh = createEmptyCard(now);
    const grade = RATING_TO_GRADE[seedRating(performance)];
    const { card } = this.engine.next(fresh, now, grade);
    return toReviewCard(wordId, card);
  }

  schedule(card: ReviewCard, rating: ReviewRating, now: Date): ReviewCard {
    const fsrsCard = fromSchedulerData(card.schedulerData);
    const { card: advanced } = this.engine.next(fsrsCard, now, RATING_TO_GRADE[rating]);
    return toReviewCard(card.wordId, advanced);
  }

  isDue(card: ReviewCard, now: Date): boolean {
    return card.due.getTime() <= now.getTime();
  }
}

// ── private pure helpers ──────────────────────────────────────────────

/** Graduation performance → initial seed rating. Never `again` — graduation implies success. */
function seedRating(perf: GraduationPerformance): ReviewRating {
  const { correctStreak, lapses, correctRatio } = perf;
  if (lapses === 0 && correctStreak >= EASY_STREAK) return 'easy';
  if (lapses <= 2 && correctRatio >= GOOD_RATIO) return 'good';
  return 'hard';
}

/** Wrap a ts-fsrs Card as our opaque ReviewCard. `due` mirrors Card.due for cheap filtering. */
function toReviewCard(wordId: string, card: Card): ReviewCard {
  return { wordId, due: card.due, schedulerData: card };
}

/**
 * Rehydrate the opaque blob into a ts-fsrs CardInput.
 * After a store round-trip (DS02) the Dates arrive as ISO strings; ts-fsrs `next`
 * accepts CardInput whose `due`/`last_review` are DateInput (Date | number | string),
 * so no manual Date parsing is needed here.
 */
function fromSchedulerData(data: unknown): CardInput {
  return data as CardInput;
}
