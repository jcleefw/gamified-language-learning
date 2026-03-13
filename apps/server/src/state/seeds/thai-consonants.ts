import type { WordState } from '@gll/srs-engine';
import type { WordDetail } from '../store.js';

/**
 * Thai consonant foundational deck seed data
 * Maps FoundationalCharacter → WordState + WordDetail
 */

const consonants = [
  { id: 'ko-kai', char: 'ก', name: 'Ko Kai', romanization: 'k' },
  { id: 'kho-khai', char: 'ข', name: 'Kho Khai', romanization: 'kh' },
  { id: 'kho-khwai', char: 'ค', name: 'Kho Khwai', romanization: 'kh' },
  { id: 'ngo-ngu', char: 'ง', name: 'Ngo Ngu', romanization: 'ng' },
  { id: 'cho-chan', char: 'จ', name: 'Cho Chan', romanization: 'ch' },
  { id: 'cho-ching', char: 'ฉ', name: 'Cho Ching', romanization: 'ch' },
  { id: 'cho-chang', char: 'ช', name: 'Cho Chang', romanization: 'ch' },
  { id: 'so-so', char: 'ซ', name: 'So So', romanization: 's' },
  { id: 'do-dek', char: 'ด', name: 'Do Dek', romanization: 'd' },
  { id: 'to-tao', char: 'ต', name: 'To Tao', romanization: 't' },
  { id: 'bo-baimai', char: 'บ', name: 'Bo Baimai', romanization: 'b' },
  { id: 'po-pla', char: 'ป', name: 'Po Pla', romanization: 'p' },
  { id: 'no-nu', char: 'น', name: 'No Nu', romanization: 'n' },
  { id: 'mo-ma', char: 'ม', name: 'Mo Ma', romanization: 'm' },
  { id: 'so-sua', char: 'ส', name: 'So Sua', romanization: 's' },
  { id: 'do-chada', char: 'ฎ', name: 'Do Chada', romanization: 'd' },
  { id: 'to-patak', char: 'ฏ', name: 'To Patak', romanization: 't' },
  { id: 'o-ang', char: 'อ', name: 'O Ang', romanization: '' },
  { id: 'kho-khuat', char: 'ฃ', name: 'Kho Khuat', romanization: 'kh' },
  { id: 'tho-than', char: 'ฐ', name: 'Tho Than', romanization: 'th' },
  { id: 'tho-thung', char: 'ถ', name: 'Tho Thung', romanization: 'th' },
  { id: 'pho-phung', char: 'ผ', name: 'Pho Phung', romanization: 'ph' },
  { id: 'fo-fa', char: 'ฝ', name: 'Fo Fa', romanization: 'f' },
  { id: 'so-sala', char: 'ศ', name: 'So Sala', romanization: 's' },
  { id: 'so-rusi', char: 'ษ', name: 'So Rusi', romanization: 's' },
  { id: 'ho-hip', char: 'ห', name: 'Ho Hip', romanization: 'h' },
  { id: 'kho-khon', char: 'ฅ', name: 'Kho Khon', romanization: 'kh' },
  { id: 'kho-rakhang', char: 'ฆ', name: 'Kho Rakhang', romanization: 'kh' },
  { id: 'cho-choe', char: 'ฌ', name: 'Cho Choe', romanization: 'ch' },
  { id: 'yo-ying', char: 'ญ', name: 'Yo Ying', romanization: 'y' },
  { id: 'tho-montho', char: 'ฑ', name: 'Tho Montho', romanization: 'th' },
  { id: 'tho-phuthao', char: 'ฒ', name: 'Tho Phuthao', romanization: 'th' },
  { id: 'no-nen', char: 'ณ', name: 'No Nen', romanization: 'n' },
  { id: 'tho-thahan', char: 'ท', name: 'Tho Thahan', romanization: 'th' },
  { id: 'tho-thong', char: 'ธ', name: 'Tho Thong', romanization: 'th' },
  { id: 'pho-phan', char: 'พ', name: 'Pho Phan', romanization: 'ph' },
  { id: 'fo-fan', char: 'ฟ', name: 'Fo Fan', romanization: 'f' },
  { id: 'pho-samphao', char: 'ภ', name: 'Pho Samphao', romanization: 'ph' },
  { id: 'yo-yak', char: 'ย', name: 'Yo Yak', romanization: 'y' },
  { id: 'ro-ruea', char: 'ร', name: 'Ro Ruea', romanization: 'r' },
  { id: 'lo-ling', char: 'ล', name: 'Lo Ling', romanization: 'l' },
  { id: 'wo-waen', char: 'ว', name: 'Wo Waen', romanization: 'w' },
  { id: 'lo-chula', char: 'ฬ', name: 'Lo Chula', romanization: 'l' },
  { id: 'ho-nokhuk', char: 'ฮ', name: 'Ho Nokhuk', romanization: 'h' },
];

export function getThaiConsonantsWordStates(): WordState[] {
  return consonants.map((c) => ({
    wordId: c.id,
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
    details.set(c.id, {
      native: c.char,
      romanization: c.romanization,
      english: c.name,
      category: 'foundational',
    });
  });
  return details;
}
