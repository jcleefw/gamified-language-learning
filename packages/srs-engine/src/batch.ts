import type { WordState, SrsConfig, Batch, Question, QuestionType } from './types.js'

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
  const audioAvailable: boolean = options?.audioAvailable !== false

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
  const actualBatchSize = batchWordStates.length

  // Calculate question type slot counts (70% MC, 20% word-block, 10% audio)
  let mcCount = Math.ceil(actualBatchSize * 0.7)
  let wordBlockCount = Math.ceil(actualBatchSize * 0.2)
  let audioCount = actualBatchSize - mcCount - wordBlockCount

  // Redistribute audio slots to MC if audio unavailable
  if (!audioAvailable) {
    mcCount += audioCount
    audioCount = 0
  }

  // Create question type assignments (round-robin: mc, wordBlock, audio, mc, wordBlock, audio, ...)
  const typeAssignments: QuestionType[] = []
  let mcAssigned = 0
  let wordBlockAssigned = 0
  let audioAssigned = 0

  for (let i = 0; i < actualBatchSize; i++) {
    // Try to assign in order: MC, word-block, audio
    if (mcAssigned < mcCount) {
      typeAssignments.push('mc')
      mcAssigned++
    } else if (wordBlockAssigned < wordBlockCount) {
      typeAssignments.push('wordBlock')
      wordBlockAssigned++
    } else if (audioAssigned < audioCount) {
      typeAssignments.push('audio')
      audioAssigned++
    }
  }

  // Create questions with assigned types
  const questions: Question[] = batchWordStates.map((wordState, index): Question => ({
    wordId: wordState.wordId,
    type: typeAssignments[index]!,
  }))

  return {
    questions,
    batchSize: actualBatchSize,
    distributionBreakdown: {
      mc: mcCount,
      wordBlock: wordBlockCount,
      audio: audioCount,
    },
  }
}
