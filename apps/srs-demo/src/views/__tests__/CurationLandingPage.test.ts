import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import CurationLandingPage from '../CurationLandingPage.vue';
import CurationLanding from '../../components/CurationLanding.vue';
import { ROUTE_NAMES } from '../../routeNames';

const push = vi.fn();
vi.mock('vue-router', () => ({
  useRouter: () => ({ push }),
}));

describe('CurationLandingPage', () => {
  beforeEach(() => {
    push.mockClear();
  });

  it('navigates to curate and mark routes on CurationLanding emits', async () => {
    const wrapper = mount(CurationLandingPage);
    const landing = wrapper.findComponent(CurationLanding);
    expect(landing.exists()).toBe(true);

    await landing.vm.$emit('curate');
    expect(push).toHaveBeenCalledWith({ name: ROUTE_NAMES.CURATE });

    await landing.vm.$emit('mark');
    expect(push).toHaveBeenCalledWith({ name: ROUTE_NAMES.MARK });
  });
});
