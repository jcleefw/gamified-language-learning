import { describe, it, expect } from 'vitest';
import { BatchQueueManager } from '../../engine/batch-queue.js';
import { type QuizQuestion } from '../../types/quiz.js';

describe('BatchQueueManager', () => {
  const q1: QuizQuestion = {
    kind: 'mcq',
    wordId: 'w1',
    direction: 'native-to-english',
    prompt: 'w1-native',
    choices: [],
  };

  const q2: QuizQuestion = {
    kind: 'mcq',
    wordId: 'w2',
    direction: 'native-to-english',
    prompt: 'w2-native',
    choices: [],
  };

  it('serves initial questions in order', () => {
    const manager = new BatchQueueManager([q1, q2], 1, new Map(), 5);
    expect(manager.next()).toBe(q1);
    expect(manager.next()).toBe(q2);
    expect(manager.next()).toBeNull();
    expect(manager.isDone).toBe(true);
  });

  it('re-enqueues incorrect answers up to the batch cap', () => {
    // Cap of 1 retry per word
    const manager = new BatchQueueManager([q1], 1, new Map(), 5);

    expect(manager.next()).toBe(q1);
    manager.submitResult({ wordId: 'w1', correct: false });

    // Should reappear once
    expect(manager.next()).toBe(q1);
    manager.submitResult({ wordId: 'w1', correct: false });

    // Should not reappear again
    expect(manager.next()).toBeNull();
    expect(manager.isDone).toBe(true);
  });

  it('respects the session-wide retry cap', () => {
    // Word w1 already hit the session cap of 5 in previous batches
    const sessionRetryCounts = new Map([['w1', 5]]);
    const manager = new BatchQueueManager([q1], 2, sessionRetryCounts, 5);

    expect(manager.next()).toBe(q1);
    manager.submitResult({ wordId: 'w1', correct: false });

    // Should NOT reappear because session cap is hit
    expect(manager.next()).toBeNull();
    expect(manager.isDone).toBe(true);
  });

  it('ensures replay consistency (D11)', () => {
    const manager = new BatchQueueManager([q1], 1, new Map(), 5);

    const first = manager.next();
    manager.submitResult({ wordId: 'w1', correct: false });
    const second = manager.next();

    // Must be the exact same object instance
    expect(second).toBe(first);
  });

  it('calculates totalCount correctly', () => {
    const manager = new BatchQueueManager([q1, q2], 1, new Map(), 5);
    expect(manager.totalCount).toBe(2);
  });

  it('finishes with correct results and updated session counts', () => {
    const sessionCounts = new Map([['w1', 1]]);
    const manager = new BatchQueueManager([q1, q2], 2, sessionCounts, 10);

    // w1 fails once, retries once and fails again
    manager.next();
    manager.submitResult({ wordId: 'w1', correct: false });
    manager.next();
    manager.submitResult({ wordId: 'w1', correct: false });

    // w2 succeeds first time
    manager.next();
    manager.submitResult({ wordId: 'w2', correct: true });

    const output = manager.finish();
    expect(output.results.length).toBe(3);
    // w1 retried once (max 2 hit, so served twice total, but only 1 retry actually happened)
    // Wait, if it fails once, it is re-queued. Total serves: 2. Retries: 1.
    // session: 1 (previous) + 2 (retries in this batch) = 3.
    expect(output.sessionRetryCounts.get('w1')).toBe(3);
    expect(output.sessionRetryCounts.get('w2')).toBeUndefined();
  });

  it('supports early exit via finish()', () => {
    const manager = new BatchQueueManager([q1, q2], 1, new Map(), 5);
    manager.next();
    manager.submitResult({ wordId: 'w1', correct: true });

    const output = manager.finish();
    expect(output.results.length).toBe(1);
    expect(manager.isDone).toBe(false); // Queue still had q2
  });

  it('re-enqueues sentence questions (word-block) correctly', () => {
    const sq: QuizQuestion = {
      kind: 'word-block',
      sentenceId: 's1',
      direction: 'english-to-native',
      prompt: 's1-prompt',
      tiles: [],
      answer: [],
    };

    const manager = new BatchQueueManager([sq], 1, new Map(), 5);

    expect(manager.next()).toBe(sq);
    manager.submitResult({ sentenceId: 's1', correct: false });

    // Should reappear
    expect(manager.next()).toBe(sq);
    manager.submitResult({ sentenceId: 's1', correct: true });

    expect(manager.next()).toBeNull();
    expect(manager.isDone).toBe(true);
  });
});
