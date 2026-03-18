import { describe, it, expect } from 'vitest';
import { mockConsonants } from '../../data/mock/mock-consonants.js';

describe('srs-engine-v2 smoke', () => {
  it('mock consonants load correctly', () => {
    expect(mockConsonants.length).toBeGreaterThan(0);
  });

  it('first consonant has required fields', () => {
    const card = mockConsonants[0];
    expect(card).toMatchObject({
      id: expect.any(String),
      native: expect.any(String),
      romanization: expect.any(String),
      english: expect.any(String),
      class: expect.stringMatching(/^(middle|high|low)$/),
      language: 'th',
    });
  });
});
