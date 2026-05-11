export interface MockConsonant {
  id: string;
  foundationalType: 'consonant';
  native: string;
  romanization: string; // consonant name (e.g. 'Ko Kai'), not phonetic
  english: string;      // sound value (e.g. 'k')
  class: 'middle' | 'high' | 'low';
  language: 'th';
}

export const mockConsonants: MockConsonant[] = [
  { id: 'th::ก', foundationalType: 'consonant', native: 'ก', romanization: 'Ko Kai',    english: 'k',  class: 'middle', language: 'th' },
  { id: 'th::ข', foundationalType: 'consonant', native: 'ข', romanization: 'Kho Khai',  english: 'kh', class: 'high',   language: 'th' },
  { id: 'th::ค', foundationalType: 'consonant', native: 'ค', romanization: 'Kho Khwai', english: 'kh', class: 'low',    language: 'th' },
  { id: 'th::ง', foundationalType: 'consonant', native: 'ง', romanization: 'Ngo Ngu',   english: 'ng', class: 'low',    language: 'th' },
  { id: 'th::จ', foundationalType: 'consonant', native: 'จ', romanization: 'Cho Chan',  english: 'ch', class: 'middle', language: 'th' },
];
