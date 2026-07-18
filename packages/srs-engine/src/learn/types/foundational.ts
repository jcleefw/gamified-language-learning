import type { MockConsonant } from '../../../data/mock/mock-consonants.js';

export type ThaiFoundationalType = 'consonant' | 'vowel' | 'tone';
export type JapaneseFoundationalType = 'hiragana' | 'katakana' | 'kanji';

export type FoundationalBase = {
  id: string;
  foundationalType: ThaiFoundationalType | JapaneseFoundationalType;
  native: string;
  romanization: string; 
  english: string;   
  language: 'th' | 'jp';   
}


export interface ThaiConsonant extends FoundationalBase {
  foundationalType: 'consonant';
  class: 'middle' | 'high' | 'low';
  language: 'th';
}

export interface ThaiVowel extends FoundationalBase {
  foundationalType: 'vowel';
  position: 'leading' | 'trailing' | 'surrounding';
  length: 'short' | 'long';
  language: 'th'
}

export interface ThaiTone extends FoundationalBase {
  foundationalType: 'tone';
}


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

export type ThaiFoundational = ThaiConsonant | ThaiVowel | ThaiTone;