import { describe, it, expect } from 'vitest';
import { updateRunState, isMastered } from '../../types/word-state.js';
import type { RunState } from '../../types/word-state.js';

const THRESHOLDS = { correctStreakThreshold: 3, wrongStreakThreshold: 2, maxMastery: 5 };

// ---------------------------------------------------------------------------
// updateRunState — cumulative fields (unchanged from ST07/ST08)
// ---------------------------------------------------------------------------
describe('updateRunState — cumulative fields', () => {
  it('creates a new entry from empty state on correct answer', () => {
    const state: RunState = new Map();
    const next = updateRunState(state, 'th::หิว', true, THRESHOLDS);
    const ws = next.get('th::หิว')!;
    expect(ws.seen).toBe(1);
    expect(ws.correct).toBe(1);
  });

  it('creates a new entry from empty state on wrong answer', () => {
    const state: RunState = new Map();
    const next = updateRunState(state, 'th::หิว', false, THRESHOLDS);
    const ws = next.get('th::หิว')!;
    expect(ws.seen).toBe(1);
    expect(ws.correct).toBe(0);
  });

  it('increments seen on correct answer', () => {
    let state: RunState = new Map();
    state = updateRunState(state, 'th::ก', true, THRESHOLDS);
    state = updateRunState(state, 'th::ก', true, THRESHOLDS);
    expect(state.get('th::ก')!.seen).toBe(2);
  });

  it('increments seen on wrong answer', () => {
    let state: RunState = new Map();
    state = updateRunState(state, 'th::ก', true, THRESHOLDS);
    state = updateRunState(state, 'th::ก', false, THRESHOLDS);
    expect(state.get('th::ก')!.seen).toBe(2);
  });

  it('only increments correct on correct answer', () => {
    let state: RunState = new Map();
    state = updateRunState(state, 'th::ก', true, THRESHOLDS);
    state = updateRunState(state, 'th::ก', false, THRESHOLDS);
    state = updateRunState(state, 'th::ก', true, THRESHOLDS);
    expect(state.get('th::ก')!.correct).toBe(2);
  });

  it('tracks multiple words independently', () => {
    let state: RunState = new Map();
    state = updateRunState(state, 'th::หิว', true, THRESHOLDS);
    state = updateRunState(state, 'th::ไป', false, THRESHOLDS);
    state = updateRunState(state, 'th::หิว', false, THRESHOLDS);
    expect(state.get('th::หิว')!.seen).toBe(2);
    expect(state.get('th::หิว')!.correct).toBe(1);
    expect(state.get('th::ไป')!.seen).toBe(1);
    expect(state.get('th::ไป')!.correct).toBe(0);
  });

  it('does not mutate the original state', () => {
    const state: RunState = new Map();
    updateRunState(state, 'th::ก', true, THRESHOLDS);
    expect(state.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// updateRunState — streak fields
// ---------------------------------------------------------------------------
describe('updateRunState — streaks', () => {
  it('increments correctStreak on correct answer', () => {
    let state: RunState = new Map();
    state = updateRunState(state, 'th::ก', true, THRESHOLDS);
    state = updateRunState(state, 'th::ก', true, THRESHOLDS);
    expect(state.get('th::ก')!.correctStreak).toBe(2);
  });

  it('resets correctStreak to 0 on wrong answer', () => {
    let state: RunState = new Map();
    state = updateRunState(state, 'th::ก', true, THRESHOLDS);
    state = updateRunState(state, 'th::ก', true, THRESHOLDS);
    state = updateRunState(state, 'th::ก', false, THRESHOLDS);
    expect(state.get('th::ก')!.correctStreak).toBe(0);
  });

  it('increments wrongStreak on wrong answer', () => {
    let state: RunState = new Map();
    state = updateRunState(state, 'th::ก', false, THRESHOLDS);
    state = updateRunState(state, 'th::ก', false, THRESHOLDS);
    expect(state.get('th::ก')!.wrongStreak).toBe(2);
  });

  it('resets wrongStreak to 0 on correct answer', () => {
    let state: RunState = new Map();
    state = updateRunState(state, 'th::ก', false, THRESHOLDS);
    state = updateRunState(state, 'th::ก', false, THRESHOLDS);
    state = updateRunState(state, 'th::ก', true, THRESHOLDS);
    expect(state.get('th::ก')!.wrongStreak).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// updateRunState — mastery increment
// ---------------------------------------------------------------------------
describe('updateRunState — mastery increment', () => {
  it('does not increment mastery below correctStreakThreshold', () => {
    let state: RunState = new Map();
    state = updateRunState(state, 'th::ก', true, THRESHOLDS); // streak=1
    state = updateRunState(state, 'th::ก', true, THRESHOLDS); // streak=2
    expect(state.get('th::ก')!.mastery).toBe(0);
  });

  it('increments mastery when correctStreak hits threshold', () => {
    let state: RunState = new Map();
    state = updateRunState(state, 'th::ก', true, THRESHOLDS); // streak=1
    state = updateRunState(state, 'th::ก', true, THRESHOLDS); // streak=2
    state = updateRunState(state, 'th::ก', true, THRESHOLDS); // streak=3 → mastery=1
    expect(state.get('th::ก')!.mastery).toBe(1);
  });

  it('increments mastery on each correct above threshold (no reset)', () => {
    let state: RunState = new Map();
    // Build to threshold first
    for (let i = 0; i < 3; i++) state = updateRunState(state, 'th::ก', true, THRESHOLDS);
    // Each additional correct triggers another increment
    state = updateRunState(state, 'th::ก', true, THRESHOLDS); // streak=4 → mastery=2
    expect(state.get('th::ก')!.mastery).toBe(2);
  });

  it('caps mastery at 5', () => {
    let state: RunState = new Map();
    for (let i = 0; i < 10; i++) state = updateRunState(state, 'th::ก', true, THRESHOLDS);
    expect(state.get('th::ก')!.mastery).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// updateRunState — mastery decrement
// ---------------------------------------------------------------------------
describe('updateRunState — mastery decrement', () => {
  function stateWithMastery(level: number): RunState {
    // Build mastery to desired level via correctStreak
    let state: RunState = new Map();
    const needed = 3 + level - 1; // threshold=3, then level-1 more
    for (let i = 0; i < needed; i++) state = updateRunState(state, 'th::ก', true, THRESHOLDS);
    return state;
  }

  it('does not decrement mastery below wrongStreakThreshold', () => {
    let state = stateWithMastery(3);
    state = updateRunState(state, 'th::ก', false, THRESHOLDS); // streak=1
    expect(state.get('th::ก')!.mastery).toBe(3);
  });

  it('decrements mastery when wrongStreak hits threshold', () => {
    let state = stateWithMastery(3);
    state = updateRunState(state, 'th::ก', false, THRESHOLDS); // streak=1
    state = updateRunState(state, 'th::ก', false, THRESHOLDS); // streak=2 → mastery=2
    expect(state.get('th::ก')!.mastery).toBe(2);
  });

  it('decrements mastery on each wrong above threshold (no reset)', () => {
    let state = stateWithMastery(3);
    state = updateRunState(state, 'th::ก', false, THRESHOLDS); // streak=1
    state = updateRunState(state, 'th::ก', false, THRESHOLDS); // streak=2 → mastery=2
    state = updateRunState(state, 'th::ก', false, THRESHOLDS); // streak=3 → mastery=1
    expect(state.get('th::ก')!.mastery).toBe(1);
  });

  it('floors mastery at 0', () => {
    let state: RunState = new Map();
    for (let i = 0; i < 10; i++) state = updateRunState(state, 'th::ก', false, THRESHOLDS);
    expect(state.get('th::ก')!.mastery).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// isMastered
// ---------------------------------------------------------------------------
describe('isMastered', () => {
  it('returns false when mastery < threshold', () => {
    expect(isMastered({ wordId: 'th::w', seen: 5, correct: 5, mastery: 4, correctStreak: 5, wrongStreak: 0 }, 5)).toBe(false);
  });

  it('returns true when mastery === threshold', () => {
    expect(isMastered({ wordId: 'th::w', seen: 5, correct: 5, mastery: 5, correctStreak: 7, wrongStreak: 0 }, 5)).toBe(true);
  });

  it('returns true when mastery > threshold', () => {
    expect(isMastered({ wordId: 'th::w', seen: 6, correct: 6, mastery: 5, correctStreak: 8, wrongStreak: 0 }, 5)).toBe(true);
  });

  it('returns false on a fresh WordState', () => {
    expect(isMastered({ wordId: 'th::w', seen: 0, correct: 0, mastery: 0, correctStreak: 0, wrongStreak: 0 }, 5)).toBe(false);
  });
});
