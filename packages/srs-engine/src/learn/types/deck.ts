import type { MockWord } from '../../../data/mock/mock-words.js';

export interface MockLine {
  sentenceId: string;
  speaker: 'A' | 'B';
  native: string;
  romanization: string;
  english: string;
  words: MockWord[];
}

export interface MockDeck {
  id: string;
  topic: string;
  lines: MockLine[];
  wordIds: string[];
}
