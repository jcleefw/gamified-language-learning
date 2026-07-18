import { describe, it, expect } from 'vitest';
import type {
  ReviewRating,
  GraduationPerformance,
  ReviewCard,
  ReviewScheduler,
} from '../index.js';

describe('Public API exports', () => {
  it('ReviewRating admits all four domain ratings', () => {
    const ratings: ReviewRating[] = ['again', 'hard', 'good', 'easy'];
    expect(ratings).toHaveLength(4);
  });

  it('GraduationPerformance is a primitive-only shape', () => {
    const perf: GraduationPerformance = { correctStreak: 3, lapses: 0, correctRatio: 1 };
    expect(perf.correctStreak).toBe(3);
  });

  it('ReviewCard holds wordId, due, and opaque schedulerData', () => {
    const card: ReviewCard = { wordId: 'w1', due: new Date(), schedulerData: null };
    expect(card.wordId).toBe('w1');
  });

  it('ReviewScheduler is structurally satisfiable', () => {
    const scheduler: ReviewScheduler = {
      seed: (wordId, _performance, now) => ({ wordId, due: now, schedulerData: null }),
      schedule: (card, _rating, now) => ({ ...card, due: now }),
      isDue: (card, now) => card.due.getTime() <= now.getTime(),
    };
    expect(typeof scheduler.seed).toBe('function');
    expect(typeof scheduler.schedule).toBe('function');
    expect(typeof scheduler.isDue).toBe('function');
  });
});
