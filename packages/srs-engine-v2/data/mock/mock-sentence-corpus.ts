import type { SentenceContext } from '../../src/types/sentence.js';

export const mockSentenceCorpus: SentenceContext[] = [
  {
    sentenceId: 'sent::001',
    englishSentence: "I'm hungry, let's go eat something",
    wordOrder: ['th::หิว', 'th::แล้ว', 'th::ไป', 'th::กิน', 'th::อะไร', 'th::กัน'],
  },
  {
    sentenceId: 'sent::002',
    englishSentence: "It's really hot today",
    wordOrder: ['th::วันนี้', 'th::ร้อน', 'th::มาก', 'th::เลย'],
  },
];
