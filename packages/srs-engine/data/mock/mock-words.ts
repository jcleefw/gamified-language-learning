export interface MockWord {
  id: string;
  native: string;
  romanization: string; // phonetic pronunciation (e.g. 'hǐw')
  english: string;
  type: string;
  language: 'th';
}

export const mockWords: MockWord[] = [
  // "let's eat something" (12 words)
  { id: 'th::หิว',        native: 'หิว',        romanization: 'hǐw',         english: 'hungry',                               type: 'adjective',    language: 'th' },
  { id: 'th::แล้ว',      native: 'แล้ว',       romanization: 'lɛ́ɛo',        english: 'already; now',                         type: 'particle',     language: 'th' },
  { id: 'th::ไป',         native: 'ไป',          romanization: 'bpai',         english: 'to go',                                type: 'verb',         language: 'th' },
  { id: 'th::กิน',        native: 'กิน',         romanization: 'gin',          english: 'to eat',                               type: 'verb',         language: 'th' },
  { id: 'th::อะไร',      native: 'อะไร',        romanization: 'a-rai',        english: 'what; something',                      type: 'question',     language: 'th' },
  { id: 'th::กัน',        native: 'กัน',         romanization: 'gan',          english: 'together',                             type: 'particle',     language: 'th' },
  { id: 'th::ดี',         native: 'ดี',          romanization: 'dii',          english: 'good',                                 type: 'adjective',    language: 'th' },
  { id: 'th::เลย',       native: 'เลย',          romanization: 'ləəi',         english: 'immediately; (particle for emphasis)', type: 'particle',     language: 'th' },
  { id: 'th::อยาก',      native: 'อยาก',         romanization: 'yàak',         english: 'to want; to desire',                   type: 'verb',         language: 'th' },
  { id: 'th::ก๋วยเตี๋ยว', native: 'ก๋วยเตี๋ยว', romanization: 'gǔai-dtǐao',  english: 'noodles',                              type: 'noun',         language: 'th' },
  { id: 'th::ไหม',        native: 'ไหม',         romanization: 'mǎi',          english: 'question particle (yes/no)',           type: 'particle',     language: 'th' },
  { id: 'th::โอเค',      native: 'โอเค',         romanization: 'oo-kêe',       english: 'okay',                                 type: 'interjection', language: 'th' },

  // "the weather is hot today" (3 words)
  { id: 'th::วันนี้',    native: 'วันนี้',       romanization: 'wan-née',      english: 'today',                                type: 'noun',         language: 'th' },
  { id: 'th::ร้อน',      native: 'ร้อน',         romanization: 'ráwn',         english: 'hot',                                  type: 'adjective',    language: 'th' },
  { id: 'th::มาก',        native: 'มาก',          romanization: 'mâak',         english: 'very',                                 type: 'adverb',       language: 'th' },
];
