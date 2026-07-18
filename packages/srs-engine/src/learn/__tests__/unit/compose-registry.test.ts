import { describe, it, expect, vi } from 'vitest';
import { createComposerRegistry, assembleBatchQuestions } from '../../engine/compose-registry.js';
import type { MCQQuestion } from '../../types/quiz.js';

const makeQuestion = (wordId: string): MCQQuestion => ({
  kind: 'mcq',
  wordId,
  direction: 'native-to-english',
  prompt: wordId,
  choices: [],
});

describe('createComposerRegistry + assembleBatchQuestions', () => {
  it('returns empty array when no thunks are registered', () => {
    const registry = createComposerRegistry();
    expect(assembleBatchQuestions(registry)).toEqual([]);
  });

  it('returns the output of a single registered thunk', () => {
    const registry = createComposerRegistry();
    const q = makeQuestion('th::a');
    registry.add(() => [q]);
    expect(assembleBatchQuestions(registry)).toEqual([q]);
  });

  it('merges multiple thunks into a flat array in registration order', () => {
    const registry = createComposerRegistry();
    const q1 = makeQuestion('th::a');
    const q2 = makeQuestion('th::b');
    const q3 = makeQuestion('th::c');
    registry.add(() => [q1, q2]);
    registry.add(() => [q3]);
    expect(assembleBatchQuestions(registry)).toEqual([q1, q2, q3]);
  });

  it('calls each thunk exactly once per assembleBatchQuestions call', () => {
    const registry = createComposerRegistry();
    const thunk1 = vi.fn(() => [makeQuestion('th::a')]);
    const thunk2 = vi.fn(() => [makeQuestion('th::b')]);
    registry.add(thunk1);
    registry.add(thunk2);
    assembleBatchQuestions(registry);
    expect(thunk1).toHaveBeenCalledTimes(1);
    expect(thunk2).toHaveBeenCalledTimes(1);
  });
});
