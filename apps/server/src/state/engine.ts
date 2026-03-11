import { SrsEngine, type SrsConfig } from '@gll/srs-engine';

export const DEFAULT_SRS_CONFIG: SrsConfig = {
  masteryThreshold: { curated: 10, foundational: 5 },
  lapseThreshold: 3,
  batchSize: 15,
  activeWordLimit: 20,
  newWordsPerBatch: 3,
  shelveAfterBatches: 5,
  maxShelved: 50,
  continuousWrongThreshold: 3,
  questionTypeSplit: { mc: 0.6, wordBlock: 0.3, audio: 0.1 },
  foundationalAllocation: { active: 0.2, postDepletion: 0.05 },
  desiredRetention: 0.9,
  maxIntervalDays: 90,
};

let engine = new SrsEngine(DEFAULT_SRS_CONFIG);

export function initEngine(config?: Partial<SrsConfig>): void {
  engine = new SrsEngine({ ...DEFAULT_SRS_CONFIG, ...config });
}

export function getEngine(): SrsEngine {
  return engine;
}
