export interface MockWord {
  native: string;
  romanization: string; // phonetic pronunciation (e.g. 'hǐw')
  english: string;
  type: string;
  language: 'th';
}

export const mockWords: MockWord[] = [
  // "let's eat something" (12 words)
  { native: 'หิว',        romanization: 'hǐw',         english: 'hungry',                              type: 'adjective',   language: 'th' },
  { native: 'แล้ว',      romanization: 'lɛ́ɛo',        english: 'already; now',                        type: 'particle',    language: 'th' },
  { native: 'ไป',         romanization: 'bpai',         english: 'to go',                               type: 'verb',        language: 'th' },
  { native: 'กิน',        romanization: 'gin',          english: 'to eat',                              type: 'verb',        language: 'th' },
  { native: 'อะไร',      romanization: 'a-rai',         english: 'what; something',                     type: 'question',    language: 'th' },
  { native: 'กัน',        romanization: 'gan',          english: 'together',                            type: 'particle',    language: 'th' },
  { native: 'ดี',         romanization: 'dii',          english: 'good',                                type: 'adjective',   language: 'th' },
  { native: 'เลย',       romanization: 'ləəi',          english: 'immediately; (particle for emphasis)', type: 'particle',    language: 'th' },
  { native: 'อยาก',      romanization: 'yàak',          english: 'to want; to desire',                  type: 'verb',        language: 'th' },
  { native: 'ก๋วยเตี๋ยว', romanization: 'gǔai-dtǐao',  english: 'noodles',                             type: 'noun',        language: 'th' },
  { native: 'ไหม',        romanization: 'mǎi',          english: 'question particle (yes/no)',          type: 'particle',    language: 'th' },
  { native: 'โอเค',      romanization: 'oo-kêe',        english: 'okay',                                type: 'interjection', language: 'th' },

  // "the weather is hot today" (3 words)
  { native: 'วันนี้',    romanization: 'wan-née',       english: 'today',                               type: 'noun',        language: 'th' },
  { native: 'ร้อน',      romanization: 'ráwn',          english: 'hot',                                 type: 'adjective',   language: 'th' },
  { native: 'มาก',        romanization: 'mâak',          english: 'very',                                type: 'adverb',      language: 'th' },
];
