import { describe, it, expect } from 'vitest';
import { defaultSentenceState } from '../../index.js';

describe('defaultSentenceState', () => {
  it('returns correct default values for a given sentenceId', () => {
    const id = 'th::s1';
    const state = defaultSentenceState(id);

    expect(state.sentenceId).toBe(id);
    expect(state.sentenceStreak).toBe(0);
    expect(state.lastBatchSeen).toBe(-1);
    expect(state.dailyCount).toBe(0);
    expect(state.sessionWrongStreak).toBe(0);
    expect(state.active).toBe(true);
  });
});
