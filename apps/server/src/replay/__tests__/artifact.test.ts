import { describe, it, expect } from 'vitest';
import { parseArtifact, type ReplayArtifact } from '../artifact.js';

function validArtifact(): ReplayArtifact {
  return {
    version: 1,
    meta: {
      createdAt: '2026-07-12T00:00:00.000Z',
      sessionId: 's1',
      phase: 'learning',
      originUserId: 'demo-user',
    },
    thresholds: {
      masteryThreshold: 2,
      streakThresholds: { correctStreakThreshold: 2, wrongStreakThreshold: 2, maxMastery: 2 },
    },
    baseline: [],
    inputs: [
      {
        correlationId: 'c1',
        wordId: 'w1',
        correct: true,
        latencyMs: 100,
        recheck: false,
        recordedAfter: {
          wordId: 'w1',
          seen: 1,
          correct: 1,
          mastery: 0,
          correctStreak: 1,
          wrongStreak: 0,
          lapses: 0,
        },
      },
    ],
    appearance: [],
  };
}

describe('parseArtifact', () => {
  it('accepts a well-formed artifact', () => {
    const a = validArtifact();
    expect(parseArtifact(a)).toEqual(a);
  });

  it('rejects an artifact missing thresholds', () => {
    const a = validArtifact() as unknown as Record<string, unknown>;
    delete a.thresholds;
    expect(() => parseArtifact(a)).toThrow(/Invalid replay artifact/);
  });

  it('rejects a malformed WordState in a transition input', () => {
    const a = validArtifact();
    (a.inputs[0].recordedAfter as unknown as Record<string, unknown>).mastery = 'nope';
    expect(() => parseArtifact(a)).toThrow(/Invalid replay artifact/);
  });

  it('rejects a malformed WordState in the baseline', () => {
    const a = validArtifact() as unknown as { baseline: unknown[] };
    a.baseline = [{ wordId: 'w1' }];
    expect(() => parseArtifact(a)).toThrow(/Invalid replay artifact/);
  });

  it('rejects an unknown artifact version', () => {
    const a = validArtifact() as unknown as Record<string, unknown>;
    a.version = 2;
    expect(() => parseArtifact(a)).toThrow(/Invalid replay artifact/);
  });
});
