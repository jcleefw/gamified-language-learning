import type { MockVowel } from '../../src/types/foundational.js';

export const mockVowels: MockVowel[] = [
  { id: 'th::ี', foundationalType: 'vowel', native: 'อี', romanization: 'sara-ii', english: 'long i', position: 'surrounding', length: 'long', language: 'th' },
  { id: 'th::า', foundationalType: 'vowel', native: 'อา', romanization: 'sara-aa', english: 'long a', position: 'trailing', length: 'long', language: 'th' },
  { id: 'th::ิ', foundationalType: 'vowel', native: 'อิ', romanization: 'sara-i', english: 'short i', position: 'surrounding', length: 'short', language: 'th' },
  { id: 'th::ึ', foundationalType: 'vowel', native: 'อึ', romanization: 'sara-ue', english: 'short ue', position: 'surrounding', length: 'short', language: 'th' },
  { id: 'th::ื', foundationalType: 'vowel', native: 'อื', romanization: 'sara-uee', english: 'long uee', position: 'surrounding', length: 'long', language: 'th' },
];
