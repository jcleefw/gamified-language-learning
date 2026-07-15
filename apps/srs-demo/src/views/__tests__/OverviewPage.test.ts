import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref } from 'vue';
import type { AppDeckPayload } from '@gll/api-contract';
import OverviewPage from '../OverviewPage.vue';
import DeckOverview from '../../components/DeckOverview.vue';
import { ROUTE_NAMES } from '../../routeNames';

const push = vi.fn();
let currentRoute = { params: { deckId: 'd1' } };
vi.mock('vue-router', () => ({
  useRouter: () => ({ push }),
  useRoute: () => currentRoute,
}));

const initSession = vi.fn();
const onUnshelveWord = vi.fn();
const onUpdateShelvedSet = vi.fn();
const onUpdateWordStates = vi.fn();

function makeDeck(id: string): AppDeckPayload {
  return { id, topic: id, words: [], lines: [] };
}

function mountOverviewPage(overrides: Partial<{ appDecks: AppDeckPayload[] }> = {}) {
  return mount(OverviewPage, {
    global: {
      provide: {
        appDecks: ref(overrides.appDecks ?? [makeDeck('d1')]),
        wordPool: ref([]),
        CONFIG: ref({ streakThresholds: { maxMastery: 5 } }),
        learningSession: {
          globalRunState: ref(new Map()),
          shelvedSet: ref(new Set()),
          initSession,
          onUnshelveWord,
          onUpdateShelvedSet,
          onUpdateWordStates,
        },
      },
    },
  });
}

describe('OverviewPage', () => {
  beforeEach(() => {
    push.mockClear();
    initSession.mockClear();
    onUnshelveWord.mockClear();
    onUpdateShelvedSet.mockClear();
    onUpdateWordStates.mockClear();
    currentRoute = { params: { deckId: 'd1' } };
  });

  it('resolves the deck from the route param and passes injected state to DeckOverview', () => {
    const deck = makeDeck('d1');
    const wrapper = mountOverviewPage({ appDecks: [deck, makeDeck('d2')] });

    const overview = wrapper.findComponent(DeckOverview);
    expect(overview.exists()).toBe(true);
    expect(overview.props('deck')).toEqual(deck);
    expect(overview.props('maxMastery')).toBe(5);
  });

  it('forwards events to the learning session and navigates back on back', async () => {
    const wrapper = mountOverviewPage();
    const overview = wrapper.findComponent(DeckOverview);

    await overview.vm.$emit('startQuiz', 'd1');
    expect(initSession).toHaveBeenCalledWith('d1', false);

    await overview.vm.$emit('unshelveWord', 'd1', 'w1');
    expect(onUnshelveWord).toHaveBeenCalledWith('d1', 'w1');

    await overview.vm.$emit('back');
    expect(push).toHaveBeenCalledWith({ name: ROUTE_NAMES.DECK_SELECT });
  });
});
