import { Batch, BatchConfig, Deck } from '../types/deck.js';

export function generateBatches(deck: Deck, config: BatchConfig): Batch[] {
  const { nonFoundationalFocusCount, foundationalFocusCount, questionLimit } = config;
  const batchCount = Math.ceil(deck.wordPool.length / nonFoundationalFocusCount);
  const batches: Batch[] = [];

  for (let i = 0; i < batchCount; i++) {
    batches.push({
      focusWords: deck.wordPool.slice(i * nonFoundationalFocusCount, (i + 1) * nonFoundationalFocusCount),
      focusFoundational: deck.foundationalPool.slice(i * foundationalFocusCount, (i + 1) * foundationalFocusCount),
      questionLimit,
    });
  }

  return batches;
}
