import { describe, it, expect } from 'vitest';
import { nextActivePool } from '../../runner/interactive.js';
import type { RunState } from '../../types/word-state.js';
import type { QuizItem } from '../../engine/compose-batch.js';

function makeItem(id: string): QuizItem {
  return { id, native: id, english: id, romanization: id, type: 'word', language: 'th' } as QuizItem;
}

function makeState(entries: Record<string, { seen: number; correct: number }>): RunState {
  const m: RunState = new Map();
  for (const [wordId, { seen, correct }] of Object.entries(entries)) {
    m.set(wordId, { wordId, seen, correct });
  }
  return m;
}

describe('nextActivePool', () => {
  it('returns unchanged active + queue when no words are mastered and active is full', () => {
    const active = [makeItem('w1'), makeItem('w2')];
    const queue = [makeItem('w3')];
    const runState = makeState({ w1: { seen: 1, correct: 1 }, w2: { seen: 1, correct: 1 } });
    const result = nextActivePool(active, queue, 2, runState, 3);
    expect(result.active.map(i => i.id)).toEqual(['w1', 'w2']);
    expect(result.queue.map(i => i.id)).toEqual(['w3']);
  });

  it('retires a mastered word and pulls next from queue', () => {
    const active = [makeItem('w1'), makeItem('w2')];
    const queue = [makeItem('w3')];
    const runState = makeState({ w1: { seen: 3, correct: 3 }, w2: { seen: 2, correct: 2 } });
    const result = nextActivePool(active, queue, 2, runState, 3);
    expect(result.active.map(i => i.id)).toEqual(['w2', 'w3']);
    expect(result.queue).toHaveLength(0);
  });

  it('retires multiple mastered words and pulls same number from queue', () => {
    const active = [makeItem('w1'), makeItem('w2')];
    const queue = [makeItem('w3'), makeItem('w4')];
    const runState = makeState({ w1: { seen: 3, correct: 3 }, w2: { seen: 3, correct: 3 } });
    const result = nextActivePool(active, queue, 2, runState, 3);
    expect(result.active.map(i => i.id)).toEqual(['w3', 'w4']);
    expect(result.queue).toHaveLength(0);
  });

  it('returns empty active and queue when queue is exhausted after retirement', () => {
    const active = [makeItem('w1')];
    const queue: QuizItem[] = [];
    const runState = makeState({ w1: { seen: 3, correct: 3 } });
    const result = nextActivePool(active, queue, 2, runState, 3);
    expect(result.active).toHaveLength(0);
    expect(result.queue).toHaveLength(0);
  });

  it('returns active shorter than questionLimit when queue runs out', () => {
    const active = [makeItem('w1')];
    const queue = [makeItem('w2')];
    const runState = makeState({ w1: { seen: 3, correct: 3 } });
    const result = nextActivePool(active, queue, 3, runState, 3);
    expect(result.active.map(i => i.id)).toEqual(['w2']);
    expect(result.queue).toHaveLength(0);
  });

  it('does not mutate input arrays', () => {
    const active = [makeItem('w1')];
    const queue = [makeItem('w2')];
    const runState: RunState = new Map();
    nextActivePool(active, queue, 2, runState, 3);
    expect(active).toHaveLength(1);
    expect(queue).toHaveLength(1);
  });
});
