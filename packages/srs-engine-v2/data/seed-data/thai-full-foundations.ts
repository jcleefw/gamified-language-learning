import type { ThaiConsonant, ThaiTone, ThaiVowel } from '../../src/types/foundational.js';

export const thaiConsonants: ThaiConsonant[] = [
  // MIDDLE CLASS
  { id: 'th:consonant:ก', foundationalType: 'consonant', native: 'ก', romanization: 'Go Gai', english: 'g', class: 'middle', language: 'th' },
  { id: 'th:consonant:จ', foundationalType: 'consonant', native: 'จ', romanization: 'Cho Chan', english: 'ch', class: 'middle', language: 'th' },
  { id: 'th:consonant:ฎ', foundationalType: 'consonant', native: 'ฎ', romanization: 'Do Cha-da', english: 'd', class: 'middle', language: 'th' },
  { id: 'th:consonant:ฏ', foundationalType: 'consonant', native: 'ฏ', romanization: 'To Pa-tak', english: 't', class: 'middle', language: 'th' },
  { id: 'th:consonant:ด', foundationalType: 'consonant', native: 'ด', romanization: 'Do Dek', english: 'd', class: 'middle', language: 'th' },
  { id: 'th:consonant:ต', foundationalType: 'consonant', native: 'ต', romanization: 'To Tao', english: 't', class: 'middle', language: 'th' },
  { id: 'th:consonant:บ', foundationalType: 'consonant', native: 'บ', romanization: 'Bo Baimai', english: 'b', class: 'middle', language: 'th' },
  { id: 'th:consonant:ป', foundationalType: 'consonant', native: 'ป', romanization: 'Po Pla', english: 'p', class: 'middle', language: 'th' },
  { id: 'th:consonant:อ', foundationalType: 'consonant', native: 'อ', romanization: 'O Ang', english: 'o', class: 'middle', language: 'th' },

  // HIGH CLASS
  { id: 'th:consonant:ข', foundationalType: 'consonant', native: 'ข', romanization: 'Kho Khai', english: 'kh', class: 'high', language: 'th' },
  { id: 'th:consonant:ฃ', foundationalType: 'consonant', native: 'ฃ', romanization: 'Kho Khuat', english: 'kh', class: 'high', language: 'th' },
  { id: 'th:consonant:ฉ', foundationalType: 'consonant', native: 'ฉ', romanization: 'Cho Ching', english: 'ch', class: 'high', language: 'th' },
  { id: 'th:consonant:ฐ', foundationalType: 'consonant', native: 'ฐ', romanization: 'Tho Than', english: 'th', class: 'high', language: 'th' },
  { id: 'th:consonant:ถ', foundationalType: 'consonant', native: 'ถ', romanization: 'Tho Thung', english: 'th', class: 'high', language: 'th' },
  { id: 'th:consonant:ผ', foundationalType: 'consonant', native: 'ผ', romanization: 'Pho Phueng', english: 'ph', class: 'high', language: 'th' },
  { id: 'th:consonant:ฝ', foundationalType: 'consonant', native: 'ฝ', romanization: 'Fo Fa', english: 'f', class: 'high', language: 'th' },
  { id: 'th:consonant:ศ', foundationalType: 'consonant', native: 'ศ', romanization: 'So Sala', english: 's', class: 'high', language: 'th' },
  { id: 'th:consonant:ษ', foundationalType: 'consonant', native: 'ษ', romanization: 'So Rue-si', english: 's', class: 'high', language: 'th' },
  { id: 'th:consonant:ส', foundationalType: 'consonant', native: 'ส', romanization: 'So Suea', english: 's', class: 'high', language: 'th' },
  { id: 'th:consonant:ห', foundationalType: 'consonant', native: 'ห', romanization: 'Ho Hip', english: 'h', class: 'high', language: 'th' },

  // LOW CLASS
  { id: 'th:consonant:ค', foundationalType: 'consonant', native: 'ค', romanization: 'Kho Khwai', english: 'kh', class: 'low', language: 'th' },
  { id: 'th:consonant:ฅ', foundationalType: 'consonant', native: 'ฅ', romanization: 'Kho Khon', english: 'kh', class: 'low', language: 'th' },
  { id: 'th:consonant:ฆ', foundationalType: 'consonant', native: 'ฆ', romanization: 'Kho Rakhang', english: 'kh', class: 'low', language: 'th' },
  { id: 'th:consonant:ง', foundationalType: 'consonant', native: 'ง', romanization: 'Ngo Ngu', english: 'ng', class: 'low', language: 'th' },
  { id: 'th:consonant:ช', foundationalType: 'consonant', native: 'ช', romanization: 'Cho Chang', english: 'ch', class: 'low', language: 'th' },
  { id: 'th:consonant:ซ', foundationalType: 'consonant', native: 'ซ', romanization: 'So So', english: 's', class: 'low', language: 'th' },
  { id: 'th:consonant:ฌ', foundationalType: 'consonant', native: 'ฌ', romanization: 'Cho Koeu', english: 'ch', class: 'low', language: 'th' },
  { id: 'th:consonant:ญ', foundationalType: 'consonant', native: 'ญ', romanization: 'Yo Ying', english: 'y', class: 'low', language: 'th' },
  { id: 'th:consonant:ฑ', foundationalType: 'consonant', native: 'ฑ', romanization: 'Tho Montho', english: 'th', class: 'low', language: 'th' },
  { id: 'th:consonant:ฒ', foundationalType: 'consonant', native: 'ฒ', romanization: 'Tho Phu-thao', english: 'th', class: 'low', language: 'th' },
  { id: 'th:consonant:ณ', foundationalType: 'consonant', native: 'ณ', romanization: 'No Nen', english: 'n', class: 'low', language: 'th' },
  { id: 'th:consonant:ท', foundationalType: 'consonant', native: 'ท', romanization: 'Tho Thahan', english: 'th', class: 'low', language: 'th' },
  { id: 'th:consonant:ธ', foundationalType: 'consonant', native: 'ธ', romanization: 'Tho Thong', english: 'th', class: 'low', language: 'th' },
  { id: 'th:consonant:น', foundationalType: 'consonant', native: 'น', romanization: 'No Nu', english: 'n', class: 'low', language: 'th' },
  { id: 'th:consonant:พ', foundationalType: 'consonant', native: 'พ', romanization: 'Pho Phan', english: 'ph', class: 'low', language: 'th' },
  { id: 'th:consonant:ฟ', foundationalType: 'consonant', native: 'ฟ', romanization: 'Fo Fan', english: 'f', class: 'low', language: 'th' },
  { id: 'th:consonant:ภ', foundationalType: 'consonant', native: 'ภ', romanization: 'Pho Sam-phao', english: 'ph', class: 'low', language: 'th' },
  { id: 'th:consonant:ม', foundationalType: 'consonant', native: 'ม', romanization: 'Mo Ma', english: 'm', class: 'low', language: 'th' },
  { id: 'th:consonant:ย', foundationalType: 'consonant', native: 'ย', romanization: 'Yo Yak', english: 'y', class: 'low', language: 'th' },
  { id: 'th:consonant:ร', foundationalType: 'consonant', native: 'ร', romanization: 'Ro Ruea', english: 'r', class: 'low', language: 'th' },
  { id: 'th:consonant:ล', foundationalType: 'consonant', native: 'ล', romanization: 'Lo Ling', english: 'l', class: 'low', language: 'th' },
  { id: 'th:consonant:ว', foundationalType: 'consonant', native: 'ว', romanization: 'Wo Waen', english: 'w', class: 'low', language: 'th' },
  { id: 'th:consonant:ฬ', foundationalType: 'consonant', native: 'ฬ', romanization: 'Lo Chu-la', english: 'l', class: 'low', language: 'th' },
  { id: 'th:consonant:ฮ', foundationalType: 'consonant', native: 'ฮ', romanization: 'Ho Nok-huk', english: 'h', class: 'low', language: 'th' }
];

export const thaiVowels: ThaiVowel[] = [
  // --- SHORT VOWELS ---
  { id: 'th:vowel:a_s', foundationalType: 'vowel', native: 'ะ', romanization: 'Sara A', english: 'a', position: 'trailing', length: 'short', language: 'th' },
  { id: 'th:vowel:i_s', foundationalType: 'vowel', native: 'ิ', romanization: 'Sara I', english: 'i', position: 'surrounding', length: 'short', language: 'th' },
  { id: 'th:vowel:ue_s', foundationalType: 'vowel', native: 'ึ', romanization: 'Sara Ue', english: 'ue', position: 'surrounding', length: 'short', language: 'th' },
  { id: 'th:vowel:u_s', foundationalType: 'vowel', native: 'ุ', romanization: 'Sara U', english: 'u', position: 'surrounding', length: 'short', language: 'th' },
  { id: 'th:vowel:e_s', foundationalType: 'vowel', native: 'เ-ะ', romanization: 'Sara E', english: 'e', position: 'surrounding', length: 'short', language: 'th' },
  { id: 'th:vowel:ae_s', foundationalType: 'vowel', native: 'แ-ะ', romanization: 'Sara Ae', english: 'ae', position: 'surrounding', length: 'short', language: 'th' },
  { id: 'th:vowel:o_s', foundationalType: 'vowel', native: 'โ-ะ', romanization: 'Sara O', english: 'o', position: 'surrounding', length: 'short', language: 'th' },
  { id: 'th:vowel:aw_s', foundationalType: 'vowel', native: 'เ-าะ', romanization: 'Sara Aw', english: 'aw', position: 'surrounding', length: 'short', language: 'th' },
  { id: 'th:vowel:oe_s', foundationalType: 'vowel', native: 'เ-อะ', romanization: 'Sara Oe', english: 'oe', position: 'surrounding', length: 'short', language: 'th' },

  // --- LONG VOWELS ---
  { id: 'th:vowel:aa_l', foundationalType: 'vowel', native: 'า', romanization: 'Sara Aa', english: 'aa', position: 'trailing', length: 'long', language: 'th' },
  { id: 'th:vowel:ii_l', foundationalType: 'vowel', native: 'ี', romanization: 'Sara Ii', english: 'ii', position: 'surrounding', length: 'long', language: 'th' },
  { id: 'th:vowel:uee_l', foundationalType: 'vowel', native: 'ื', romanization: 'Sara Uee', english: 'uee', position: 'surrounding', length: 'long', language: 'th' },
  { id: 'th:vowel:uu_l', foundationalType: 'vowel', native: 'ู', romanization: 'Sara Uu', english: 'uu', position: 'surrounding', length: 'long', language: 'th' },
  { id: 'th:vowel:ee_l', foundationalType: 'vowel', native: 'เ', romanization: 'Sara Ee', english: 'ee', position: 'leading', length: 'long', language: 'th' },
  { id: 'th:vowel:aee_l', foundationalType: 'vowel', native: 'แ', romanization: 'Sara Aee', english: 'aee', position: 'leading', length: 'long', language: 'th' },
  { id: 'th:vowel:oo_l', foundationalType: 'vowel', native: 'โ', romanization: 'Sara Oo', english: 'oo', position: 'leading', length: 'long', language: 'th' },
  { id: 'th:vowel:aww_l', foundationalType: 'vowel', native: 'อ', romanization: 'Sara Aw', english: 'aw', position: 'trailing', length: 'long', language: 'th' },
  { id: 'th:vowel:oee_l', foundationalType: 'vowel', native: 'เ-อ', romanization: 'Sara Oe', english: 'oe', position: 'surrounding', length: 'long', language: 'th' },

  // --- DIPHTHONGS (Compound Vowels) ---
  { id: 'th:vowel:ia_s', foundationalType: 'vowel', native: 'เ-ียะ', romanization: 'Sara Ia', english: 'ia', position: 'surrounding', length: 'short', language: 'th' },
  { id: 'th:vowel:ia_l', foundationalType: 'vowel', native: 'เ-ีย', romanization: 'Sara Iia', english: 'iia', position: 'surrounding', length: 'long', language: 'th' },
  { id: 'th:vowel:uea_s', foundationalType: 'vowel', native: 'เ-ือะ', romanization: 'Sara Uea', english: 'uea', position: 'surrounding', length: 'short', language: 'th' },
  { id: 'th:vowel:uea_l', foundationalType: 'vowel', native: 'เ-ือ', romanization: 'Sara Ueea', english: 'ueea', position: 'surrounding', length: 'long', language: 'th' },
  { id: 'th:vowel:ua_s', foundationalType: 'vowel', native: 'ัวะ', romanization: 'Sara Ua', english: 'ua', position: 'surrounding', length: 'short', language: 'th' },
  { id: 'th:vowel:ua_l', foundationalType: 'vowel', native: 'ัว', romanization: 'Sara Uua', english: 'uua', position: 'surrounding', length: 'long', language: 'th' },

  // --- SPECIAL / EXTRA VOWELS (Usually Short) ---
  { id: 'th:vowel:am', foundationalType: 'vowel', native: 'ำ', romanization: 'Sara Am', english: 'am', position: 'surrounding', length: 'short', language: 'th' },
  { id: 'th:vowel:ai_m', foundationalType: 'vowel', native: 'ใ', romanization: 'Sara Ai Mai-muan', english: 'ai', position: 'leading', length: 'short', language: 'th' },
  { id: 'th:vowel:ai_l', foundationalType: 'vowel', native: 'ไ', romanization: 'Sara Ai Mai-malay', english: 'ai', position: 'leading', length: 'short', language: 'th' },
  { id: 'th:vowel:au', foundationalType: 'vowel', native: 'เ-า', romanization: 'Sara Au', english: 'au', position: 'surrounding', length: 'short', language: 'th' }
];

export const thaiTones: ThaiTone[] = [
  { id: 'th:tone:low', foundationalType: 'tone', native: '่', romanization: 'mai ek', english: 'low tone', language: 'th' },
  { id: 'th:tone:falling', foundationalType: 'tone', native: '้', romanization: 'mai tho', english: 'falling tone', language: 'th' },
  { id: 'th:tone:high', foundationalType: 'tone', native: '๊', romanization: 'mai tri', english: 'high tone', language: 'th' },
  { id: 'th:tone:rising', foundationalType: 'tone', native: '๋', romanization: 'mai chattawa', english: 'rising tone', language: 'th' },
  { id: 'th:tone:mid', foundationalType: 'tone', native: '-', romanization: 'mid tone', english: 'mid tone', language: 'th' },
];