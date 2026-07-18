import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref } from 'vue';
import type { MCQQuestion } from '@gll/srs-engine/learn';
import QuizPage from '../QuizPage.vue';
import QuizCard from '../../components/QuizCard.vue';

let currentRoute: { params: Record<string, string> } = { params: { deckId: 'd1' } };
vi.mock('vue-router', () => ({
  useRoute: () => currentRoute,
}));

function makeQuestion(): MCQQuestion {
  return {
    kind: 'mcq',
    wordId: 'w1',
    direction: 'native-to-english',
    prompt: 'w1',
    choices: [
      { label: 'a', value: 'w1', isCorrect: true },
      { label: 'b', value: 'w2', isCorrect: false },
    ],
  };
}

const onAnswered = vi.fn();
const onExitBatch = vi.fn();
const initSession = vi.fn();

function mountQuizPage(overrides: Partial<{
  currentQuestion: MCQQuestion | null;
  batchState: { results: unknown[]; initialCount: number } | null;
}> = {}) {
  return mount(QuizPage, {
    global: {
      provide: {
        learningSession: {
          currentQuestion: ref(
            overrides.currentQuestion === undefined
              ? makeQuestion()
              : overrides.currentQuestion,
          ),
          batchState: ref(
            overrides.batchState === undefined
              ? { results: [], initialCount: 5 }
              : overrides.batchState,
          ),
          activeItems: ref([]),
          queue: ref([]),
          masteredDeck: ref([]),
          shelvedItems: ref([]),
          questionKey: ref('q1'),
          onAnswered,
          onExitBatch,
          initSession,
        },
        currentQuestionAudio: ref(undefined),
      },
    },
  });
}

describe('QuizPage', () => {
  beforeEach(() => {
    onAnswered.mockClear();
    onExitBatch.mockClear();
    initSession.mockClear();
    currentRoute = { params: { deckId: 'd1' } };
  });

  it('passes injected learning session state to QuizCard', () => {
    const question = makeQuestion();
    const wrapper = mountQuizPage({
      currentQuestion: question,
      batchState: { results: [1, 2], initialCount: 5 },
    });

    const card = wrapper.findComponent(QuizCard);
    expect(card.exists()).toBe(true);
    expect(card.props('question')).toEqual(question);
    expect(card.props('index')).toBe(2);
    expect(card.props('total')).toBe(5);
  });

  it('forwards answered and exit events to the learning session', async () => {
    const wrapper = mountQuizPage();
    const card = wrapper.findComponent(QuizCard);

    const result = { correct: true };
    await card.vm.$emit('answered', result);
    expect(onAnswered).toHaveBeenCalledWith(result);

    await card.vm.$emit('exit');
    expect(onExitBatch).toHaveBeenCalled();
  });

  it('resumes the session for the deep-linked deckId when no batch is active', () => {
    mountQuizPage({ currentQuestion: null, batchState: null });
    expect(initSession).toHaveBeenCalledWith('d1', false);
  });

  it('does not re-initialize the session on mount when a batch is already active', () => {
    mountQuizPage();
    expect(initSession).not.toHaveBeenCalled();
  });
});
