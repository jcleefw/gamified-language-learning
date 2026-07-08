import { describe, it, expect } from 'vitest';
import { inferReviewRating, DEFAULT_RATING_THRESHOLDS } from '../review-rating.js';

describe('inferReviewRating', () => {
  it('maps a wrong answer to "again" regardless of latency', () => {
    expect(inferReviewRating(false, 1)).toBe('again');
    expect(inferReviewRating(false, 100_000)).toBe('again');
  });

  it('maps correct + fast to "easy" (at the easy boundary)', () => {
    expect(inferReviewRating(true, DEFAULT_RATING_THRESHOLDS.easyMaxMs)).toBe('easy');
  });

  it('maps correct + mid to "good" (just past easy, and at the good boundary)', () => {
    expect(inferReviewRating(true, DEFAULT_RATING_THRESHOLDS.easyMaxMs + 1)).toBe('good');
    expect(inferReviewRating(true, DEFAULT_RATING_THRESHOLDS.goodMaxMs)).toBe('good');
  });

  it('maps correct + slow to "hard" (just past the good boundary)', () => {
    expect(inferReviewRating(true, DEFAULT_RATING_THRESHOLDS.goodMaxMs + 1)).toBe('hard');
  });

  it('has generous defaults so an ordinary correct answer is "good", not "hard"', () => {
    expect(DEFAULT_RATING_THRESHOLDS.easyMaxMs).toBe(4_000);
    expect(DEFAULT_RATING_THRESHOLDS.goodMaxMs).toBe(12_000);
    expect(inferReviewRating(true, 6_000)).toBe('good');
  });

  it('honours custom thresholds without touching defaults', () => {
    const rating = inferReviewRating(true, 2_000, { easyMaxMs: 1_000, goodMaxMs: 3_000 });
    expect(rating).toBe('good');
  });
});
