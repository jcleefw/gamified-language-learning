import { describe, it, expect } from 'vitest';
import { mockConsonants } from '../../data/mock/mock-consonants.js';

describe('srs-engine-v2 smoke', () => {
  it('mock consonants load correctly', () => {
    expect(mockConsonants.length).toBeGreaterThan(0);
  });

  it('first consonant has required fields', () => {
    const card = mockConsonants[0];
    expect(card).toMatchObject({
      id: expect.any(String) as unknown,
      native: expect.any(String) as unknown,
      romanization: expect.any(String) as unknown,
      english: expect.any(String) as unknown,
      class: expect.stringMatching(/^(middle|high|low)$/) as unknown,
      language: 'th',
    });
  });
});
