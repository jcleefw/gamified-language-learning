import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import type { QuizItem, RunState } from '@gll/srs-engine-v2';
import type { DueReviewItem } from '@gll/api-contract';
import { useReviewSession } from '../useReviewSession';
import type { ConfigType } from '../../types';
import {
  getTraceSession,
  __resetTraceSessionForTests,
  type AppearanceChannelData,
} from '../useTraceSession';

// EP40-ST04: the review-queue seam records an `appearance` question-served entry
// keyed by the same correlation id the answer POST carries — so appearance and API
// reconcile on one id. Only while the trace session is active.

const loadDueReviews = vi.fn<() => Promise<DueReviewItem[]>>();
const loadAnytimeReviews = vi.fn<() => Promise<DueReviewItem[]>>();
const postReviewAnswer =
  vi.fn<
    (req: { wordId: string }, correlationId?: string) => Promise<{ wordId: string; due: string; advanced: boolean }>
  >();
vi.mock('../useStore', () => ({
  loadDueReviews: (...a: []) => loadDueReviews(...a),
  loadAnytimeReviews: (...a: []) => loadAnytimeReviews(...a),
  postReviewAnswer: (...a: [{ wordId: string }, string?]) => postReviewAnswer(...a),
}));

function makeItem(id: string): QuizItem {
  return { id, native: id, english: id, romanization: id, type: 'word', language: 'th' } as QuizItem;
}

function setup(pool: QuizItem[]) {
  return useReviewSession({
    wordPool: ref(pool),
    globalRunState: ref(new Map() as RunState),
    configReady: ref(true),
    CONFIG: ref({ masteryThreshold: 3 } as ConfigType),
    apiError: ref<string | null>(null),
  });
}

beforeEach(() => {
  __resetTraceSessionForTests();
  loadDueReviews.mockReset();
  loadAnytimeReviews.mockReset();
  postReviewAnswer.mockReset();
  postReviewAnswer.mockResolvedValue({ wordId: 'x', due: '2026-07-20T00:00:00.000Z', advanced: true });
});

const appearance = () =>
  getTraceSession().session.value!.entries.filter((e) => e.channel === 'appearance');

describe('appearance channel — review queue', () => {
  it('records question-served keyed by the answer correlation id (reconciles with API)', async () => {
    loadDueReviews.mockResolvedValue([{ wordId: 'a', due: '2026-07-01T00:00:00.000Z' }]);
    getTraceSession().start();
    const session = setup([makeItem('a')]);

    await session.onReview();

    const q = session.reviewQuestion.value;
    if (!q || q.kind !== 'mcq') throw new Error('expected mcq');
    // One appearance entry so far, for the served question.
    const served = appearance();
    expect(served).toHaveLength(1);
    expect((served[0].data as AppearanceChannelData).kind).toBe('question-served');
    const servedId = served[0].correlationId;

    await session.onReviewAnswered({ wordId: q.wordId, correct: true });

    // The id on the appearance entry equals the id sent with the answer POST.
    expect(postReviewAnswer.mock.calls[0][1]).toBe(servedId);
  });

  it('records nothing while the trace session is inactive', async () => {
    loadDueReviews.mockResolvedValue([{ wordId: 'a', due: '2026-07-01T00:00:00.000Z' }]);
    // no start()
    const session = setup([makeItem('a')]);
    await session.onReview();
    expect(getTraceSession().session.value).toBeNull();
  });
});
