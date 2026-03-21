import type { MockTone } from '../../src/types/foundational.js';

export const mockTones: MockTone[] = [
  { id: 'th::่', foundationalType: 'tone', native: '่', romanization: 'mai ek', english: 'low tone', language: 'th' },
  { id: 'th::้', foundationalType: 'tone', native: '้', romanization: 'mai tho', english: 'falling tone', language: 'th' },
  { id: 'th::๊', foundationalType: 'tone', native: '๊', romanization: 'mai tri', english: 'high tone', language: 'th' },
  { id: 'th::๋', foundationalType: 'tone', native: '๋', romanization: 'mai chattawa', english: 'rising tone', language: 'th' },
  { id: 'th::mid', foundationalType: 'tone', native: '', romanization: 'mid tone', english: 'mid tone', language: 'th' },
];
