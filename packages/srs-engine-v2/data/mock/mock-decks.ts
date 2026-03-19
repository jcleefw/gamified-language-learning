import { MockDeck, MockLine } from '../../src/types/deck.js';

const eatLines: MockLine[] = [
  {
    speaker: 'A',
    native: 'หิวแล้ว ไปกินอะไรกัน?',
    romanization: 'hǐw lɛ́ɛo bpai gin a-rai gan?',
    english: "I'm hungry, let's go eat something?",
    words: [
      { id: 'th::หิว',   native: 'หิว',   romanization: 'hǐw',    english: 'hungry',         type: 'adjective',  language: 'th' },
      { id: 'th::แล้ว', native: 'แล้ว',  romanization: 'lɛ́ɛo',   english: 'already; now',   type: 'particle',   language: 'th' },
      { id: 'th::ไป',    native: 'ไป',     romanization: 'bpai',    english: 'to go',          type: 'verb',       language: 'th' },
      { id: 'th::กิน',   native: 'กิน',    romanization: 'gin',     english: 'to eat',         type: 'verb',       language: 'th' },
      { id: 'th::อะไร', native: 'อะไร',   romanization: 'a-rai',   english: 'what; something', type: 'question',  language: 'th' },
      { id: 'th::กัน',   native: 'กัน',    romanization: 'gan',     english: 'together',       type: 'particle',   language: 'th' },
    ],
  },
  {
    speaker: 'B',
    native: 'ดีเลย อยากกินอะไร?',
    romanization: 'dii ləəi yàak gin a-rai?',
    english: 'Good idea! What do you want to eat?',
    words: [
      { id: 'th::ดี',    native: 'ดี',     romanization: 'dii',     english: 'good',            type: 'adjective',  language: 'th' },
      { id: 'th::เลย',  native: 'เลย',     romanization: 'ləəi',    english: 'immediately; (particle for emphasis)', type: 'particle', language: 'th' },
      { id: 'th::อยาก', native: 'อยาก',    romanization: 'yàak',    english: 'to want; to desire', type: 'verb',   language: 'th' },
      { id: 'th::กิน',   native: 'กิน',    romanization: 'gin',     english: 'to eat',         type: 'verb',       language: 'th' },
      { id: 'th::อะไร', native: 'อะไร',   romanization: 'a-rai',   english: 'what; something', type: 'question',  language: 'th' },
    ],
  },
  {
    speaker: 'A',
    native: 'กินก๋วยเตี๋ยวไหม?',
    romanization: 'gin gǔai-dtǐao mǎi?',
    english: 'How about eating noodles?',
    words: [
      { id: 'th::กิน',           native: 'กิน',           romanization: 'gin',         english: 'to eat',                     type: 'verb',     language: 'th' },
      { id: 'th::ก๋วยเตี๋ยว', native: 'ก๋วยเตี๋ยว', romanization: 'gǔai-dtǐao', english: 'noodles',                    type: 'noun',     language: 'th' },
      { id: 'th::ไหม',           native: 'ไหม',           romanization: 'mǎi',         english: 'question particle (yes/no)', type: 'particle', language: 'th' },
    ],
  },
  {
    speaker: 'B',
    native: 'โอเค ไปกันเลย!',
    romanization: 'oo-kêe bpai gan ləəi!',
    english: "Okay, let's go now!",
    words: [
      { id: 'th::โอเค', native: 'โอเค', romanization: 'oo-kêe', english: 'okay',                                 type: 'interjection', language: 'th' },
      { id: 'th::ไป',    native: 'ไป',     romanization: 'bpai',   english: 'to go',                                type: 'verb',         language: 'th' },
      { id: 'th::กัน',   native: 'กัน',    romanization: 'gan',    english: 'together',                             type: 'particle',     language: 'th' },
      { id: 'th::เลย',  native: 'เลย',     romanization: 'ləəi',   english: 'immediately; (particle for emphasis)', type: 'particle',     language: 'th' },
    ],
  },
];

const weatherLines: MockLine[] = [
  {
    speaker: 'A',
    native: 'วันนี้ร้อนมากเลย!',
    romanization: 'wan-née ráwn mâak ləəi!',
    english: "It's very hot today!",
    words: [
      { id: 'th::วันนี้', native: 'วันนี้', romanization: 'wan-née', english: 'today', type: 'noun',      language: 'th' },
      { id: 'th::ร้อน',   native: 'ร้อน',    romanization: 'ráwn',    english: 'hot',   type: 'adjective', language: 'th' },
      { id: 'th::มาก',     native: 'มาก',      romanization: 'mâak',    english: 'very',  type: 'adverb',    language: 'th' },
      { id: 'th::เลย',    native: 'เลย',      romanization: 'ləəi',    english: 'immediately; (particle for emphasis)', type: 'particle', language: 'th' },
    ],
  },
  {
    speaker: 'B',
    native: 'ใช่ ร้อนจริงๆ ดื่มน้ำไหม?',
    romanization: 'châi ráwn jing-jing deùm nám mái?',
    english: "Yes, it's really hot. Drink some water?",
    words: [
      { id: 'th::ใช่',    native: 'ใช่',    romanization: 'châi',      english: 'yes',              type: 'interjection', language: 'th' },
      { id: 'th::ร้อน',   native: 'ร้อน',    romanization: 'ráwn',      english: 'hot',              type: 'adjective',    language: 'th' },
      { id: 'th::จริงๆ',  native: 'จริงๆ',   romanization: 'jing-jing', english: 'really',           type: 'adverb',       language: 'th' },
      { id: 'th::ดื่ม',   native: 'ดื่ม',    romanization: 'deùm',      english: 'drink',            type: 'verb',         language: 'th' },
      { id: 'th::น้ำ',    native: 'น้ำ',     romanization: 'nám',       english: 'water',            type: 'noun',         language: 'th' },
      { id: 'th::ไหม',     native: 'ไหม',      romanization: 'mái',       english: 'question particle', type: 'particle',    language: 'th' },
    ],
  },
  {
    speaker: 'A',
    native: 'ดีเลย อยากดื่มน้ำเย็น',
    romanization: 'dee ləəi yàak deùm nám yen',
    english: 'Good idea. I want to drink cold water.',
    words: [
      { id: 'th::ดี',    native: 'ดี',    romanization: 'dee',   english: 'good',  type: 'adjective', language: 'th' },
      { id: 'th::เลย',  native: 'เลย',    romanization: 'ləəi',  english: 'immediately; (particle for emphasis)', type: 'particle', language: 'th' },
      { id: 'th::อยาก', native: 'อยาก',   romanization: 'yàak',  english: 'want',  type: 'verb',      language: 'th' },
      { id: 'th::ดื่ม', native: 'ดื่ม',   romanization: 'deùm',  english: 'drink', type: 'verb',      language: 'th' },
      { id: 'th::น้ำ',  native: 'น้ำ',    romanization: 'nám',   english: 'water', type: 'noun',      language: 'th' },
      { id: 'th::เย็น', native: 'เย็น',   romanization: 'yen',   english: 'cold',  type: 'adjective', language: 'th' },
    ],
  },
  {
    speaker: 'B',
    native: 'ไปซื้อที่ร้านกัน',
    romanization: 'bpai seú têe ráan gan',
    english: "Let's go buy some at the shop.",
    words: [
      { id: 'th::ไป',    native: 'ไป',    romanization: 'bpai',  english: 'to go',    type: 'verb',        language: 'th' },
      { id: 'th::ซื้อ', native: 'ซื้อ',   romanization: 'seú',   english: 'buy',      type: 'verb',        language: 'th' },
      { id: 'th::ที่',   native: 'ที่',    romanization: 'têe',   english: 'at',       type: 'preposition', language: 'th' },
      { id: 'th::ร้าน', native: 'ร้าน',   romanization: 'ráan',  english: 'shop',     type: 'noun',        language: 'th' },
      { id: 'th::กัน',   native: 'กัน',    romanization: 'gan',   english: 'together', type: 'particle',    language: 'th' },
    ],
  },
];

export const mockDecks: MockDeck[] = [
  {
    id: 'deck-eat',
    topic: "let's eat something",
    lines: eatLines,
    wordIds: ['th::หิว', 'th::แล้ว', 'th::ไป', 'th::กิน', 'th::อะไร', 'th::กัน'],
  },
  {
    id: 'deck-weather',
    topic: 'The weather is hot today',
    lines: weatherLines,
    wordIds: ['th::กัน', 'th::วันนี้', 'th::ร้อน', 'th::มาก', 'th::เลย', 'th::ใช่'],
  },
];
