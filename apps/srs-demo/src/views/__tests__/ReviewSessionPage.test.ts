import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref } from 'vue';
import type { SentenceQuestion } from '@gll/srs-engine/learn';
import ReviewSessionPage from '../ReviewSessionPage.vue';
import QuizCard from '../../components/QuizCard.vue';
import ReviewSummary from '../../components/ReviewSummary.vue';
import { ROUTE_NAMES } from '../../routeNames';

const push = vi.fn();
let currentRoute: { query: Record<string, string> } = { query: {} };
vi.mock('vue-router', () => ({
  useRouter: () => ({ push }),
  useRoute: () => currentRoute,
}));

function makeQuestion(): SentenceQuestion {
  return {
    kind: 'word-block',
    sentenceId: 's1',
    direction: 'native-to-english',
    prompt: 'sentence',
    tiles: [{ native: 'w1', romanization: 'w1', english: 'w1', wordId: 'w1' }],
    answer: ['w1'],
  };
}

const onReviewAnswered = vi.fn();
const onReview = vi.fn();
const onAnytimeReview = vi.fn();

function mountReviewSessionPage(overrides: Partial<{
  reviewQuestion: SentenceQuestion | null;
  reviewBatchState: { results: unknown[]; initialCount: number } | null;
  reviewCaughtUp: boolean;
  reviewMode: 'due' | 'anytime';
  reviewSummary: { reviewed: number; advanced: number; nextDue: string | null };
}> = {}) {
  return mount(ReviewSessionPage, {
    global: {
      provide: {
        reviewSession: {
          reviewQuestion: ref(
            overrides.reviewQuestion === undefined
              ? makeQuestion()
              : overrides.reviewQuestion,
          ),
          reviewBatchState: ref(
            overrides.reviewBatchState === undefined
              ? { results: [], initialCount: 3 }
              : overrides.reviewBatchState,
          ),
          reviewQuestionKey: ref('r1'),
          reviewCaughtUp: ref(overrides.reviewCaughtUp ?? false),
          reviewMode: ref(overrides.reviewMode ?? 'due'),
          reviewSummary: ref(
            overrides.reviewSummary ?? { reviewed: 0, advanced: 0, nextDue: null },
          ),
          onReviewAnswered,
          onReview,
          onAnytimeReview,
        },
        reviewQuestionAudio: ref(undefined),
      },
    },
  });
}

describe('ReviewSessionPage', () => {
  beforeEach(() => {
    push.mockClear();
    onReviewAnswered.mockClear();
    onReview.mockClear();
    onAnytimeReview.mockClear();
    currentRoute = { query: {} };
  });

  it('passes injected review session state to QuizCard with feedbackDwell', () => {
    const question = makeQuestion();
    const wrapper = mountReviewSessionPage({
      reviewQuestion: question,
      reviewBatchState: { results: [1], initialCount: 3 },
    });

    const card = wrapper.findComponent(QuizCard);
    expect(card.exists()).toBe(true);
    expect(card.props('question')).toEqual(question);
    expect(card.props('index')).toBe(1);
    expect(card.props('total')).toBe(3);
    expect(card.props('feedbackDwell')).toBe(true);
  });

  it('forwards answered to the review session and exit to the review hub route', async () => {
    const wrapper = mountReviewSessionPage();
    const card = wrapper.findComponent(QuizCard);

    const result = { sentenceId: 's1', correct: true };
    await card.vm.$emit('answered', result);
    expect(onReviewAnswered).toHaveBeenCalledWith(result);

    await card.vm.$emit('exit');
    expect(push).toHaveBeenCalledWith({ name: ROUTE_NAMES.REVIEW_HUB });
  });

  it('renders ReviewSummary instead of QuizCard when there is no current question', () => {
    const wrapper = mountReviewSessionPage({
      reviewQuestion: null,
      reviewCaughtUp: false,
      reviewMode: 'anytime',
      reviewSummary: { reviewed: 5, advanced: 2, nextDue: '2026-08-01' },
    });

    expect(wrapper.findComponent(QuizCard).exists()).toBe(false);
    const summary = wrapper.findComponent(ReviewSummary);
    expect(summary.exists()).toBe(true);
    expect(summary.props('caughtUp')).toBe(false);
    expect(summary.props('mode')).toBe('anytime');
    expect(summary.props('reviewed')).toBe(5);
    expect(summary.props('advanced')).toBe(2);
    expect(summary.props('nextDue')).toBe('2026-08-01');
  });

  it('navigates to the review hub when ReviewSummary emits home', async () => {
    const wrapper = mountReviewSessionPage({ reviewQuestion: null });
    await wrapper.findComponent(ReviewSummary).vm.$emit('home');
    expect(push).toHaveBeenCalledWith({ name: ROUTE_NAMES.REVIEW_HUB });
  });

  it('enters the due session on mount when no batch has started and query.mode is unset', () => {
    currentRoute = { query: {} };
    mountReviewSessionPage({ reviewQuestion: null, reviewBatchState: null });
    expect(onReview).toHaveBeenCalled();
    expect(onAnytimeReview).not.toHaveBeenCalled();
  });

  it('enters the anytime session on mount when no batch has started and query.mode=anytime', () => {
    currentRoute = { query: { mode: 'anytime' } };
    mountReviewSessionPage({ reviewQuestion: null, reviewBatchState: null });
    expect(onAnytimeReview).toHaveBeenCalled();
    expect(onReview).not.toHaveBeenCalled();
  });

  it('does not re-enter a session on mount when a batch is already active', () => {
    mountReviewSessionPage();
    expect(onReview).not.toHaveBeenCalled();
    expect(onAnytimeReview).not.toHaveBeenCalled();
  });
});
