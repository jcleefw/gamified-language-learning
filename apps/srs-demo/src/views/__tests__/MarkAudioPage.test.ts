import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref } from 'vue';
import type { AppDeckPayload } from '@gll/api-contract';
import MarkAudioPage from '../MarkAudioPage.vue';
import MarkAudio from '../../components/MarkAudio.vue';
import { ROUTE_NAMES } from '../../routeNames';

const push = vi.fn();
vi.mock('vue-router', () => ({
  useRouter: () => ({ push }),
}));

const refreshDecks = vi.fn();

function makeDeck(id: string): AppDeckPayload {
  return { id, topic: id, words: [], lines: [] };
}

function mountMarkAudioPage() {
  return mount(MarkAudioPage, {
    global: {
      provide: {
        appDecks: ref([makeDeck('d1')]),
        refreshDecks,
      },
    },
  });
}

describe('MarkAudioPage', () => {
  beforeEach(() => {
    push.mockClear();
    refreshDecks.mockClear();
  });

  it('passes injected decks to MarkAudio', () => {
    const wrapper = mountMarkAudioPage();
    const mark = wrapper.findComponent(MarkAudio);
    expect(mark.exists()).toBe(true);
    expect(mark.props('decks')).toEqual([makeDeck('d1')]);
  });

  it('refreshes decks on committed and navigates back on back', async () => {
    const wrapper = mountMarkAudioPage();
    const mark = wrapper.findComponent(MarkAudio);

    await mark.vm.$emit('committed');
    expect(refreshDecks).toHaveBeenCalled();

    await mark.vm.$emit('back');
    expect(push).toHaveBeenCalledWith({ name: ROUTE_NAMES.CURATION });
  });
});
