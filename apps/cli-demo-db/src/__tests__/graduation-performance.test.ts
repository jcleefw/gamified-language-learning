import { describe, it, expect } from 'vitest';
import type { WordState } from '@gll/srs-engine-v2/learn';
import { toGraduationPerformance } from '../graduation-performance.js';

function makeWordState(overrides: Partial<WordState> = {}): WordState {
  return {
    seen: 0,
    correct: 0,
    mastery: 0,
    correctStreak: 0,
    wrongStreak: 0,
    lapses: 0,
    ...overrides,
  } as WordState;
}

describe('toGraduationPerformance', () => {
  it('passes through correctStreak and lapses', () => {
    const ws = makeWordState({ correctStreak: 4, lapses: 2, seen: 10, correct: 8 });
    const perf = toGraduationPerformance(ws);
    expect(perf.correctStreak).toBe(4);
    expect(perf.lapses).toBe(2);
  });

  it('computes correctRatio as correct / seen', () => {
    const ws = makeWordState({ seen: 10, correct: 7 });
    expect(toGraduationPerformance(ws).correctRatio).toBeCloseTo(0.7);
  });

  it('returns correctRatio 0 when seen is 0', () => {
    const ws = makeWordState({ seen: 0, correct: 0 });
    expect(toGraduationPerformance(ws).correctRatio).toBe(0);
  });
});
