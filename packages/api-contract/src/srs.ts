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

/** Request body for POST /api/answer — the raw answer; the server derives state. */
export interface AnswerRequest {
  wordId: string;
  correct: boolean;
  latencyMs: number;
}

/** Response data for POST /api/answer. */
export interface AnswerResponse {
  wordState: WordStatePayload;   // authoritative post-transition state
  graduated: boolean;            // word crossed the mastery threshold on this answer
}

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

export interface UnshelveWordRequest {
  deckId: string;
  wordId: string;
}

export interface ResetStagnationCountersForWordsRequest {
  deckId: string;
  wordIds: string[];
}
