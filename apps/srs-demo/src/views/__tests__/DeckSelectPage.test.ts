import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref } from 'vue';
import type { AppDeckPayload } from '@gll/api-contract';
import DeckSelectPage from '../DeckSelectPage.vue';
import DeckSelector from '../../components/DeckSelector.vue';
import { ROUTE_NAMES } from '../../routeNames';

const push = vi.fn();
vi.mock('vue-router', () => ({
  useRouter: () => ({ push }),
}));

function makeDeck(id: string): AppDeckPayload {
  return { id, topic: id, words: [], lines: [] };
}

const onSelect = vi.fn();
const onResume = vi.fn();
const onClear = vi.fn();

function mountDeckSelectPage(overrides: Partial<{
  appDecks: AppDeckPayload[];
  hasSavedSession: boolean;
  deckId: string | null;
  completedDeckIds: Set<string>;
}> = {}) {
  return mount(DeckSelectPage, {
    global: {
      provide: {
        appDecks: ref(overrides.appDecks ?? [makeDeck('d1')]),
        learningSession: {
          hasSavedSession: ref(overrides.hasSavedSession ?? false),
          deckId: ref(overrides.deckId ?? null),
          savedDeckName: ref(null),
          completedDeckIds: ref(overrides.completedDeckIds ?? new Set<string>()),
          onSelect,
          onResume,
          onClear,
        },
      },
    },
  });
}

describe('DeckSelectPage', () => {
  beforeEach(() => {
    push.mockClear();
    onSelect.mockClear();
    onResume.mockClear();
    onClear.mockClear();
  });

  it('passes injected deck and session state to DeckSelector', () => {
    const decks = [makeDeck('d1'), makeDeck('d2')];
    const wrapper = mountDeckSelectPage({
      appDecks: decks,
      hasSavedSession: true,
      deckId: 'd1',
      completedDeckIds: new Set(['d2']),
    });

    const selector = wrapper.findComponent(DeckSelector);
    expect(selector.exists()).toBe(true);
    expect(selector.props('decks')).toEqual(decks);
    expect(selector.props('hasSavedSession')).toBe(true);
    expect(selector.props('completedDeckIds')).toEqual(new Set(['d2']));
  });

  it('forwards select, resume, and clear to the learning session', async () => {
    const wrapper = mountDeckSelectPage();
    const selector = wrapper.findComponent(DeckSelector);

    await selector.vm.$emit('select', 'd1');
    expect(onSelect).toHaveBeenCalledWith('d1');

    await selector.vm.$emit('resume');
    expect(onResume).toHaveBeenCalled();

    await selector.vm.$emit('clear');
    expect(onClear).toHaveBeenCalled();
  });

  it('navigates to the overview route on overview', async () => {
    const wrapper = mountDeckSelectPage();
    await wrapper.findComponent(DeckSelector).vm.$emit('overview', 'd1');
    expect(push).toHaveBeenCalledWith({
      name: ROUTE_NAMES.OVERVIEW,
      params: { deckId: 'd1' },
    });
  });
});
