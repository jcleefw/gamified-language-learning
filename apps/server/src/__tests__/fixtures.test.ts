import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const scenariosDir = join(__dirname, '../../../../apps/srs-demo/e2e/fixtures/scenarios');

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

      it('deckId is a non-empty string', () => {
        const fixture = loadFixture(fixtureName);
        expect(fixture.deckId.length).toBeGreaterThan(0);
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

      it('wordState wordIds are non-empty strings', () => {
        const fixture = loadFixture(fixtureName);
        for (const ws of fixture.wordStates) {
          expect(ws.wordId.length).toBeGreaterThan(0);
        }
      });

      it('stagnationCounter entries have required fields', () => {
        const fixture = loadFixture(fixtureName);
        for (const sc of fixture.stagnationCounters) {
          expect(typeof sc.wordId).toBe('string');
          expect(sc.wordId.length).toBeGreaterThan(0);
          expect(typeof sc.count).toBe('number');
          expect(typeof sc.lastBoundaryMastery).toBe('number');
        }
      });

      it('shelvedWord entries have required fields', () => {
        const fixture = loadFixture(fixtureName);
        for (const sw of fixture.shelvedWords) {
          expect(typeof sw.wordId).toBe('string');
          expect(sw.wordId.length).toBeGreaterThan(0);
          expect(typeof sw.shelvedAtBatch).toBe('number');
        }
      });
    });
  }
});
