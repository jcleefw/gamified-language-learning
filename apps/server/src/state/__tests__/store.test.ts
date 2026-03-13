import { describe, it, expect, beforeEach } from 'vitest';
import type { WordState } from '@gll/srs-engine';
import { wordStates, wordDetails, deckId, seedStore } from '../store.js';
import type { WordDetail } from '../store.js';

const MOCK_STATES: WordState[] = [
  {
    wordId: 'foundational:ko-kai',
    category: 'foundational',
    masteryCount: 0,
    phase: 'learning',
    lapseCount: 0,
    correctCount: 0,
    wrongCount: 0,
  },
  {
    wordId: 'curated:หิว',
    category: 'curated',
    masteryCount: 0,
    phase: 'learning',
    lapseCount: 0,
    correctCount: 0,
    wrongCount: 0,
  },
];

const MOCK_DETAILS = new Map<string, WordDetail>([
  ['foundational:ko-kai', { native: 'ก', romanization: 'k', english: 'Ko Kai', category: 'foundational' }],
  ['curated:หิว', { native: 'หิว', romanization: 'hǐw', english: 'hungry', category: 'curated' }],
]);

describe('store', () => {
  beforeEach(() => {
    seedStore(MOCK_STATES, MOCK_DETAILS);
  });

  it('wordStates reflects seeded data', () => {
    expect(wordStates).toHaveLength(2);
    expect(wordStates[0].wordId).toBe('foundational:ko-kai');
  });

  it('wordDetails has entry for each seeded word', () => {
    expect(wordDetails.get('foundational:ko-kai')?.native).toBe('ก');
    expect(wordDetails.get('curated:หิว')?.native).toBe('หิว');
  });

  it('deckId is a non-empty string', () => {
    expect(typeof deckId).toBe('string');
    expect(deckId.length).toBeGreaterThan(0);
  });
});
