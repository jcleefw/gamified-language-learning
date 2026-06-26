import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface ScenarioFixture {
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

export type ScenarioName =
  | 'mid-session-stagnation'
  | 'stagnant-word-ready-to-shelve'
  | 'two-words-shelved-cap-reached'
  | 'cross-deck-isolation'
  | 'fresh-session-with-shelved-words';

export function loadScenario(name: ScenarioName): ScenarioFixture {
  const filePath = join(__dirname, 'scenarios', `${name}.json`);
  const raw = readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as ScenarioFixture;
}
