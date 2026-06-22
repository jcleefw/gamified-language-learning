import { describe, it, expect } from 'vitest';
import {
  initAdaptiveSession,
  advanceAdaptiveSession,
} from '../../engine/adaptive-session.js';
import type { QuizItem } from '../../engine/compose-word-batch.js';

describe('initAdaptiveSession', () => {
  const mockWords: QuizItem[] = [
    {
      id: 'w1',
      native: 'n1',
      romanization: 'r1',
      english: 'e1',
      type: 'word',
      language: 'th',
    },
    {
      id: 'w2',
      native: 'n2',
      romanization: 'r2',
      english: 'e2',
      type: 'word',
      language: 'th',
    },
    {
      id: 'w3',
      native: 'n3',
      romanization: 'r3',
      english: 'e3',
      type: 'word',
      language: 'th',
    },
    {
      id: 'w4',
      native: 'n4',
      romanization: 'r4',
      english: 'e4',
      type: 'word',
      language: 'th',
    },
  ];

  const config = {
    wordsPerBatch: 2,
    masteryThreshold: 2,
    streakThresholds: {
      correctStreakThreshold: 2,
      wrongStreakThreshold: 2,
      maxMastery: 2,
    },
    maxRetryPerSession: 5,
  };

  it('partitions recheck IDs into active and fills the rest from words', () => {
    const recheckIds = new Set(['w3']);
    const state = initAdaptiveSession(mockWords, config, recheckIds);

    expect(state.active.map((w) => w.id)).toEqual(['w3', 'w1']);
    expect(state.queue.map((w) => w.id)).toEqual(['w2', 'w4']);
    expect(state.recheckPending).toEqual(new Set(['w3']));
    expect(state.batchNum).toBe(0);
  });

  it('clones initialRunState to prevent cross-deck mutation', () => {
    const initialRunState = new Map([
      [
        'w1',
        {
          wordId: 'w1',
          seen: 1,
          correct: 1,
          mastery: 1,
          correctStreak: 1,
          wrongStreak: 0,
        },
      ],
    ]);
    const state = initAdaptiveSession(
      mockWords,
      config,
      new Set(),
      initialRunState,
    );

    // Mutation of original should not affect state
    initialRunState.set('w1', { ...initialRunState.get('w1')!, seen: 99 });
    expect(state.runState.get('w1')?.seen).toBe(1);
  });
});

describe('advanceAdaptiveSession', () => {
  const mockWords: QuizItem[] = [
    {
      id: 'w1',
      native: 'n1',
      romanization: 'r1',
      english: 'e1',
      type: 'word',
      language: 'th',
    },
    {
      id: 'w2',
      native: 'n2',
      romanization: 'r2',
      english: 'e2',
      type: 'word',
      language: 'th',
    },
    {
      id: 'w3',
      native: 'n3',
      romanization: 'r3',
      english: 'e3',
      type: 'word',
      language: 'th',
    },
  ];

  const config = {
    wordsPerBatch: 2,
    masteryThreshold: 1, // Master after 1 correct
    streakThresholds: {
      correctStreakThreshold: 1,
      wrongStreakThreshold: 1,
      maxMastery: 1,
    },
    maxRetryPerSession: 5,
  };

  it('updates mastery, moves pool, and increments batchNum', () => {
    const initialState = initAdaptiveSession(mockWords, config);
    // Active: w1, w2. Queue: w3.

    const batchOutput = {
      results: [{ wordId: 'w1', correct: true }],
      sessionRetryCounts: new Map(),
    };

    const nextState = advanceAdaptiveSession(initialState, batchOutput, config);

    // w1 should be mastered and removed from active
    expect(nextState.runState.get('w1')?.mastery).toBe(1);
    expect(nextState.active.map((w) => w.id)).toEqual(['w2', 'w3']); // w3 pulled in
    expect(nextState.batchNum).toBe(1);
  });

  it('ignores sentence results in Phase 2', () => {
    const initialState = initAdaptiveSession(mockWords, config);
    const batchOutput = {
      results: [{ sentenceId: 's1', correct: true }],
      sessionRetryCounts: new Map(),
    };

    const nextState = advanceAdaptiveSession(initialState, batchOutput, config);

    // runState should be identical since sentence results are ignored
    expect(nextState.runState).toEqual(initialState.runState);
    expect(nextState.batchNum).toBe(1);
  });

  it('merges sessionRetryCounts from BatchOutput', () => {
    const initialState = initAdaptiveSession(mockWords, config);
    const batchOutput = {
      results: [],
      sessionRetryCounts: new Map([['w1', 3]]),
    };

    const nextState = advanceAdaptiveSession(initialState, batchOutput, config);

    expect(nextState.sessionRetryCounts.get('w1')).toBe(3);
  });

  it('ensures immutability of runState and sessionRetryCounts', () => {
    const initialState = initAdaptiveSession(mockWords, config);
    const batchOutput = {
      results: [{ wordId: 'w1', correct: true }],
      sessionRetryCounts: new Map([['w1', 1]]),
    };

    const nextState = advanceAdaptiveSession(initialState, batchOutput, config);

    // Modifying nextState should not affect initialState
    nextState.runState.set('w1', {
      ...nextState.runState.get('w1')!,
      seen: 99,
    });
    expect(initialState.runState.get('w1')?.seen).toBeUndefined();

    nextState.sessionRetryCounts.set('w1', 99);
    expect(initialState.sessionRetryCounts.get('w1')).toBeUndefined();
  });
});
