export type MasteryPhase = 'learning' | 'srsM2_review' | 'mastered';

export type WordCategory = 'curated' | 'foundational';

export interface FsrsCardState {
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  reps: number;
  lapses: number;
  lastReview: Date | null;
}

export interface WordState {
  wordId: string;
  category: WordCategory;
  masteryCount: number;
  phase: MasteryPhase;
  lapseCount: number;
  correctCount: number;
  wrongCount: number;
  fsrsState?: FsrsCardState;
  batchesSinceLastProgress?: number;
  shelvedUntil?: Date | null;
  consecutiveWrongCount?: number;
}

export interface QuizAnswer {
  wordId: string;
  isCorrect: boolean;
}

export interface SrsConfig {
  masteryThreshold: {
    curated: number;
    foundational: number;
  };
  lapseThreshold: number;
  batchSize: number;
  activeWordLimit: number;
  newWordsPerBatch: number;
  shelveAfterBatches: number;
  maxShelved: number;
  continuousWrongThreshold: number;
  questionTypeSplit: {
    mc: number;
    wordBlock: number;
    audio: number;
  };
  foundationalAllocation: {
    active: number;
    postDepletion: number;
  };
  desiredRetention: number;
  maxIntervalDays: number;
  // Words graduate out of the active window after this many correct answers in
  // srsM2_review. Absent = no graduation (original behaviour).
  graduationThreshold?: number;
}

export type QuestionType = 'mc' | 'wordBlock' | 'audio';

export interface Question {
  wordId: string;
  type: QuestionType;
}

export interface Batch {
  questions: Question[];
  batchSize: number;
  distributionBreakdown: {
    mc: number;
    wordBlock: number;
    audio: number;
  };
}
