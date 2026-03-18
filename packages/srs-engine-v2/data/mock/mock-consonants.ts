export interface MockConsonant {
  id: string;
  native: string;
  romanization: string; // consonant name (e.g. 'Ko Kai'), not phonetic
  english: string;      // sound value (e.g. 'k')
  class: 'middle' | 'high' | 'low';
  language: 'th';
}

export const mockConsonants: MockConsonant[] = [
  { id: 'ko-kai',    native: 'ก', romanization: 'Ko Kai',    english: 'k',  class: 'middle', language: 'th' },
  { id: 'kho-khai',  native: 'ข', romanization: 'Kho Khai',  english: 'kh', class: 'high',   language: 'th' },
  { id: 'kho-khwai', native: 'ค', romanization: 'Kho Khwai', english: 'kh', class: 'low',    language: 'th' },
  { id: 'ngo-ngu',   native: 'ง', romanization: 'Ngo Ngu',   english: 'ng', class: 'low',    language: 'th' },
  { id: 'cho-chan',   native: 'จ', romanization: 'Cho Chan',  english: 'ch', class: 'middle', language: 'th' },
];
