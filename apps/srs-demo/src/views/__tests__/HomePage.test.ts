import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref } from 'vue';
import HomePage from '../HomePage.vue';
import HomeDashboard from '../../components/HomeDashboard.vue';
import { ROUTE_NAMES } from '../../routeNames';

const push = vi.fn();
vi.mock('vue-router', () => ({
  useRouter: () => ({ push }),
}));

function mountHomePage(overrides: Partial<{
  dueReviewCount: number | null;
  badgeError: boolean;
  reviewUnlocked: boolean;
}> = {}) {
  return mount(HomePage, {
    global: {
      provide: {
        reviewSession: {
          dueReviewCount: ref(overrides.dueReviewCount ?? 0),
          badgeError: ref(overrides.badgeError ?? false),
          reviewUnlocked: ref(overrides.reviewUnlocked ?? false),
        },
      },
      stubs: {
        RouterLink: true,
      },
    },
  });
}

describe('HomePage', () => {
  beforeEach(() => {
    push.mockClear();
  });

  it('passes injected review session state to HomeDashboard', () => {
    const wrapper = mountHomePage({
      dueReviewCount: 5,
      badgeError: false,
      reviewUnlocked: true,
    });

    const dashboard = wrapper.findComponent(HomeDashboard);
    expect(dashboard.exists()).toBe(true);
    expect(dashboard.props('dueCount')).toBe(5);
    expect(dashboard.props('badgeError')).toBe(false);
    expect(dashboard.props('reviewUnlocked')).toBe(true);
  });

  it('navigates to deck select when HomeDashboard emits learn', async () => {
    const wrapper = mountHomePage();
    await wrapper.findComponent(HomeDashboard).vm.$emit('learn');
    expect(push).toHaveBeenCalledWith({ name: ROUTE_NAMES.DECK_SELECT });
  });

  it('navigates to review hub when HomeDashboard emits review', async () => {
    const wrapper = mountHomePage();
    await wrapper.findComponent(HomeDashboard).vm.$emit('review');
    expect(push).toHaveBeenCalledWith({ name: ROUTE_NAMES.REVIEW_HUB });
  });
});
