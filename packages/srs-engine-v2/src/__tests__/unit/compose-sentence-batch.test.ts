import { describe, it, expect } from 'vitest';
import { composeSentenceBatch } from '../../engine/compose-sentence-batch.js';
import type { SentenceContext } from '../../types/sentence.js';
import type { SentenceTile } from '../../types/quiz.js';

const ctx: SentenceContext = {
  sentenceId: 'sent::001',
  englishSentence: "I'm hungry, let's go eat something",
  wordOrder: ['th::hungry', 'th::go', 'th::eat'],
};

const tiles: SentenceTile[] = [
  { wordId: 'th::hungry', native: 'หิว', romanization: 'hǐw',  english: 'hungry' },
  { wordId: 'th::go',     native: 'ไป',  romanization: 'bpai', english: 'go'     },
  { wordId: 'th::eat',    native: 'กิน', romanization: 'gin',  english: 'eat'    },
];

describe('composeSentenceBatch', () => {
  describe('english-to-native', () => {
    it('produces a word-block question with correct direction', () => {
      const [q] = composeSentenceBatch(ctx, tiles, 'th', { shuffle: false });
      expect(q.kind).toBe('word-block');
      expect(q.direction).toBe('english-to-native');
    });

    it('prompt is the authored englishSentence', () => {
      const [q] = composeSentenceBatch(ctx, tiles, 'th', { shuffle: false });
      expect(q.prompt).toBe(ctx.englishSentence);
    });

    it('answer equals wordOrder', () => {
      const [q] = composeSentenceBatch(ctx, tiles, 'th', { shuffle: false });
      expect(q.answer).toEqual(ctx.wordOrder);
    });

    it('tiles contain all four fields', () => {
      const [q] = composeSentenceBatch(ctx, tiles, 'th', { shuffle: false });
      for (const tile of q.tiles) {
        expect(tile).toHaveProperty('wordId');
        expect(tile).toHaveProperty('native');
        expect(tile).toHaveProperty('romanization');
        expect(tile).toHaveProperty('english');
      }
    });

    it('shuffle: false produces deterministic tile order', () => {
      const [a] = composeSentenceBatch(ctx, tiles, 'th', { shuffle: false });
      const [b] = composeSentenceBatch(ctx, tiles, 'th', { shuffle: false });
      expect(a.tiles.map(t => t.wordId)).toEqual(b.tiles.map(t => t.wordId));
    });

    it('sentenceId is carried through', () => {
      const [q] = composeSentenceBatch(ctx, tiles, 'th', { shuffle: false });
      expect(q.sentenceId).toBe('sent::001');
    });
  });
});
