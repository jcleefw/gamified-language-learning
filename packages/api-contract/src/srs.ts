/** HTTP wire representation of a single word's learning state.
 *  Maps 1:1 with WordState from @gll/srs-engine-v2. */
export interface WordStatePayload {
  wordId: string;
  seen: number;
  correct: number;
  mastery: number;
  correctStreak: number;
  wrongStreak: number;
  lapses: number;
}

/** Response body for GET /api/state */
export interface GetStateResponse {
  words: WordStatePayload[];
}

/** Request body for POST /api/state/word */
export type UpsertWordStateRequest = WordStatePayload;

export interface ShelvedWordPayload {
  wordId: string;
  shelvedAtBatch: number;
}

export type GetShelvedWordsResponse = ShelvedWordPayload[];

export interface ApplyShelvingRequest {
  deckId: string;
  toShelve: Array<{ wordId: string; batchNum: number }>;
}

export interface UnshelveAllRequest {
  deckId: string;
}

export interface UpdateStagnationCountersRequest {
  deckId: string;
  activeWordIds: string[];
}

export interface GetStagnantWordsResponse {
  stagnantWordIds: string[];
}

export interface ResetStagnationCountersRequest {
  deckId: string;
}
