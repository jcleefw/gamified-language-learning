import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref } from 'vue';
import ReviewHubPage from '../ReviewHubPage.vue';
import ReviewHub from '../../components/ReviewHub.vue';
import { ROUTE_NAMES } from '../../routeNames';

const push = vi.fn();
vi.mock('vue-router', () => ({
  useRouter: () => ({ push }),
}));

const onReview = vi.fn();
const onAnytimeReview = vi.fn();

function mountReviewHubPage(overrides: Partial<{
  dueReviewCount: number | null;
  badgeError: boolean;
  reviewUnlocked: boolean;
}> = {}) {
  return mount(ReviewHubPage, {
    global: {
      provide: {
        reviewSession: {
          dueReviewCount: ref(overrides.dueReviewCount ?? 3),
          badgeError: ref(overrides.badgeError ?? false),
          reviewUnlocked: ref(overrides.reviewUnlocked ?? true),
          onReview,
          onAnytimeReview,
        },
      },
    },
  });
}

describe('ReviewHubPage', () => {
  beforeEach(() => {
    push.mockClear();
    onReview.mockClear();
    onAnytimeReview.mockClear();
  });

  it('passes injected review session state to ReviewHub', () => {
    const wrapper = mountReviewHubPage({ dueReviewCount: 4, reviewUnlocked: true });
    const hub = wrapper.findComponent(ReviewHub);
    expect(hub.exists()).toBe(true);
    expect(hub.props('dueCount')).toBe(4);
    expect(hub.props('reviewUnlocked')).toBe(true);
  });

  it('navigates to review session with ?mode=due when due entry succeeds, stays when it does not', async () => {
    onReview.mockResolvedValueOnce('entered');
    const wrapper = mountReviewHubPage();
    await wrapper.findComponent(ReviewHub).vm.$emit('due');
    await Promise.resolve();
    expect(push).toHaveBeenCalledWith({
      name: ROUTE_NAMES.REVIEW_SESSION,
      query: { mode: 'due' },
    });

    push.mockClear();
    onAnytimeReview.mockResolvedValueOnce('stayed');
    await wrapper.findComponent(ReviewHub).vm.$emit('anytime');
    await Promise.resolve();
    expect(push).not.toHaveBeenCalled();
  });

  it('navigates to review session with ?mode=anytime when anytime entry succeeds', async () => {
    onAnytimeReview.mockResolvedValueOnce('entered');
    const wrapper = mountReviewHubPage();
    await wrapper.findComponent(ReviewHub).vm.$emit('anytime');
    await Promise.resolve();
    expect(push).toHaveBeenCalledWith({
      name: ROUTE_NAMES.REVIEW_SESSION,
      query: { mode: 'anytime' },
    });
  });
});
