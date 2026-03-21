import type { MockVowel } from '../../src/types/foundational.js';

export const mockVowels: MockVowel[] = [
  { id: 'th::ี', foundationalType: 'vowel', native: 'อี', romanization: 'ii', english: 'long i', position: 'surrounding', length: 'long', language: 'th' },
  { id: 'th::า', foundationalType: 'vowel', native: 'อา', romanization: 'aa', english: 'long a', position: 'trailing', length: 'long', language: 'th' },
  { id: 'th::ิ', foundationalType: 'vowel', native: 'อิ', romanization: 'i', english: 'short i', position: 'surrounding', length: 'short', language: 'th' },
  { id: 'th::ึ', foundationalType: 'vowel', native: 'อึ', romanization: 'ue', english: 'short ue', position: 'surrounding', length: 'short', language: 'th' },
  { id: 'th::ื', foundationalType: 'vowel', native: 'อื', romanization: 'uee', english: 'long uee', position: 'surrounding', length: 'long', language: 'th' },
];
