import { describe, it, expect } from 'vitest';
import { assembleBatch } from '../../engine/assemble-batch.js';
import { type QuizItem } from '../../engine/compose-word-batch.js';

describe('assembleBatch — excludeIds', () => {
  const w1: QuizItem = {
    id: 'w1',
    native: 'word1',
    romanization: 'roman1',
    english: 'english1',
    type: 'verb',
    language: 'th',
  };

  const w2: QuizItem = {
    id: 'w2',
    native: 'word2',
    romanization: 'roman2',
    english: 'english2',
    type: 'noun',
    language: 'th',
  };

  const f1: QuizItem = {
    id: 'f1',
    native: 'f',
    romanization: 'f',
    english: 'f',
    foundationalType: 'consonant',
    class: 'middle',
    language: 'th',
  };

  it('excluded vocabulary word produces no questions; non-excluded word gets questions', () => {
    const active: QuizItem[] = [w1, w2];
    const questions = assembleBatch(active, [w1, w2], [], 10, {
      excludeIds: new Set([w1.id]),
      shuffle: false,
    });

    expect(questions.some((q) => q.kind === 'mcq' && q.wordId === w1.id)).toBe(false);
    expect(questions.some((q) => q.kind === 'mcq' && q.wordId === w2.id)).toBe(true);
  });

  it('excluded foundational word produces no questions; non-excluded vocab word gets questions', () => {
    const active: QuizItem[] = [f1, w1];
    const questions = assembleBatch(active, [w1], [f1], 10, {
      excludeIds: new Set([f1.id]),
      shuffle: false,
    });

    expect(questions.some((q) => q.kind === 'mcq' && q.wordId === f1.id)).toBe(false);
    expect(questions.some((q) => q.kind === 'mcq' && q.wordId === w1.id)).toBe(true);
  });

  it('excluding all active items returns empty batch', () => {
    const active: QuizItem[] = [w1];
    const questions = assembleBatch(active, [w1], [], 10, {
      excludeIds: new Set([w1.id]),
      shuffle: false,
    });

    expect(questions).toEqual([]);
  });

  it('undefined excludeIds → normal output (regression guard)', () => {
    const active: QuizItem[] = [w1, w2];
    const questions = assembleBatch(active, [w1, w2], [], 10, {
      shuffle: false,
    });

    expect(questions.some((q) => q.kind === 'mcq' && q.wordId === w1.id)).toBe(true);
    expect(questions.some((q) => q.kind === 'mcq' && q.wordId === w2.id)).toBe(true);
  });

  it('empty Set excludeIds → normal output', () => {
    const active: QuizItem[] = [w1, w2];
    const questions = assembleBatch(active, [w1, w2], [], 10, {
      excludeIds: new Set(),
      shuffle: false,
    });

    expect(questions.some((q) => q.kind === 'mcq' && q.wordId === w1.id)).toBe(true);
    expect(questions.some((q) => q.kind === 'mcq' && q.wordId === w2.id)).toBe(true);
  });

  it('excludeIds with IDs not in active → harmless, normal output', () => {
    const active: QuizItem[] = [w1, w2];
    const questions = assembleBatch(active, [w1, w2], [], 10, {
      excludeIds: new Set(['nonexistent-id', 'another-ghost-id']),
      shuffle: false,
    });

    expect(questions.some((q) => q.kind === 'mcq' && q.wordId === w1.id)).toBe(true);
    expect(questions.some((q) => q.kind === 'mcq' && q.wordId === w2.id)).toBe(true);
  });
});
