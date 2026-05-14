import { describe, it, expect } from 'vitest';
import { updateMasteryState } from '../../engine/session.js';
import type { RunState } from '../../types/word-state.js';
import type { WordQuizResult } from '../../types/quiz.js';

const streakThresholds = { correctStreakThreshold: 2, wrongStreakThreshold: 2, maxMastery: 3 };

function makeState(entries: Record<string, { mastery: number; seen?: number; correct?: number; correctStreak?: number; wrongStreak?: number }>): RunState {
  const m: RunState = new Map();
  for (const [wordId, { mastery, seen = 0, correct = 0, correctStreak = 0, wrongStreak = 0 }] of Object.entries(entries)) {
    m.set(wordId, { wordId, seen, correct, mastery, correctStreak, wrongStreak });
  }
  return m;
}

function results(...pairs: [string, boolean][]): WordQuizResult[] {
  return pairs.map(([wordId, correct]) => ({ wordId, correct }));
}

describe('updateMasteryState — mastery detection', () => {
  it('reports newly mastered word when mastery crosses threshold this batch', () => {
    // w1 has correctStreak: 1 already — one more correct will push mastery from 0 → 1, threshold is 1
    const runState = makeState({ w1: { mastery: 0, correctStreak: 1 } });
    const prevState = makeState({ w1: { mastery: 0 } });

    const out = updateMasteryState(
      results(['w1', true]),
      runState, prevState,
      new Set(), new Set(), 1, streakThresholds,
    );

    expect(out.newlyMasteredIds).toContain('w1');
    expect(out.masteredCount).toBe(1);
  });

  it('does not report a word already mastered before this batch', () => {
    const runState = makeState({ w1: { mastery: 3 } });
    const prevState = makeState({ w1: { mastery: 3 } });

    const out = updateMasteryState(
      results(['w1', true]),
      runState, prevState,
      new Set(), new Set(), 3, streakThresholds,
    );

    expect(out.newlyMasteredIds).not.toContain('w1');
    expect(out.masteredCount).toBe(0);
  });

  it('reports multiple newly mastered words in the same batch', () => {
    const runState = makeState({ w1: { mastery: 0, correctStreak: 1 }, w2: { mastery: 0, correctStreak: 1 } });
    const prevState = makeState({ w1: { mastery: 0 }, w2: { mastery: 0 } });

    const out = updateMasteryState(
      results(['w1', true], ['w2', true]),
      runState, prevState,
      new Set(), new Set(), 1, streakThresholds,
    );

    expect(out.newlyMasteredIds).toContain('w1');
    expect(out.newlyMasteredIds).toContain('w2');
    expect(out.masteredCount).toBe(2);
  });

  it('does not report a word that did not reach threshold', () => {
    const runState = makeState({ w1: { mastery: 0 } });
    const prevState = makeState({ w1: { mastery: 0 } });

    const out = updateMasteryState(
      results(['w1', true]),
      runState, prevState,
      new Set(), new Set(), 3, streakThresholds,
    );

    expect(out.newlyMasteredIds).toHaveLength(0);
    expect(out.masteredCount).toBe(0);
  });
});

describe('updateMasteryState — state updates', () => {
  it('processes all results and updates run state', () => {
    const runState: RunState = new Map();
    const prevState: RunState = new Map();

    const out = updateMasteryState(
      results(['w1', true], ['w2', false]),
      runState, prevState,
      new Set(), new Set(), 3, streakThresholds,
    );

    expect(out.runState.get('w1')?.seen).toBe(1);
    expect(out.runState.get('w1')?.correct).toBe(1);
    expect(out.runState.get('w2')?.seen).toBe(1);
    expect(out.runState.get('w2')?.correct).toBe(0);
  });

  it('processes multiple results for the same word in order', () => {
    const runState: RunState = new Map();
    const prevState: RunState = new Map();

    const out = updateMasteryState(
      results(['w1', true], ['w1', true]),
      runState, prevState,
      new Set(), new Set(), 3, streakThresholds,
    );

    expect(out.runState.get('w1')?.seen).toBe(2);
    expect(out.runState.get('w1')?.correct).toBe(2);
    expect(out.runState.get('w1')?.correctStreak).toBe(2);
  });

  it('does not mutate the input runState', () => {
    const runState: RunState = new Map();
    const prevState: RunState = new Map();

    updateMasteryState(
      results(['w1', true]),
      runState, prevState,
      new Set(), new Set(), 3, streakThresholds,
    );

    expect(runState.size).toBe(0);
  });
});

describe('updateMasteryState — recheck sets pass-through', () => {
  it('returns updated recheckPending and recheckReentered from processRecheckResult', () => {
    const runState = makeState({ w1: { mastery: 3 } });
    const prevState = makeState({ w1: { mastery: 3 } });
    const recheckPending = new Set(['w1']);

    const out = updateMasteryState(
      results(['w1', false]),
      runState, prevState,
      recheckPending, new Set(), 3, streakThresholds,
    );

    // w1 was in recheckPending and answered wrong → removed from pending, added to reentered
    expect(out.recheckPending.has('w1')).toBe(false);
    expect(out.recheckReentered.has('w1')).toBe(true);
  });
});
