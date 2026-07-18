/** HTTP wire representation of a single word's learning state.
 *  Maps 1:1 with WordState from @gll/srs-engine. */
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
  recheck?: boolean; // true = re-confirmation of a prior miss (seen/correct-only bump). Default false.
}

/** Response data for POST /api/answer. */
export interface AnswerResponse {
  wordState: WordStatePayload;   // authoritative post-transition state
  graduated: boolean;            // word crossed the mastery threshold on this answer
}

/** What was shown for a review answer — a wire fact, not policy.
 *  Mirrors the engine's QuizQuestion.kind so the client reports it as-is. */
export type ReviewQuestionType = 'mcq' | 'word-block';

/** One due review card for GET /api/reviews. `due` is ISO-8601 (JSON has no Date). */
export interface DueReviewItem {
  wordId: string;
  due: string; // ISO-8601
}

/** Response data for GET /api/reviews — pool-global due cards, most-overdue-first. */
export interface DueReviewsResponse {
  reviews: DueReviewItem[];
}

/** Request body for POST /api/reviews/answer — raw answer facts; the server infers the rating.
 *  `latencyMs`/`questionType` are RECORDED, not used for rating in this build. */
export interface ReviewAnswerRequest {
  wordId: string;
  correct: boolean;
  latencyMs: number;
  questionType: ReviewQuestionType;
}

/** Response data for POST /api/reviews/answer.
 *  `advanced` = did this answer move the FSRS schedule? (false ⟺ the card was
 *  not due at answer time → read-only). `due` is the resulting (or unchanged)
 *  schedule date, ISO-8601. */
export interface ReviewAnswerResponse {
  wordId: string;
  due: string; // ISO-8601 (unchanged when advanced === false)
  advanced: boolean; // true only when the card was due and the schedule moved
}

/** Response data for GET /api/reviews/anytime — a bounded, ordered batch over ALL
 *  learned words (due or not). Item shape reuses DueReviewItem (wordId + ISO due). */
export interface AnytimeReviewsResponse {
  reviews: DueReviewItem[]; // ≤50, most-overdue-first with not-due tail least-recently-practised
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
