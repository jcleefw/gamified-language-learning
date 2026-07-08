import { describe, it, expect } from 'vitest';
import type { WordState } from '@gll/srs-engine-v2';
import { toGraduationPerformance } from '../review/graduation-performance.js';

const ws = (o: Partial<WordState> = {}): WordState => ({
  wordId: 'w1',
  seen: 4,
  correct: 3,
  mastery: 2,
  correctStreak: 3,
  wrongStreak: 0,
  lapses: 1,
  ...o,
});

describe('toGraduationPerformance', () => {
  it('passes correctStreak and lapses through and derives correctRatio = correct/seen', () => {
    expect(toGraduationPerformance(ws({ seen: 4, correct: 3, correctStreak: 3, lapses: 1 }))).toEqual({
      correctStreak: 3,
      lapses: 1,
      correctRatio: 0.75,
    });
  });

  it('guards divide-by-zero: seen === 0 yields correctRatio 0', () => {
    expect(toGraduationPerformance(ws({ seen: 0, correct: 0 })).correctRatio).toBe(0);
  });
});
