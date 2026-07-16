import { describe, it, expect, vi } from 'vitest';
import { assembleBatch } from '../../engine/assemble-batch.js';
import * as composeWordBatchModule from '../../engine/compose-word-batch.js';
import { type QuizItem } from '../../engine/compose-word-batch.js';
import { type QuizQuestion } from '../../types/quiz.js';

describe('assembleBatch', () => {
  const mockWord: QuizItem = {
    id: 'w1',
    native: 'word',
    romanization: 'roman',
    english: 'english',
    type: 'verb',
    language: 'th',
  };

  const mockFoundational: QuizItem = {
    id: 'f1',
    native: 'f',
    romanization: 'f',
    english: 'f',
    foundationalType: 'consonant',
    class: 'middle',
    language: 'th',
  };

  it('partitions items and calculates limits correctly', () => {
    const active: QuizItem[] = [mockWord, mockFoundational];
    const wordPool: QuizItem[] = [mockWord];
    const foundationalPool: QuizItem[] = [mockFoundational];

    // 2 items total, 1 word, 1 foundational.
    // wordsPerBatch = 4.
    // foundationalLimit = 4 * 1 / 2 = 2.
    // wordLimit = 4 - 2 = 2.
    const questions = assembleBatch(active, wordPool, foundationalPool, 4, {
      shuffle: false,
    });

    // Since we provided pools with items that have 4 directions each,
    // and limits are 2 for foundational and 2 for words,
    // it will return 2 questions for each item.
    expect(questions.length).toBe(4);
  });

  it('passes shuffle: false to inner thunks so the outer sort is the sole shuffle', () => {
    const spy = vi.spyOn(composeWordBatchModule, 'composeWordBatchItems');
    const active: QuizItem[] = [mockWord, mockFoundational];

    assembleBatch(active, [mockWord], [mockFoundational], 4);

    for (const call of spy.mock.calls) {
      expect(call[2]).toMatchObject({ shuffle: false });
    }

    spy.mockRestore();
  });

  it('includes extra thunks', () => {
    const active: QuizItem[] = [mockWord];
    const wordPool: QuizItem[] = [mockWord];

    const extraThunk = vi.fn(() => [
      {
        kind: 'mcq',
        wordId: 'extra-word',
        direction: 'native-to-english',
        prompt: 'prompt',
        choices: [],
      } as QuizQuestion,
    ]);

    const questions = assembleBatch(active, wordPool, [], 5, {
      extraThunks: [extraThunk],
      shuffle: false,
    });

    expect(extraThunk).toHaveBeenCalled();
    expect(questions.some((q) => q.kind === 'mcq' && q.wordId === 'extra-word')).toBe(true);
  });

  function questionKey(q: QuizQuestion & { wordId: string; direction: string }): string {
    return `${q.wordId}::${q.direction}`;
  }

  it('shuffle: true returns the same members as shuffle: false, only reordered', () => {
    const active: QuizItem[] = [mockWord, mockFoundational];
    const wordPool: QuizItem[] = [mockWord];
    const foundationalPool: QuizItem[] = [mockFoundational];

    const unshuffled = assembleBatch(active, wordPool, foundationalPool, 4, { shuffle: false });
    const shuffled = assembleBatch(active, wordPool, foundationalPool, 4, { shuffle: true });

    expect(shuffled).toHaveLength(unshuffled.length);
    expect(
      new Set(shuffled.map((q) => questionKey(q as QuizQuestion & { wordId: string; direction: string }))),
    ).toEqual(
      new Set(unshuffled.map((q) => questionKey(q as QuizQuestion & { wordId: string; direction: string }))),
    );
  });

  it('shuffle: true reorders the batch across repeated calls (low false-negative rate)', () => {
    const active: QuizItem[] = [mockWord, mockFoundational];
    const wordPool: QuizItem[] = [mockWord];
    const foundationalPool: QuizItem[] = [mockFoundational];

    const orderings = new Set<string>();
    for (let i = 0; i < 15; i++) {
      const batch = assembleBatch(active, wordPool, foundationalPool, 4, { shuffle: true });
      orderings.add(
        batch
          .map((q) => questionKey(q as QuizQuestion & { wordId: string; direction: string }))
          .join('|'),
      );
    }
    expect(orderings.size).toBeGreaterThan(1);
  });

  it('defaults to shuffle: true when options are omitted', () => {
    const active: QuizItem[] = [mockWord, mockFoundational];
    const questions = assembleBatch(active, [mockWord], [mockFoundational], 4);
    expect(questions).toHaveLength(4);
  });
});
