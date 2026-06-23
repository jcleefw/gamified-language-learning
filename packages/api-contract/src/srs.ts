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
