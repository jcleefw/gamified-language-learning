import { describe, it, expect } from 'vitest';
import { updateRunState, isMastered } from '../../types/word-state.js';
import type { RunState } from '../../types/word-state.js';

describe('updateRunState', () => {
  it('creates a new entry from empty state on correct answer', () => {
    const state: RunState = new Map();
    const next = updateRunState(state, 'th::หิว', true);
    expect(next.get('th::หิว')).toEqual({ wordId: 'th::หิว', seen: 1, correct: 1 });
  });

  it('creates a new entry from empty state on wrong answer', () => {
    const state: RunState = new Map();
    const next = updateRunState(state, 'th::หิว', false);
    expect(next.get('th::หิว')).toEqual({ wordId: 'th::หิว', seen: 1, correct: 0 });
  });

  it('increments seen on correct answer', () => {
    let state: RunState = new Map();
    state = updateRunState(state, 'th::ก', true);
    state = updateRunState(state, 'th::ก', true);
    expect(state.get('th::ก')!.seen).toBe(2);
  });

  it('increments seen on wrong answer', () => {
    let state: RunState = new Map();
    state = updateRunState(state, 'th::ก', true);
    state = updateRunState(state, 'th::ก', false);
    expect(state.get('th::ก')!.seen).toBe(2);
  });

  it('only increments correct on correct answer', () => {
    let state: RunState = new Map();
    state = updateRunState(state, 'th::ก', true);
    state = updateRunState(state, 'th::ก', false);
    state = updateRunState(state, 'th::ก', true);
    expect(state.get('th::ก')!.correct).toBe(2);
  });

  it('tracks multiple words independently', () => {
    let state: RunState = new Map();
    state = updateRunState(state, 'th::หิว', true);
    state = updateRunState(state, 'th::ไป', false);
    state = updateRunState(state, 'th::หิว', false);
    expect(state.get('th::หิว')).toEqual({ wordId: 'th::หิว', seen: 2, correct: 1 });
    expect(state.get('th::ไป')).toEqual({ wordId: 'th::ไป', seen: 1, correct: 0 });
  });

  it('does not mutate the original state', () => {
    const state: RunState = new Map();
    updateRunState(state, 'th::ก', true);
    expect(state.size).toBe(0);
  });
});

describe('isMastered', () => {
  it('returns false when correct < threshold', () => {
    expect(isMastered({ wordId: 'th::w', seen: 2, correct: 2 }, 3)).toBe(false);
  });

  it('returns true when correct === threshold', () => {
    expect(isMastered({ wordId: 'th::w', seen: 3, correct: 3 }, 3)).toBe(true);
  });

  it('returns true when correct > threshold', () => {
    expect(isMastered({ wordId: 'th::w', seen: 4, correct: 4 }, 3)).toBe(true);
  });

  it('returns false on a fresh WordState', () => {
    expect(isMastered({ wordId: 'th::w', seen: 0, correct: 0 }, 3)).toBe(false);
  });
});
