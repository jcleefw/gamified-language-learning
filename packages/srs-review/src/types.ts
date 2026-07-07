/** How the user answered a due review. Inferred by the runner (DS03), never asked. */
export type ReviewRating = 'again' | 'hard' | 'good' | 'easy';

/**
 * Performance snapshot at the moment a word graduates from Learning.
 * Primitive-only — the app-layer GraduationHook derives this from WordState;
 * this package never imports WordState.
 */
export interface GraduationPerformance {
  correctStreak: number; // final streak at graduation
  lapses: number;        // times mastery dropped during Learning
  correctRatio: number;  // correct / seen, range 0..1
}

/**
 * Persisted per-word review record. `due` is the only field the runner/store read;
 * `schedulerData` is opaque and owned entirely by the scheduler.
 */
export interface ReviewCard {
  wordId: string;
  due: Date;
  schedulerData: unknown; // FsrsScheduler stores the serialised ts-fsrs Card here
}

/** Swappable scheduling contract. FsrsScheduler is one implementation. */
export interface ReviewScheduler {
  /** Create the first ReviewCard for a freshly graduated word. */
  seed(wordId: string, performance: GraduationPerformance, now: Date): ReviewCard;
  /** Advance a card after a review, given the inferred rating. */
  schedule(card: ReviewCard, rating: ReviewRating, now: Date): ReviewCard;
  /** Is this card due at `now`? */
  isDue(card: ReviewCard, now: Date): boolean;
}
