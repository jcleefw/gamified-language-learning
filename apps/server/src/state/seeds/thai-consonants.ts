import type { WordState } from '@gll/srs-engine';
import type { WordDetail } from '../store.js';

/**
 * Thai consonant foundational deck seed data
 * Maps FoundationalCharacter → WordState + WordDetail
 */

const consonants = [
  { id: 'ko-kai', native: 'ก', romanization: 'Ko Kai', english: 'k', language: 'th' },
  { id: 'kho-khai', native: 'ข', romanization: 'Kho Khai', english: 'kh', language: 'th' },
  { id: 'kho-khwai', native: 'ค', romanization: 'Kho Khwai', english: 'kh', language: 'th' },
  { id: 'ngo-ngu', native: 'ง', romanization: 'Ngo Ngu', english: 'ng', language: 'th' },
  { id: 'cho-chan', native: 'จ', romanization: 'Cho Chan', english: 'ch', language: 'th' },
  { id: 'cho-ching', native: 'ฉ', romanization: 'Cho Ching', english: 'ch', language: 'th' },
  { id: 'cho-chang', native: 'ช', romanization: 'Cho Chang', english: 'ch', language: 'th' },
  { id: 'so-so', native: 'ซ', romanization: 'So So', english: 's', language: 'th' },
  { id: 'do-dek', native: 'ด', romanization: 'Do Dek', english: 'd', language: 'th' },
  { id: 'to-tao', native: 'ต', romanization: 'To Tao', english: 't', language: 'th' },
  { id: 'bo-baimai', native: 'บ', romanization: 'Bo Baimai', english: 'b', language: 'th' },
  { id: 'po-pla', native: 'ป', romanization: 'Po Pla', english: 'p', language: 'th' },
  { id: 'no-nu', native: 'น', romanization: 'No Nu', english: 'n', language: 'th' },
  { id: 'mo-ma', native: 'ม', romanization: 'Mo Ma', english: 'm', language: 'th' },
  { id: 'so-sua', native: 'ส', romanization: 'So Sua', english: 's', language: 'th' },
  { id: 'do-chada', native: 'ฎ', romanization: 'Do Chada', english: 'd', language: 'th' },
  { id: 'to-patak', native: 'ฏ', romanization: 'To Patak', english: 't', language: 'th' },
  { id: 'o-ang', native: 'อ', romanization: 'O Ang', english: '', language: 'th' },
  { id: 'kho-khuat', native: 'ฃ', romanization: 'Kho Khuat', english: 'kh', language: 'th' },
  { id: 'tho-than', native: 'ฐ', romanization: 'Tho Than', english: 'th', language: 'th' },
  { id: 'tho-thung', native: 'ถ', romanization: 'Tho Thung', english: 'th', language: 'th' },
  { id: 'pho-phung', native: 'ผ', romanization: 'Pho Phung', english: 'ph', language: 'th' },
  { id: 'fo-fa', native: 'ฝ', romanization: 'Fo Fa', english: 'f', language: 'th' },
  { id: 'so-sala', native: 'ศ', romanization: 'So Sala', english: 's', language: 'th' },
  { id: 'so-rusi', native: 'ษ', romanization: 'So Rusi', english: 's', language: 'th' },
  { id: 'ho-hip', native: 'ห', romanization: 'Ho Hip', english: 'h', language: 'th' },
  { id: 'kho-khon', native: 'ฅ', romanization: 'Kho Khon', english: 'kh', language: 'th' },
  { id: 'kho-rakhang', native: 'ฆ', romanization: 'Kho Rakhang', english: 'kh', language: 'th' },
  { id: 'cho-choe', native: 'ฌ', romanization: 'Cho Choe', english: 'ch', language: 'th' },
  { id: 'yo-ying', native: 'ญ', romanization: 'Yo Ying', english: 'y', language: 'th' },
  { id: 'tho-montho', native: 'ฑ', romanization: 'Tho Montho', english: 'th', language: 'th' },
  { id: 'tho-phuthao', native: 'ฒ', romanization: 'Tho Phuthao', english: 'th', language: 'th' },
  { id: 'no-nen', native: 'ณ', romanization: 'No Nen', english: 'n', language: 'th' },
  { id: 'tho-thahan', native: 'ท', romanization: 'Tho Thahan', english: 'th', language: 'th' },
  { id: 'tho-thong', native: 'ธ', romanization: 'Tho Thong', english: 'th', language: 'th' },
  { id: 'pho-phan', native: 'พ', romanization: 'Pho Phan', english: 'ph', language: 'th' },
  { id: 'fo-fan', native: 'ฟ', romanization: 'Fo Fan', english: 'f', language: 'th' },
  { id: 'pho-samphao', native: 'ภ', romanization: 'Pho Samphao', english: 'ph', language: 'th' },
  { id: 'yo-yak', native: 'ย', romanization: 'Yo Yak', english: 'y', language: 'th' },
  { id: 'ro-ruea', native: 'ร', romanization: 'Ro Ruea', english: 'r', language: 'th' },
  { id: 'lo-ling', native: 'ล', romanization: 'Lo Ling', english: 'l', language: 'th' },
  { id: 'wo-waen', native: 'ว', romanization: 'Wo Waen', english: 'w', language: 'th' },
  { id: 'lo-chula', native: 'ฬ', romanization: 'Lo Chula', english: 'l', language: 'th' },
  { id: 'ho-nokhuk', native: 'ฮ', romanization: 'Ho Nokhuk', english: 'h', language: 'th' },
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
      native: c.native,
      romanization: c.romanization,
      english: c.english,
      category: 'foundational',
    });
  });
  return details;
}
