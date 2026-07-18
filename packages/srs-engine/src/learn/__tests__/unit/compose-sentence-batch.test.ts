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

  describe('romanization-to-native', () => {
    it('produces a word-block question with correct direction', () => {
      const [, q] = composeSentenceBatch(ctx, tiles, 'th', { shuffle: false });
      expect(q.kind).toBe('word-block');
      expect(q.direction).toBe('romanization-to-native');
    });

    it('prompt is romanization tiles always space-joined regardless of language', () => {
      const [, q] = composeSentenceBatch(ctx, tiles, 'th', { shuffle: false });
      expect(q.prompt).toBe('hǐw bpai gin');
    });

    it('prompt is romanization tiles joined with space for English-script languages', () => {
      const enCtx: SentenceContext = { sentenceId: 's', englishSentence: 'I eat', wordOrder: ['a', 'b'] };
      const enTiles: SentenceTile[] = [
        { wordId: 'a', native: 'Je',    romanization: 'je',   english: 'I'   },
        { wordId: 'b', native: 'mange', romanization: 'mɑ̃ʒ', english: 'eat' },
      ];
      const [, q] = composeSentenceBatch(enCtx, enTiles, 'en', { shuffle: false });
      expect(q.prompt).toBe('je mɑ̃ʒ');
    });

    it('tiles are the same resolved tiles (native face)', () => {
      const [, q] = composeSentenceBatch(ctx, tiles, 'th', { shuffle: false });
      expect(q.tiles.map(t => t.native)).toEqual(expect.arrayContaining(['หิว', 'ไป', 'กิน']));
    });

    it('answer equals wordOrder', () => {
      const [, q] = composeSentenceBatch(ctx, tiles, 'th', { shuffle: false });
      expect(q.answer).toEqual(ctx.wordOrder);
    });

    it('shuffle: false produces deterministic tile order', () => {
      const [, a] = composeSentenceBatch(ctx, tiles, 'th', { shuffle: false });
      const [, b] = composeSentenceBatch(ctx, tiles, 'th', { shuffle: false });
      expect(a.tiles.map(t => t.wordId)).toEqual(b.tiles.map(t => t.wordId));
    });
  });

  describe('native-to-romanization', () => {
    it('produces a word-block question with correct direction', () => {
      const [,, q] = composeSentenceBatch(ctx, tiles, 'th', { shuffle: false });
      expect(q.kind).toBe('word-block');
      expect(q.direction).toBe('native-to-romanization');
    });

    it('prompt is native tiles joined with no-space for Thai', () => {
      const [,, q] = composeSentenceBatch(ctx, tiles, 'th', { shuffle: false });
      expect(q.prompt).toBe('หิวไปกิน');
    });

    it('answer equals wordOrder', () => {
      const [,, q] = composeSentenceBatch(ctx, tiles, 'th', { shuffle: false });
      expect(q.answer).toEqual(ctx.wordOrder);
    });

    it('shuffle: false produces deterministic tile order', () => {
      const [,, a] = composeSentenceBatch(ctx, tiles, 'th', { shuffle: false });
      const [,, b] = composeSentenceBatch(ctx, tiles, 'th', { shuffle: false });
      expect(a.tiles.map(t => t.wordId)).toEqual(b.tiles.map(t => t.wordId));
    });
  });

  describe('integration', () => {
    it('returns all 3 directions in order for a full corpus entry', () => {
      const questions = composeSentenceBatch(ctx, tiles, 'th', { shuffle: false });
      expect(questions).toHaveLength(3);
      expect(questions.map(q => q.direction)).toEqual([
        'english-to-native',
        'romanization-to-native',
        'native-to-romanization',
      ]);
    });

    it('all questions share the same sentenceId', () => {
      const questions = composeSentenceBatch(ctx, tiles, 'th', { shuffle: false });
      expect(questions.every(q => q.sentenceId === 'sent::001')).toBe(true);
    });

    it('all questions have the same answer (wordOrder)', () => {
      const questions = composeSentenceBatch(ctx, tiles, 'th', { shuffle: false });
      expect(questions.every(q => JSON.stringify(q.answer) === JSON.stringify(ctx.wordOrder))).toBe(true);
    });
  });
});
