import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import type { QuizItem, RunState } from '@gll/srs-engine-v2';
import type { DueReviewItem } from '@gll/api-contract';
import { useReviewSession } from '../useReviewSession';
import type { ConfigType } from '../../types';

// EP40-ST01: a review answer POST carries the correlation id minted when its
// question was shown, and each question gets a distinct id.

const loadDueReviews = vi.fn<() => Promise<DueReviewItem[]>>();
const loadAnytimeReviews = vi.fn<() => Promise<DueReviewItem[]>>();
const postReviewAnswer =
  vi.fn<
    (
      req: { wordId: string },
      correlationId?: string,
    ) => Promise<{ wordId: string; due: string; advanced: boolean }>
  >();
vi.mock('../useStore', () => ({
  loadDueReviews: (...args: []) => loadDueReviews(...args),
  loadAnytimeReviews: (...args: []) => loadAnytimeReviews(...args),
  postReviewAnswer: (...args: [{ wordId: string }, string?]) =>
    postReviewAnswer(...args),
}));

function makeItem(id: string): QuizItem {
  return {
    id,
    native: id,
    english: id,
    romanization: id,
    type: 'word',
    language: 'th',
  } as QuizItem;
}

const CONFIG = { masteryThreshold: 3 } as ConfigType;

function setup(pool: QuizItem[]) {
  const deps = {
    wordPool: ref(pool),
    globalRunState: ref(new Map() as RunState),
    configReady: ref(true),
    CONFIG: ref(CONFIG),
    apiError: ref<string | null>(null),
  };
  return useReviewSession(deps);
}

beforeEach(() => {
  loadDueReviews.mockReset();
  loadAnytimeReviews.mockReset();
  postReviewAnswer.mockReset();
  postReviewAnswer.mockResolvedValue({
    wordId: 'x',
    due: '2026-07-20T00:00:00.000Z',
    advanced: true,
  });
});

describe('review correlation-id threading', () => {
  it('sends a correlation id with each review answer, distinct per question', async () => {
    const pool = [makeItem('a'), makeItem('b')];
    loadDueReviews.mockResolvedValue([
      { wordId: 'a', due: '2026-07-01T00:00:00.000Z' },
      { wordId: 'b', due: '2026-07-01T00:00:00.000Z' },
    ]);
    const session = setup(pool);

    await session.onReview();

    // Answer the two questions in turn.
    for (let i = 0; i < 2; i++) {
      const q = session.reviewQuestion.value;
      if (!q || q.kind !== 'mcq') throw new Error('expected an mcq question');
      await session.onReviewAnswered({ wordId: q.wordId, correct: true });
    }

    expect(postReviewAnswer).toHaveBeenCalledTimes(2);
    const id0 = postReviewAnswer.mock.calls[0][1];
    const id1 = postReviewAnswer.mock.calls[1][1];
    expect(typeof id0).toBe('string');
    expect(typeof id1).toBe('string');
    expect(id0).not.toBe(id1); // a fresh id minted per shown question
  });
});
