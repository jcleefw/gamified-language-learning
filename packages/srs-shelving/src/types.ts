export interface ShelvingConfig {
  stagnationBatchWindow: number; // number of consecutive batches with no mastery progress before shelving
  maxShelved: number;            // max words that can be shelved simultaneously
}

export const DEFAULT_SHELVING_CONFIG: ShelvingConfig = {
  stagnationBatchWindow: 3,
  maxShelved: 2,
};

export interface ShelvedWord {
  wordId: string;
  shelvedAtBatch: number;
}

export interface ShelvingDecision {
  toShelve: string[];   // word IDs to shelve
  toUnshelve: string[]; // word IDs to unshelve
}
