import type { FoundationalCharacter } from '../types.js'

/**
 * Thai consonants with stroke order data
 * Starting with 10 most common characters
 */

// ก - Ko Kai (Middle class)
const KO_KAI: FoundationalCharacter = {
  id: 'ko-kai',
  char: 'ก',
  name: 'Ko Kai',
  romanization: 'k',
  language: 'th',
  nameThai: 'ก ไก่',
  type: 'consonant',
  audioFile: 'consonants/ko-kai.m4a.webm',
  metadata: {
    class: 'middle',
    soundClass: 'k',
    romanization: 'k',
    ipa: '/k/',
    pronunciation: 'gaw1 gai2',
    associatedWords: ['ก ไก่ - chicken'],
    notes:
      'Thai k is pronounced like `G(gor)` in English. It is unaspirated (no puff of air) unlike k(kiss).',
  },
};

// ข - Kho Khai (High class)
const KHO_KHAI: FoundationalCharacter = {
  id: 'kho-khai',
  char: 'ข',
  name: 'Kho Khai',
  romanization: 'kh',
  language: 'th',
  nameThai: 'ข ไข่',
  type: 'consonant',
  audioFile: 'consonants/kho-khai.m4a.webm',
  metadata: {
    class: 'high',
    soundClass: 'kh',
    romanization: 'kh',
    ipa: '/kʰ/',
    pronunciation: 'kho5 khai2',
    associatedWords: ['ข ไข่ - egg'],
    notes:
      'Thai kh is pronounced like `K(koh)` in English. It is aspirated (puff of air) unlike k(ghost).',
  },
};

// ค - Kho Khwai (Low class)
const KHO_KHWAI: FoundationalCharacter = {
  id: 'kho-khwai',
  char: 'ค',
  name: 'Kho Khwai',
  romanization: 'kh',
  language: 'th',
  nameThai: 'ค ควาย',
  type: 'consonant',
  audioFile: 'consonants/kho-khwai.m4a.webm',
  metadata: {
    class: 'low',
    soundClass: 'kh',
    romanization: 'kh',
    ipa: '/kʰ/',
    pronunciation: 'kho1 khwai1',
    associatedWords: ['ค ควาย - water buffalo', 'ควาย - stupid person'],
    notes:
      'Thai kh is pronounced like `K(koh)` in English. It is aspirated (puff of air) unlike k(ghost).',
  },
};

// ง - Ngo Ngu (Low class)
const NGO_NGU: FoundationalCharacter = {
  id: 'ngo-ngu',
  char: 'ง',
  name: 'Ngo Ngu',
  romanization: 'ng',
  language: 'th',
  nameThai: 'ง งู',
  type: 'consonant',
  audioFile: 'consonants/ngo-ngu.m4a.webm',
  metadata: {
    class: 'low',
    soundClass: 'ng',
    romanization: 'ng',
    pronunciation: 'ngoh1 ngu1',
    associatedWords: ['ง งู - snake'],
    ipa: '/ŋ/',
    notes:
      'Thai ng is pronounced like `ng` in English. It is a nasal consonant like sing',
  },
};

// จ - Cho Chan (Middle class)
const CHO_CHAN: FoundationalCharacter = {
  id: 'cho-chan',
  char: 'จ',
  name: 'Cho Chan',
  romanization: 'ch',
  language: 'th',
  nameThai: 'จ จาน',
  type: 'consonant',
  audioFile: 'consonants/cho-chan.webm',
  metadata: {
    class: 'middle',
    soundClass: 'ch',
    romanization: 'ch',
    ipa: '/t͡ɕ/',
    pronunciation: 'tco1 jhan1',
    associatedWords: ['จ จาน - plate'],
    notes: 'Thai ch is pronounced closer to `座位` in cantonese.',
  },
};

// ฉ - Cho Ching (High class)
const CHO_CHING: FoundationalCharacter = {
  id: 'cho-ching',
  char: 'ฉ',
  name: 'Cho Ching',
  romanization: 'ch',
  language: 'th',
  nameThai: 'ฉ ฉิ่ง',
  type: 'consonant',
  audioFile: 'consonants/cho-ching.webm',
  metadata: {
    class: 'high',
    soundClass: 'ch',
    romanization: 'ch',
    pronunciation: 'tch5 ching1',
    ipa: '/t͡ɕʰ/',
    associatedWords: ['ฉ ฉิ่ง - cymbal'],
    notes: 'Thai ch is pronounced closer to `坐` in cantonese.',
  },
};

// ช - Cho Chang (Low class)
const CHO_CHANG: FoundationalCharacter = {
  id: 'cho-chang',
  char: 'ช',
  name: 'Cho Chang',
  romanization: 'ch',
  language: 'th',
  nameThai: 'ช ช้าง',
  type: 'consonant',
  audioFile: 'consonants/cho-chang.webm',
  metadata: {
    class: 'low',
    soundClass: 'ch',
    romanization: 'ch',
    ipa: '/t͡ɕʰ/',
    pronunciation: 'cho1 chang4',
    associatedWords: ['ช ช้าง - elephant'],
    notes:
      'Thai ch is pronounced closer to `坐` in cantonese. And chang is pronounced like `长` in mandarin.',
  },
};

// ซ - So So (Low class)
const SO_SO: FoundationalCharacter = {
  id: 'so-so',
  char: 'ซ',
  name: 'So So',
  romanization: 's',
  language: 'th',
  nameThai: 'ซ โซ่',
  type: 'consonant',
  audioFile: 'consonants/so-so.webm',
  metadata: {
    class: 'low',
    soundClass: 's',
    romanization: 's',
    pronunciation: 'so1 so3',
    associatedWords: ['ซ โซ่ - chain'],
    notes:
      'Thai s is pronounced like `傻` in cantonese. The associated is pronounced like `苏` in cantonese.',
    ipa: '/s/',
  },
};

// ด - Do Dek (Middle class)
const DO_DEK: FoundationalCharacter = {
  id: 'do-dek',
  char: 'ด',
  name: 'Do Dek',
  romanization: 'd',
  language: 'th',
  nameThai: 'ด เด็ก',
  type: 'consonant',
  metadata: {
    class: 'middle',
    soundClass: 'd',
    romanization: 'd',
    ipa: '/d/',
  },
};

// ต - To Tao (Middle class)
const TO_TAO: FoundationalCharacter = {
  id: 'to-tao',
  char: 'ต',
  name: 'To Tao',
  romanization: 't',
  language: 'th',
  nameThai: 'ต เต่า',
  type: 'consonant',
  metadata: {
    class: 'middle',
    soundClass: 't',
    romanization: 't',
    ipa: '/t/',
  },
};

// บ - Bo Baimai (Middle class)
const BO_BAIMAI: FoundationalCharacter = {
  id: 'bo-baimai',
  char: 'บ',
  name: 'Bo Baimai',
  romanization: 'b',
  language: 'th',
  nameThai: 'บ ใบไม้',
  type: 'consonant',
  metadata: {
    class: 'middle',
    soundClass: 'b',
    romanization: 'b',
    ipa: '/b/',
  },
};

// ป - Po Pla (Middle class)
const PO_PLA: FoundationalCharacter = {
  id: 'po-pla',
  char: 'ป',
  name: 'Po Pla',
  romanization: 'p',
  language: 'th',
  nameThai: 'ป ปลา',
  type: 'consonant',
  metadata: {
    class: 'middle',
    soundClass: 'p',
    romanization: 'p',
    ipa: '/p/',
  },
};

// น - No Nu (Low class)
const NO_NU: FoundationalCharacter = {
  id: 'no-nu',
  char: 'น',
  name: 'No Nu',
  romanization: 'n',
  language: 'th',
  nameThai: 'น หนู',
  type: 'consonant',
  audioFile: 'consonants/no-nu.webm',
  metadata: {
    class: 'low',
    soundClass: 'n',
    romanization: 'n',
    ipa: '/n/',
    pronunciation: 'no1 nu5',
    associatedWords: ['น หนู - mouse'],
  },
};

// ม - Mo Ma (Low class)
const MO_MA: FoundationalCharacter = {
  id: 'mo-ma',
  char: 'ม',
  name: 'Mo Ma',
  romanization: 'm',
  language: 'th',
  nameThai: 'ม ม้า',
  type: 'consonant',
  metadata: {
    class: 'low',
    soundClass: 'm',
    romanization: 'm',
    ipa: '/m/',
  },
};

// ส - So Sua (High class)
const SO_SUA: FoundationalCharacter = {
  id: 'so-sua',
  char: 'ส',
  name: 'So Sua',
  romanization: 's',
  language: 'th',
  nameThai: 'ส เสือ',
  type: 'consonant',
  metadata: {
    class: 'high',
    soundClass: 's',
    romanization: 's',
    ipa: '/s/',
  },
};

// ===== REMAINING MID-CLASS CONSONANTS (3) =====

// ฎ - Do Chada (Middle class)
const DO_CHADA: FoundationalCharacter = {
  id: 'do-chada',
  char: 'ฎ',
  name: 'Do Chada',
  romanization: 'd',
  language: 'th',
  type: 'consonant',
  metadata: {
    class: 'middle',
    soundClass: 'd',
    romanization: 'd',
  },
};

// ฏ - To Patak (Middle class)
const TO_PATAK: FoundationalCharacter = {
  id: 'to-patak',
  char: 'ฏ',
  name: 'To Patak',
  romanization: 't',
  language: 'th',
  type: 'consonant',
  metadata: {
    class: 'middle',
    soundClass: 't',
    romanization: 't',
  },
};

// อ - O Ang (Middle class)
const O_ANG: FoundationalCharacter = {
  id: 'o-ang',
  char: 'อ',
  name: 'O Ang',
  romanization: '',
  language: 'th',
  type: 'consonant',
  metadata: {
    class: 'middle',
    soundClass: '',
    romanization: '',
  },
};

// ===== REMAINING HIGH-CLASS CONSONANTS (8) =====

// ฃ - Kho Khuat (High class, obsolete)
const KHO_KHUAT: FoundationalCharacter = {
  id: 'kho-khuat',
  char: 'ฃ',
  name: 'Kho Khuat',
  romanization: 'kh',
  language: 'th',
  type: 'consonant',
  audioFile: 'consonants/kho-khuat.m4a.webm',
  metadata: {
    class: 'high',
    soundClass: 'kh',
    romanization: 'kh',
    status: 'obsolete',
    ipa: '/kʰ/',
    pronunciation: 'kho5 khuat2',
    associatedWords: ['คอต - area, district', 'bottle'],
    notes:
      'Same pronunciation as kho khai (ข), but now obsolete. It is often spelled as "kho khai" instead of "kho khuat".',
  },
};

// ฐ - Tho Than (High class)
const THO_THAN: FoundationalCharacter = {
  id: 'tho-than',
  char: 'ฐ',
  name: 'Tho Than',
  romanization: 'th',
  language: 'th',
  type: 'consonant',
  metadata: {
    class: 'high',
    soundClass: 'th',
    romanization: 'th',
  },
};

// ถ - Tho Thung (High class)
const THO_THUNG: FoundationalCharacter = {
  id: 'tho-thung',
  char: 'ถ',
  name: 'Tho Thung',
  romanization: 'th',
  language: 'th',
  type: 'consonant',
  metadata: {
    class: 'high',
    soundClass: 'th',
    romanization: 'th',
  },
};

// ผ - Pho Phung (High class)
const PHO_PHUNG: FoundationalCharacter = {
  id: 'pho-phung',
  char: 'ผ',
  name: 'Pho Phung',
  romanization: 'ph',
  language: 'th',
  type: 'consonant',
  metadata: {
    class: 'high',
    soundClass: 'ph',
    romanization: 'ph',
  },
};

// ฝ - Fo Fa (High class)
const FO_FA: FoundationalCharacter = {
  id: 'fo-fa',
  char: 'ฝ',
  name: 'Fo Fa',
  romanization: 'f',
  language: 'th',
  type: 'consonant',
  metadata: {
    class: 'high',
    soundClass: 'f',
    romanization: 'f',
  },
};

// ศ - So Sala (High class)
const SO_SALA: FoundationalCharacter = {
  id: 'so-sala',
  char: 'ศ',
  name: 'So Sala',
  romanization: 's',
  language: 'th',
  type: 'consonant',
  metadata: {
    class: 'high',
    soundClass: 's',
    romanization: 's',
  },
};

// ษ - So Rusi (High class)
const SO_RUSI: FoundationalCharacter = {
  id: 'so-rusi',
  char: 'ษ',
  name: 'So Rusi',
  romanization: 's',
  language: 'th',
  type: 'consonant',
  metadata: {
    class: 'high',
    soundClass: 's',
    romanization: 's',
  },
};

// ห - Ho Hip (High class)
const HO_HIP: FoundationalCharacter = {
  id: 'ho-hip',
  char: 'ห',
  name: 'Ho Hip',
  romanization: 'h',
  language: 'th',
  type: 'consonant',
  metadata: {
    class: 'high',
    soundClass: 'h',
    romanization: 'h',
  },
};

// ===== REMAINING LOW-CLASS CONSONANTS (18) =====

// ฅ - Kho Khon (Low class, obsolete)
const KHO_KHON: FoundationalCharacter = {
  id: 'kho-khon',
  char: 'ฅ',
  name: 'Kho Khon',
  romanization: 'kh',
  language: 'th',
  type: 'consonant',
  audioFile: 'consonants/kho-khon.m4a.webm',
  metadata: {
    class: 'low',
    soundClass: 'kh',
    romanization: 'kh',
    status: 'obsolete',
    ipa: '/kʰ/',
    pronunciation: 'kho1 khon1',
    associatedWords: ['คอน - person/people'],
    notes:
      'Same pronunciation as kho khwai (ข), but now obsolete. It is often spelled as "kho khwai" instead of "kho khon".',
  },
};

// ฆ - Kho Rakhang (Low class)
const KHO_RAKHANG: FoundationalCharacter = {
  id: 'kho-rakhang',
  char: 'ฆ',
  name: 'Kho Rakhang',
  romanization: 'kh',
  language: 'th',
  type: 'consonant',
  audioFile: 'consonants/kho-rakhang.m4a.webm',
  metadata: {
    class: 'low',
    soundClass: 'kh',
    romanization: 'kh',
    ipa: '/kʰ/',
    pronunciation: 'kho1 ra4khang1',
    associatedWords: ['ฆ ระฆัง - bell'],
  },
};

// ฌ - Cho Choe (Low class)
const CHO_CHOE: FoundationalCharacter = {
  id: 'cho-choe',
  char: 'ฌ',
  name: 'Cho Choe',
  romanization: 'ch',
  language: 'th',
  type: 'consonant',
  metadata: {
    class: 'low',
    soundClass: 'ch',
    romanization: 'ch',
  },
};

// ญ - Yo Ying (Low class)
const YO_YING: FoundationalCharacter = {
  id: 'yo-ying',
  char: 'ญ',
  name: 'Yo Ying',
  romanization: 'y',
  language: 'th',
  type: 'consonant',
  metadata: {
    class: 'low',
    soundClass: 'y',
    romanization: 'y',
  },
};

// ฑ - Tho Montho (Low class)
const THO_MONTHO: FoundationalCharacter = {
  id: 'tho-montho',
  char: 'ฑ',
  name: 'Tho Montho',
  romanization: 'th',
  language: 'th',
  type: 'consonant',
  metadata: {
    class: 'low',
    soundClass: 'th',
    romanization: 'th',
  },
};

// ฒ - Tho Phuthao (Low class)
const THO_PHUTHAO: FoundationalCharacter = {
  id: 'tho-phuthao',
  char: 'ฒ',
  name: 'Tho Phuthao',
  romanization: 'th',
  language: 'th',
  type: 'consonant',
  metadata: {
    class: 'low',
    soundClass: 'th',
    romanization: 'th',
  },
};

// ณ - No Nen (Low class)
const NO_NEN: FoundationalCharacter = {
  id: 'no-nen',
  char: 'ณ',
  name: 'No Nen',
  romanization: 'n',
  language: 'th',
  type: 'consonant',
  metadata: {
    class: 'low',
    soundClass: 'n',
    romanization: 'n',
  },
};

// ท - Tho Thahan (Low class)
const THO_THAHAN: FoundationalCharacter = {
  id: 'tho-thahan',
  char: 'ท',
  name: 'Tho Thahan',
  romanization: 'th',
  language: 'th',
  type: 'consonant',
  metadata: {
    class: 'low',
    soundClass: 'th',
    romanization: 'th',
  },
};

// ธ - Tho Thong (Low class)
const THO_THONG: FoundationalCharacter = {
  id: 'tho-thong',
  char: 'ธ',
  name: 'Tho Thong',
  romanization: 'th',
  language: 'th',
  type: 'consonant',
  metadata: {
    class: 'low',
    soundClass: 'th',
    romanization: 'th',
  },
};

// พ - Pho Phan (Low class)
const PHO_PHAN: FoundationalCharacter = {
  id: 'pho-phan',
  char: 'พ',
  name: 'Pho Phan',
  romanization: 'ph',
  language: 'th',
  type: 'consonant',
  metadata: {
    class: 'low',
    soundClass: 'ph',
    romanization: 'ph',
  },
};

// ฟ - Fo Fan (Low class)
const FO_FAN: FoundationalCharacter = {
  id: 'fo-fan',
  char: 'ฟ',
  name: 'Fo Fan',
  romanization: 'f',
  language: 'th',
  type: 'consonant',
  metadata: {
    class: 'low',
    soundClass: 'f',
    romanization: 'f',
  },
};

// ภ - Pho Samphao (Low class)
const PHO_SAMPHAO: FoundationalCharacter = {
  id: 'pho-samphao',
  char: 'ภ',
  name: 'Pho Samphao',
  romanization: 'ph',
  language: 'th',
  type: 'consonant',
  metadata: {
    class: 'low',
    soundClass: 'ph',
    romanization: 'ph',
  },
};

// ย - Yo Yak (Low class)
const YO_YAK: FoundationalCharacter = {
  id: 'yo-yak',
  char: 'ย',
  name: 'Yo Yak',
  romanization: 'y',
  language: 'th',
  type: 'consonant',
  metadata: {
    class: 'low',
    soundClass: 'y',
    romanization: 'y',
  },
};

// ร - Ro Ruea (Low class)
const RO_RUEA: FoundationalCharacter = {
  id: 'ro-ruea',
  char: 'ร',
  name: 'Ro Ruea',
  romanization: 'r',
  language: 'th',
  type: 'consonant',
  metadata: {
    class: 'low',
    soundClass: 'r',
    romanization: 'r',
  },
};

// ล - Lo Ling (Low class)
const LO_LING: FoundationalCharacter = {
  id: 'lo-ling',
  char: 'ล',
  name: 'Lo Ling',
  romanization: 'l',
  language: 'th',
  type: 'consonant',
  metadata: {
    class: 'low',
    soundClass: 'l',
    romanization: 'l',
  },
};

// ว - Wo Waen (Low class)
const WO_WAEN: FoundationalCharacter = {
  id: 'wo-waen',
  char: 'ว',
  name: 'Wo Waen',
  romanization: 'w',
  language: 'th',
  type: 'consonant',
  metadata: {
    class: 'low',
    soundClass: 'w',
    romanization: 'w',
  },
};

// ฬ - Lo Chula (Low class)
const LO_CHULA: FoundationalCharacter = {
  id: 'lo-chula',
  char: 'ฬ',
  name: 'Lo Chula',
  romanization: 'l',
  language: 'th',
  type: 'consonant',
  metadata: {
    class: 'low',
    soundClass: 'l',
    romanization: 'l',
  },
};

// ฮ - Ho Nokhuk (Low class)
const HO_NOKHUK: FoundationalCharacter = {
  id: 'ho-nokhuk',
  char: 'ฮ',
  name: 'Ho Nokhuk',
  romanization: 'h',
  language: 'th',
  type: 'consonant',
  metadata: {
    class: 'low',
    soundClass: 'h',
    romanization: 'h',
  },
};

/**
 * Export all consonants (44 total)
 */
export const consonants: FoundationalCharacter[] = [
  // Original 15 consonants
  KO_KAI,
  KHO_KHAI,
  KHO_KHWAI,
  NGO_NGU,
  CHO_CHAN,
  CHO_CHING,
  CHO_CHANG,
  SO_SO,
  DO_DEK,
  TO_TAO,
  BO_BAIMAI,
  PO_PLA,
  NO_NU,
  MO_MA,
  SO_SUA,
  // Remaining mid-class (3)
  DO_CHADA,
  TO_PATAK,
  O_ANG,
  // Remaining high-class (8)
  KHO_KHUAT,
  THO_THAN,
  THO_THUNG,
  PHO_PHUNG,
  FO_FA,
  SO_SALA,
  SO_RUSI,
  HO_HIP,
  // Remaining low-class (18)
  KHO_KHON,
  KHO_RAKHANG,
  CHO_CHOE,
  YO_YING,
  THO_MONTHO,
  THO_PHUTHAO,
  NO_NEN,
  THO_THAHAN,
  THO_THONG,
  PHO_PHAN,
  FO_FAN,
  PHO_SAMPHAO,
  YO_YAK,
  RO_RUEA,
  LO_LING,
  WO_WAEN,
  LO_CHULA,
  HO_NOKHUK,
];

/**
 * Get consonant by ID
 */
export function getConsonantById(id: string): FoundationalCharacter | undefined {
  return consonants.find((c) => c.id === id);
}

/**
 * Get consonant by character
 */
export function getConsonantByChar(char: string): FoundationalCharacter | undefined {
  return consonants.find((c) => c.char === char);
}
