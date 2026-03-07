import type { WordState, SrsConfig } from './types.js'

export interface FoundationalActiveResult {
  active: WordState[]
  availableSlots: number
  eligible: WordState[]
}

const FOUNDATIONAL_ACTIVE_LIMIT = 3

export function getActiveFoundationalWords(
  words: WordState[],
  _config: SrsConfig,
): FoundationalActiveResult {
  const active = words.filter(
    (word) => word.category === 'foundational' && word.phase === 'learning',
  )
  const availableSlots = Math.max(0, FOUNDATIONAL_ACTIVE_LIMIT - active.length)
  const eligible = words.filter(
    (word) => word.category === 'foundational' && word.phase !== 'learning',
  )

  return { active, availableSlots, eligible }
}

export interface FoundationalAllocation {
  slots: number
  poolDepleted: boolean
}

export function getFoundationalAllocation(
  totalBatchSize: number,
  foundationalWords: WordState[],
  config: SrsConfig,
): FoundationalAllocation {
  const poolDepleted =
    foundationalWords.length === 0 ||
    foundationalWords.every(
      (word) => word.masteryCount >= config.masteryThreshold.foundational,
    )

  const rate = poolDepleted
    ? config.foundationalAllocation.postDepletion
    : config.foundationalAllocation.active

  return {
    slots: Math.round(totalBatchSize * rate),
    poolDepleted,
  }
}

export function applyFoundationalWrongRule(
  wordState: WordState,
  config: SrsConfig,
): WordState {
  if (wordState.category !== 'foundational') {
    return wordState
  }

  const newConsecutiveWrongCount = (wordState.consecutiveWrongCount ?? 0) + 1

  if (newConsecutiveWrongCount >= config.continuousWrongThreshold) {
    return {
      ...wordState,
      masteryCount: 0,
      consecutiveWrongCount: 0,
      phase: 'learning',
    }
  }

  return {
    ...wordState,
    consecutiveWrongCount: newConsecutiveWrongCount,
  }
}
