import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref } from 'vue';
import ResultsPage from '../ResultsPage.vue';
import BatchResults from '../../components/BatchResults.vue';
import { ROUTE_NAMES } from '../../routeNames';

const push = vi.fn();
vi.mock('vue-router', () => ({
  useRouter: () => ({ push }),
}));

const onNext = vi.fn();
const onNextDeck = vi.fn();

function mountResultsPage() {
  return mount(ResultsPage, {
    global: {
      provide: {
        learningSession: {
          summary: ref([]),
          batchScore: ref({ correct: 3, total: 5 }),
          activeItems: ref([]),
          queue: ref([]),
          masteredDeck: ref([]),
          masteredGlobal: ref([]),
          nextDeckId: ref(null),
          shelvedItems: ref([]),
          onNext,
          onNextDeck,
        },
        CONFIG: ref({ streakThresholds: { maxMastery: 5 } }),
      },
    },
  });
}

describe('ResultsPage', () => {
  beforeEach(() => {
    push.mockClear();
    onNext.mockClear();
    onNextDeck.mockClear();
  });

  it('passes injected learning session state to BatchResults', () => {
    const wrapper = mountResultsPage();
    const results = wrapper.findComponent(BatchResults);
    expect(results.exists()).toBe(true);
    expect(results.props('batchScore')).toEqual({ correct: 3, total: 5 });
    expect(results.props('maxMastery')).toBe(5);
  });

  it('forwards next and nextDeck, and navigates to deck select on selectDeck', async () => {
    const wrapper = mountResultsPage();
    const results = wrapper.findComponent(BatchResults);

    await results.vm.$emit('next');
    expect(onNext).toHaveBeenCalled();

    await results.vm.$emit('nextDeck', 'd2');
    expect(onNextDeck).toHaveBeenCalledWith('d2');

    await results.vm.$emit('selectDeck');
    expect(push).toHaveBeenCalledWith({ name: ROUTE_NAMES.DECK_SELECT });
  });
});
