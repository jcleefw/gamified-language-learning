import type { SentenceContext } from '../../src/types/sentence.js';

export const mockSentenceCorpus: SentenceContext[] = [
  {
    // "หิวแล้วไปกินอะไรกัน" — Let's go eat something, we're hungry
    sentenceId: 'sent::001',
    wordOrder: ['th::หิว', 'th::แล้ว', 'th::ไป', 'th::กิน', 'th::อะไร', 'th::กัน'],
  },
  {
    // "วันนี้ร้อนมากเลย" — It's very hot today
    sentenceId: 'sent::002',
    wordOrder: ['th::วันนี้', 'th::ร้อน', 'th::มาก', 'th::เลย'],
  },
];
