import type { WordState, SrsConfig } from './types.js'

export interface EligibleWordsResult {
  active: WordState[]
  newSlots: number
  eligible: WordState[]
}

/**
 * Returns which words are already in active review, how many new words can be added,
 * and which words are waiting to fill those new slots.
 */
export function getEligibleWords(
  allWords: WordState[],
  config: SrsConfig,
): EligibleWordsResult {
  const active = allWords.filter((w) => w.phase === 'srsM2_review')
  const newSlots = Math.min(
    config.newWordsPerBatch,
    Math.max(0, config.activeWordLimit - active.length),
  )
  const eligible = allWords.filter((w) => w.phase !== 'srsM2_review')

  return { active, newSlots, eligible }
}
