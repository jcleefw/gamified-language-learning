import type { MockTone } from '../../src/learn/types/foundational.js';

export const mockTones: MockTone[] = [
  { id: 'th:mai ek:่', foundationalType: 'tone', native: 'mai ek:่', romanization: 'mai ek', english: 'low tone', language: 'th' },
  { id: 'th:mai tho:้', foundationalType: 'tone', native: "mai tho:'้", romanization: 'mai tho', english: 'falling tone', language: 'th' },
  { id: 'th:mai tri:๊', foundationalType: 'tone', native: "mai tri:'๊", romanization: 'mai tri', english: 'high tone', language: 'th' },
  { id: 'th:mai chattawa:๋', foundationalType: 'tone', native: "mai chattawa:'๋", romanization: 'mai chattawa', english: 'rising tone', language: 'th' },
  { id: 'th::mid', foundationalType: 'tone', native: "mid tone:-", romanization: 'mid tone', english: 'mid tone', language: 'th' },
];
