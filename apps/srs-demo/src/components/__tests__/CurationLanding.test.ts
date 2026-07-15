import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import CurationLanding from '../CurationLanding.vue';

describe('CurationLanding', () => {
  it('emits curate and mark on their respective clicks', async () => {
    const wrapper = mount(CurationLanding);
    const buttons = wrapper.findAll('button');
    expect(buttons.length).toBe(2);

    await buttons[0].trigger('click');
    expect(wrapper.emitted('curate')).toHaveLength(1);

    await buttons[1].trigger('click');
    expect(wrapper.emitted('mark')).toHaveLength(1);
  });
});
