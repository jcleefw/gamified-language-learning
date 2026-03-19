import { mockConsonants } from '../data/mock/mock-consonants.js';
import { mockWords } from '../data/mock/mock-words.js';
import { generateBatches } from './engine/compose-deck.js';
import { runBatchLoop } from './runner/interactive.js';
import { Deck, BatchConfig } from './types/deck.js';

const deck: Deck = {
  wordPool: mockWords.slice(0, 3),
  foundationalPool: mockConsonants.slice(0, 3),
};

const batchConfig: BatchConfig = {
  nonFoundationalFocusCount: 1,
  foundationalFocusCount: 1,
  questionLimit: 2,
};

const batches = generateBatches(deck, batchConfig);

await runBatchLoop(batches, mockWords, mockConsonants);
