export type MasteryPhase = 'learning' | 'anki_review'

export type WordCategory = 'curated' | 'foundational'

export interface FsrsCardState {
  stability: number
  difficulty: number
  elapsedDays: number
  scheduledDays: number
  reps: number
  lapses: number
  lastReview: Date | null
}

export interface WordState {
  wordId: string
  category: WordCategory
  masteryCount: number
  phase: MasteryPhase
  lapseCount: number
  correctCount: number
  wrongCount: number
  fsrsState?: FsrsCardState
}

export interface QuizAnswer {
  wordId: string
  isCorrect: boolean
}

export interface SrsConfig {
  masteryThreshold: {
    curated: number
    foundational: number
  }
  lapseThreshold: number
  batchSize: number
  activeWordLimit: number
  newWordsPerBatch: number
  shelveAfterBatches: number
  maxShelved: number
  continuousWrongThreshold: number
  questionTypeSplit: {
    mc: number
    wordBlock: number
    audio: number
  }
  foundationalAllocation: {
    active: number
    postDepletion: number
  }
  desiredRetention: number
  maxIntervalDays: number
}
