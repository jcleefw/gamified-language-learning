/** Wire-format question types — HTTP-friendly snake_case.
 *  Maps from engine-internal: 'mc' → 'multiple_choice', 'wordBlock' → 'word_block' */
export type QuestionType = 'multiple_choice' | 'word_block' | 'audio';

/** GET /srs/batch — query parameters */
export interface GetBatchRequest {
  /** Number of questions to include in the batch. */
  size?: number;
}

/** A single question in the batch payload. */
export interface QuizQuestion {
  wordId: string;
  questionType: QuestionType;
}

/** Response payload for GET /srs/batch */
export interface BatchPayload {
  questions: QuizQuestion[];
  batchSize: number;
}

/** A single answer submitted by the client. */
export interface QuizAnswer {
  wordId: string;
  /** true = correct, false = incorrect */
  correct: boolean;
}

/** POST /srs/answers — request body */
export interface SubmitAnswersRequest {
  answers: QuizAnswer[];
}

/** Mastery phase visible to clients.
 *  Maps from engine-internal: 'srsM2_review' → 'anki_review' */
export type MasteryPhase = 'learning' | 'anki_review';

/** Per-word result after answers are processed. */
export interface AnswerResultPayload {
  wordId: string;
  correct: boolean;
  masteryCount: number;
  phase: MasteryPhase;
}

/** Summary of a single word's mastery state — used in batch result responses. */
export interface WordMasterySummary {
  wordId: string;
  masteryCount: number;
  phase: MasteryPhase;
}
