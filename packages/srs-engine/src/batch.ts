import type { WordState, SrsConfig, Batch, Question } from './types.js'

export interface ComposeBatchOptions {
  audioAvailable?: boolean
}

/**
 * Build a batch of questions from word states following priority order and distribution rules.
 * Priority: carry-over → foundational revision → new words → foundational learning
 *
 * @param wordStates - Array of word states to compose from
 * @param config - SRS configuration with batchSize
 * @param options - Options (e.g., audioAvailable flag for ST02)
 * @returns Batch with ordered questions and distribution breakdown
 */
export function composeBatch(
  wordStates: WordState[],
  config: SrsConfig,
  options?: ComposeBatchOptions
): Batch {
  // Priority 1: Carry-over (curated, srsM2_review)
  const carryOver = wordStates.filter(
    (w): boolean => w.category === 'curated' && w.phase === 'srsM2_review'
  )

  // Priority 2: Foundational revision (foundational, srsM2_review)
  const foundationalRevision = wordStates.filter(
    (w): boolean => w.category === 'foundational' && w.phase === 'srsM2_review'
  )

  // Priority 3: New words (curated, learning)
  const newWords = wordStates.filter(
    (w): boolean => w.category === 'curated' && w.phase === 'learning'
  )

  // Priority 4: Foundational learning (foundational, learning)
  const foundationalLearning = wordStates.filter(
    (w): boolean => w.category === 'foundational' && w.phase === 'learning'
  )

  // Concatenate in priority order and slice to batchSize
  const ordered = [...carryOver, ...foundationalRevision, ...newWords, ...foundationalLearning]
  const batchWordStates = ordered.slice(0, config.batchSize)

  // Create questions (types assigned in ST02)
  const questions: Question[] = batchWordStates.map((wordState): Question => ({
    wordId: wordState.wordId,
    type: 'mc', // Placeholder; ST02 will assign proper distribution
  }))

  return {
    questions,
    batchSize: batchWordStates.length,
    distributionBreakdown: {
      mc: batchWordStates.length,
      wordBlock: 0,
      audio: 0,
    },
  }
}
