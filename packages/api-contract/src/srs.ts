/** Wire-format question types — HTTP-friendly snake_case.
 *  Maps from engine-internal: 'mc' → 'multiple_choice', 'wordBlock' → 'word_block' */
export type QuestionType = 'multiple_choice' | 'word_block' | 'audio';

/** POST /srs/batch — request body */
export interface GetBatchRequest {
  deckId: string;
  size?: number;
}

/** A single question in the batch payload. */
export interface QuizQuestion {
  wordId: string;
  questionType: QuestionType;
  targetText: string;
  choices: Record<string, string>;
}

/** Response payload for POST /srs/batch */
export interface BatchPayload {
  batchId: string;
  questions: QuizQuestion[];
  batchSize: number;
}

/** A single answer submitted by the client. */
export interface QuizAnswer {
  wordId: string;
  selectedKey: string;
}

/** POST /srs/answers — request body */
export interface SubmitAnswersRequest {
  batchId: string;
  answers: QuizAnswer[];
}

/** Response payload for POST /srs/answers */
export interface SubmitAnswersResponse {
  processed: number;
  updatedWords: AnswerResultPayload[];
}

/** Mastery phase visible to clients.
 *  Maps from engine-internal: 'srsM2_review' → 'anki_review' */
export type MasteryPhase = 'learning' | 'anki_review';

/** Per-word result after answers are processed. */
export interface AnswerResultPayload {
  wordId: string;
  submittedKey: string;
  correctKey: string;
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

/** Response payload for POST /srs/seed */
export interface SeedPayload {
  deckId: string;
  seedId?: string;
  wordCount: number;
  phase: MasteryPhase;
}
