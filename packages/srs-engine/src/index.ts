export type {
  MasteryPhase,
  WordCategory,
  FsrsCardState,
  WordState,
  QuizAnswer,
  SrsConfig,
  QuestionType,
  Question,
  Batch,
} from './types.js'

export { updateMastery } from './mastery.js'
export { composeBatch } from './batch.js'

export type { SpacedRepetitionScheduler } from './scheduling/scheduler.interface.js'
export type { ReviewResult } from './scheduling/types.js'
export { FsrsScheduler } from './scheduling/FsrsScheduler.js'

export type { EligibleWordsResult } from './active-window.js'
export { getEligibleWords } from './active-window.js'

export type { StuckWordsResult } from './stuck-words.js'
export { detectStuckWords, shelveWord, unshelveWord, isShelved } from './stuck-words.js'

export type { FoundationalActiveResult, FoundationalAllocation } from './foundational.js'
export {
  getActiveFoundationalWords,
  applyFoundationalWrongRule,
  getFoundationalAllocation,
} from './foundational.js'

export { SrsEngine } from './srs-engine.js'
