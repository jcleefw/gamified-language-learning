import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref } from 'vue';
import type { AppDeckPayload } from '@gll/api-contract';
import CurateAudioPage from '../CurateAudioPage.vue';
import CurateAudio from '../../components/CurateAudio.vue';
import { ROUTE_NAMES } from '../../routeNames';

const push = vi.fn();
vi.mock('vue-router', () => ({
  useRouter: () => ({ push }),
}));

const refreshDecks = vi.fn();

function makeDeck(id: string): AppDeckPayload {
  return { id, topic: id, words: [], lines: [] };
}

function mountCurateAudioPage() {
  return mount(CurateAudioPage, {
    global: {
      provide: {
        appDecks: ref([makeDeck('d1')]),
        refreshDecks,
      },
    },
  });
}

describe('CurateAudioPage', () => {
  beforeEach(() => {
    push.mockClear();
    refreshDecks.mockClear();
  });

  it('passes injected decks to CurateAudio', () => {
    const wrapper = mountCurateAudioPage();
    const curate = wrapper.findComponent(CurateAudio);
    expect(curate.exists()).toBe(true);
    expect(curate.props('decks')).toEqual([makeDeck('d1')]);
  });

  it('refreshes decks on uploaded and navigates back on back', async () => {
    const wrapper = mountCurateAudioPage();
    const curate = wrapper.findComponent(CurateAudio);

    await curate.vm.$emit('uploaded');
    expect(refreshDecks).toHaveBeenCalled();

    await curate.vm.$emit('back');
    expect(push).toHaveBeenCalledWith({ name: ROUTE_NAMES.CURATION });
  });
});
