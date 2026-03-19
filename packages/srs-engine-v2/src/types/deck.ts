import { MockConsonant } from '../../data/mock/mock-consonants.js';
import { MockWord } from '../../data/mock/mock-words.js';

export interface Deck {
  wordPool: MockWord[];
  foundationalPool: MockConsonant[];
}
