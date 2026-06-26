import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const scenariosDir = join(__dirname, '../../../../apps/srs-demo/e2e/fixtures/scenarios');

// All valid word IDs from the two real decks
const DECK_EAT_WORDS = new Set([
  'th::หิว', 'th::แล้ว', 'th::ไป', 'th::กิน', 'th::อะไร',
  'th::กัน', 'th::ดี', 'th::เลย', 'th::อยาก', 'th::ก๋วยเตี๋ยว',
  'th::ไหม', 'th::โอเค',
]);

const DECK_WEATHER_WORDS = new Set([
  'th::วันนี้', 'th::ร้อน', 'th::มาก', 'th::เลย', 'th::ใช่',
  'th::จริงๆ', 'th::ดื่ม', 'th::น้ำ', 'th::ไหม', 'th::ดี',
  'th::อยาก', 'th::เย็น', 'th::ไป', 'th::ซื้อ', 'th::ที่',
  'th::ร้าน', 'th::กัน',
]);

const ALL_VALID_WORDS = new Set([...DECK_EAT_WORDS, ...DECK_WEATHER_WORDS]);

interface ScenarioFixture {
  name: string;
  description: string;
  deckId: string;
  wordStates: Array<{
    wordId: string;
    seen: number;
    correct: number;
    mastery: number;
    correctStreak: number;
    wrongStreak: number;
    lapses: number;
  }>;
  stagnationCounters: Array<{
    wordId: string;
    count: number;
    lastBoundaryMastery: number;
  }>;
  shelvedWords: Array<{
    wordId: string;
    shelvedAtBatch: number;
  }>;
  config?: {
    stagnationBatchWindow?: number;
    maxShelved?: number;
  };
}

const REQUIRED_FIXTURES = [
  'stagnant-word-ready-to-shelve',
  'two-words-shelved-cap-reached',
  'cross-deck-isolation',
  'fresh-session-with-shelved-words',
  'mid-session-stagnation',
];

function loadFixture(name: string): ScenarioFixture {
  const filePath = join(scenariosDir, `${name}.json`);
  const raw = readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as ScenarioFixture;
}

describe('Scenario fixture files', () => {
  for (const fixtureName of REQUIRED_FIXTURES) {
    describe(fixtureName, () => {
      it('exists and is valid JSON', () => {
        expect(() => loadFixture(fixtureName)).not.toThrow();
      });

      it('has required top-level fields', () => {
        const fixture = loadFixture(fixtureName);
        expect(typeof fixture.name).toBe('string');
        expect(typeof fixture.description).toBe('string');
        expect(typeof fixture.deckId).toBe('string');
        expect(Array.isArray(fixture.wordStates)).toBe(true);
        expect(Array.isArray(fixture.stagnationCounters)).toBe(true);
        expect(Array.isArray(fixture.shelvedWords)).toBe(true);
      });

      it('deckId references a real deck', () => {
        const fixture = loadFixture(fixtureName);
        expect(['deck-eat', 'deck-weather']).toContain(fixture.deckId);
      });

      it('wordState entries have all required numeric fields', () => {
        const fixture = loadFixture(fixtureName);
        for (const ws of fixture.wordStates) {
          expect(typeof ws.wordId).toBe('string');
          expect(typeof ws.seen).toBe('number');
          expect(typeof ws.correct).toBe('number');
          expect(typeof ws.mastery).toBe('number');
          expect(typeof ws.correctStreak).toBe('number');
          expect(typeof ws.wrongStreak).toBe('number');
          expect(typeof ws.lapses).toBe('number');
        }
      });

      it('wordState wordIds reference real deck words', () => {
        const fixture = loadFixture(fixtureName);
        for (const ws of fixture.wordStates) {
          expect(ALL_VALID_WORDS.has(ws.wordId), `Unknown wordId "${ws.wordId}"`).toBe(true);
        }
      });

      it('stagnationCounter wordIds reference real deck words', () => {
        const fixture = loadFixture(fixtureName);
        for (const sc of fixture.stagnationCounters) {
          expect(typeof sc.wordId).toBe('string');
          expect(typeof sc.count).toBe('number');
          expect(typeof sc.lastBoundaryMastery).toBe('number');
          expect(ALL_VALID_WORDS.has(sc.wordId), `Unknown wordId "${sc.wordId}"`).toBe(true);
        }
      });

      it('shelvedWord wordIds reference real deck words', () => {
        const fixture = loadFixture(fixtureName);
        for (const sw of fixture.shelvedWords) {
          expect(typeof sw.wordId).toBe('string');
          expect(typeof sw.shelvedAtBatch).toBe('number');
          expect(ALL_VALID_WORDS.has(sw.wordId), `Unknown wordId "${sw.wordId}"`).toBe(true);
        }
      });
    });
  }
});
