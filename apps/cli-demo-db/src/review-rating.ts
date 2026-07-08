import type { ReviewRating } from '@gll/srs-review';

export interface RatingThresholds {
  easyMaxMs: number; // ≤ this (correct) ⇒ easy
  goodMaxMs: number; // ≤ this (correct) ⇒ good; above ⇒ hard
}

// Generous defaults (ADR D5) — calibrate against real timing data.
export const DEFAULT_RATING_THRESHOLDS: RatingThresholds = {
  easyMaxMs: 4_000,
  goodMaxMs: 12_000,
};

/** Wrong ⇒ again. Correct ⇒ easy/good/hard by latency. The user is never asked (ADR D5). */
export function inferReviewRating(
  wasCorrect: boolean,
  latencyMs: number,
  thresholds: RatingThresholds = DEFAULT_RATING_THRESHOLDS,
): ReviewRating {
  if (!wasCorrect) return 'again';
  if (latencyMs <= thresholds.easyMaxMs) return 'easy';
  if (latencyMs <= thresholds.goodMaxMs) return 'good';
  return 'hard';
}
