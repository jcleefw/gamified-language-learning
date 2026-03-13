import type { WordState } from '@gll/srs-engine';
import type { WordDetail } from '../store.js';

/**
 * Thai consonant foundational deck seed data
 * Maps FoundationalCharacter → WordState + WordDetail
 */

const consonants = [
  { id: 'ko-kai', char: 'ก', romanization: 'Ko Kai', english: 'k' },
  { id: 'kho-khai', char: 'ข', romanization: 'Kho Khai', english: 'kh' },
  { id: 'kho-khwai', char: 'ค', romanization: 'Kho Khwai', english: 'kh' },
  { id: 'ngo-ngu', char: 'ง', romanization: 'Ngo Ngu', english: 'ng' },
  { id: 'cho-chan', char: 'จ', romanization: 'Cho Chan', english: 'ch' },
  { id: 'cho-ching', char: 'ฉ', romanization: 'Cho Ching', english: 'ch' },
  { id: 'cho-chang', char: 'ช', romanization: 'Cho Chang', english: 'ch' },
  { id: 'so-so', char: 'ซ', romanization: 'So So', english: 's' },
  { id: 'do-dek', char: 'ด', romanization: 'Do Dek', english: 'd' },
  { id: 'to-tao', char: 'ต', romanization: 'To Tao', english: 't' },
  { id: 'bo-baimai', char: 'บ', romanization: 'Bo Baimai', english: 'b' },
  { id: 'po-pla', char: 'ป', romanization: 'Po Pla', english: 'p' },
  { id: 'no-nu', char: 'น', romanization: 'No Nu', english: 'n' },
  { id: 'mo-ma', char: 'ม', romanization: 'Mo Ma', english: 'm' },
  { id: 'so-sua', char: 'ส', romanization: 'So Sua', english: 's' },
  { id: 'do-chada', char: 'ฎ', romanization: 'Do Chada', english: 'd' },
  { id: 'to-patak', char: 'ฏ', romanization: 'To Patak', english: 't' },
  { id: 'o-ang', char: 'อ', romanization: 'O Ang', english: '' },
  { id: 'kho-khuat', char: 'ฃ', romanization: 'Kho Khuat', english: 'kh' },
  { id: 'tho-than', char: 'ฐ', romanization: 'Tho Than', english: 'th' },
  { id: 'tho-thung', char: 'ถ', romanization: 'Tho Thung', english: 'th' },
  { id: 'pho-phung', char: 'ผ', romanization: 'Pho Phung', english: 'ph' },
  { id: 'fo-fa', char: 'ฝ', romanization: 'Fo Fa', english: 'f' },
  { id: 'so-sala', char: 'ศ', romanization: 'So Sala', english: 's' },
  { id: 'so-rusi', char: 'ษ', romanization: 'So Rusi', english: 's' },
  { id: 'ho-hip', char: 'ห', romanization: 'Ho Hip', english: 'h' },
  { id: 'kho-khon', char: 'ฅ', romanization: 'Kho Khon', english: 'kh' },
  { id: 'kho-rakhang', char: 'ฆ', romanization: 'Kho Rakhang', english: 'kh' },
  { id: 'cho-choe', char: 'ฌ', romanization: 'Cho Choe', english: 'ch' },
  { id: 'yo-ying', char: 'ญ', romanization: 'Yo Ying', english: 'y' },
  { id: 'tho-montho', char: 'ฑ', romanization: 'Tho Montho', english: 'th' },
  { id: 'tho-phuthao', char: 'ฒ', romanization: 'Tho Phuthao', english: 'th' },
  { id: 'no-nen', char: 'ณ', romanization: 'No Nen', english: 'n' },
  { id: 'tho-thahan', char: 'ท', romanization: 'Tho Thahan', english: 'th' },
  { id: 'tho-thong', char: 'ธ', romanization: 'Tho Thong', english: 'th' },
  { id: 'pho-phan', char: 'พ', romanization: 'Pho Phan', english: 'ph' },
  { id: 'fo-fan', char: 'ฟ', romanization: 'Fo Fan', english: 'f' },
  { id: 'pho-samphao', char: 'ภ', romanization: 'Pho Samphao', english: 'ph' },
  { id: 'yo-yak', char: 'ย', romanization: 'Yo Yak', english: 'y' },
  { id: 'ro-ruea', char: 'ร', romanization: 'Ro Ruea', english: 'r' },
  { id: 'lo-ling', char: 'ล', romanization: 'Lo Ling', english: 'l' },
  { id: 'wo-waen', char: 'ว', romanization: 'Wo Waen', english: 'w' },
  { id: 'lo-chula', char: 'ฬ', romanization: 'Lo Chula', english: 'l' },
  { id: 'ho-nokhuk', char: 'ฮ', romanization: 'Ho Nokhuk', english: 'h' },
];

export function getThaiConsonantsWordStates(): WordState[] {
  return consonants.map((c) => ({
    wordId: `foundational:${c.id}`,
    category: 'foundational' as const,
    masteryCount: 0,
    phase: 'learning' as const,
    lapseCount: 0,
    correctCount: 0,
    wrongCount: 0,
  }));
}

export function getThaiConsonantsWordDetails(): Map<string, WordDetail> {
  const details = new Map<string, WordDetail>();
  consonants.forEach((c) => {
    details.set(`foundational:${c.id}`, {
      native: c.char,
      romanization: c.romanization,
      english: c.english,
      category: 'foundational',
    });
  });
  return details;
}
