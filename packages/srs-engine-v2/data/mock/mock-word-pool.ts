import { MockWord } from './mock-words.js';

/**
 * Global word pool — union of unique words across all conversations.
 * Each word appears exactly once. Decks reference words by ID.
 */
export const wordPool: MockWord[] = [
  // from "let's eat something"
  { id: 'th::หิว',        native: 'หิว',        romanization: 'hǐw',         english: 'hungry',                               type: 'adjective',    language: 'th' },
  { id: 'th::แล้ว',      native: 'แล้ว',       romanization: 'lɛ́ɛo',        english: 'already; now',                         type: 'particle',     language: 'th' },
  { id: 'th::ไป',         native: 'ไป',          romanization: 'bpai',         english: 'to go',                                type: 'verb',         language: 'th' },
  { id: 'th::กิน',        native: 'กิน',         romanization: 'gin',          english: 'to eat',                               type: 'verb',         language: 'th' },
  { id: 'th::อะไร',      native: 'อะไร',        romanization: 'a-rai',        english: 'what; something',                      type: 'question',     language: 'th' },
  { id: 'th::กัน',        native: 'กัน',         romanization: 'gan',          english: 'together',                             type: 'particle',     language: 'th' },
  // from "the weather is hot today" (excluding duplicates already above)
  { id: 'th::วันนี้',    native: 'วันนี้',       romanization: 'wan-née',      english: 'today',                                type: 'noun',         language: 'th' },
  { id: 'th::ร้อน',      native: 'ร้อน',         romanization: 'ráwn',         english: 'hot',                                  type: 'adjective',    language: 'th' },
  { id: 'th::มาก',        native: 'มาก',          romanization: 'mâak',         english: 'very',                                 type: 'adverb',       language: 'th' },
  { id: 'th::เลย',       native: 'เลย',          romanization: 'ləəi',         english: 'immediately; (particle for emphasis)', type: 'particle',     language: 'th' },
  { id: 'th::ใช่',       native: 'ใช่',          romanization: 'châi',         english: 'yes',                                  type: 'interjection', language: 'th' },
  { id: 'th::จริงๆ',     native: 'จริงๆ',        romanization: 'jing-jing',    english: 'really',                               type: 'adverb',       language: 'th' },
];
