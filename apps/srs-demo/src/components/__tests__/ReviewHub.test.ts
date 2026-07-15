import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import ReviewHub from '../ReviewHub.vue';

function mountHub(props: Partial<{
  reviewUnlocked: boolean;
  dueCount: number | null;
  badgeError: boolean;
}> = {}) {
  return mount(ReviewHub, {
    props: {
      reviewUnlocked: props.reviewUnlocked ?? true,
      dueCount: props.dueCount ?? 3,
      badgeError: props.badgeError ?? false,
    },
  });
}

describe('ReviewHub', () => {
  it('disables the Due Review card when dueCount is exactly 0', async () => {
    const wrapper = mountHub({ dueCount: 0 });
    const dueButton = wrapper.find('.due-card');
    expect(dueButton.attributes('disabled')).toBeDefined();
    await dueButton.trigger('click');
    expect(wrapper.emitted('due')).toBeUndefined();
  });

  it('keeps the Due Review card clickable when dueCount is null (unknown/error)', async () => {
    const wrapper = mountHub({ dueCount: null, badgeError: true });
    const dueButton = wrapper.find('.due-card');
    expect(dueButton.attributes('disabled')).toBeUndefined();
    await dueButton.trigger('click');
    expect(wrapper.emitted('due')).toHaveLength(1);
  });

  it('keeps the Due Review card clickable when dueCount is greater than 0', async () => {
    const wrapper = mountHub({ dueCount: 5 });
    const dueButton = wrapper.find('.due-card');
    expect(dueButton.attributes('disabled')).toBeUndefined();
    await dueButton.trigger('click');
    expect(wrapper.emitted('due')).toHaveLength(1);
  });

  it('disables both cards when reviewUnlocked is false, regardless of dueCount', async () => {
    const wrapper = mountHub({ reviewUnlocked: false, dueCount: 5 });
    expect(wrapper.find('.due-card').attributes('disabled')).toBeDefined();
    expect(wrapper.find('.anytime-card').attributes('disabled')).toBeDefined();
  });
});
