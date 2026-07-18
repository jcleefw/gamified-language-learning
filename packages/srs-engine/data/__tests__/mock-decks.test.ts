import { describe, it, expect } from 'vitest';
import { wordPool } from '../mock/mock-word-pool.js';
import { mockDecks } from '../mock/mock-decks.js';

describe('wordPool', () => {
  it('contains at least 12 unique words', () => {
    expect(wordPool.length).toBeGreaterThanOrEqual(12);
  });

  it('every word has a th:: prefixed id', () => {
    for (const w of wordPool) {
      expect(w.id).toMatch(/^th::/);
    }
  });

  it('no duplicate ids in the pool', () => {
    const ids = wordPool.map(w => w.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('mockDecks', () => {
  it('contains exactly 2 decks', () => {
    expect(mockDecks).toHaveLength(2);
  });

  for (const deckIndex of [0, 1]) {
    describe(`deck ${deckIndex + 1}`, () => {
      it('has a non-empty topic', () => {
        expect(mockDecks[deckIndex].topic.length).toBeGreaterThan(0);
      });

      it('has exactly 6 wordIds', () => {
        expect(mockDecks[deckIndex].wordIds).toHaveLength(6);
      });

      it('all wordIds resolve to entries in wordPool', () => {
        for (const id of mockDecks[deckIndex].wordIds) {
          const found = wordPool.find(w => w.id === id);
          expect(found, `${id} not found in wordPool`).toBeDefined();
        }
      });

      it('no duplicate wordIds within the deck', () => {
        const ids = mockDecks[deckIndex].wordIds;
        expect(new Set(ids).size).toBe(ids.length);
      });

      it('has at least 1 line', () => {
        expect(mockDecks[deckIndex].lines.length).toBeGreaterThan(0);
      });

      it('each line has at least 1 word in words', () => {
        for (const line of mockDecks[deckIndex].lines) {
          expect(line.words.length).toBeGreaterThan(0);
        }
      });

      it('each line has a speaker', () => {
        for (const line of mockDecks[deckIndex].lines) {
          expect(['A', 'B']).toContain(line.speaker);
        }
      });
    });
  }

  it('words shared between decks exist exactly once in wordPool', () => {
    const deck1Ids = new Set(mockDecks[0].wordIds);
    const deck2Ids = new Set(mockDecks[1].wordIds);
    const shared = [...deck1Ids].filter(id => deck2Ids.has(id));

    for (const id of shared) {
      const matches = wordPool.filter(w => w.id === id);
      expect(matches, `${id} appears ${matches.length} times in pool`).toHaveLength(1);
    }
  });
});
