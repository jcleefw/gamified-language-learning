import type { MockConsonant } from '../../data/mock/mock-consonants.js';

export interface MockVowel {
  id: string;
  foundationalType: 'vowel';
  native: string;
  romanization: string;
  english: string;
  position: 'leading' | 'trailing' | 'surrounding';
  length: 'short' | 'long';
  language: 'th';
}

export interface MockTone {
  id: string;
  foundationalType: 'tone';
  native: string;
  romanization: string;
  english: string;
  language: 'th';
}

export type MockFoundational = MockConsonant | MockVowel | MockTone;
