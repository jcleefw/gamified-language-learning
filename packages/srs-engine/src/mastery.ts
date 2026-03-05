import type { WordState, SrsConfig } from './types.js'

export function updateMastery(
  state: WordState,
  isCorrect: boolean,
  config: SrsConfig,
): WordState {
  const masteryThreshold = config.masteryThreshold[state.category]

  if (state.phase === 'srsM2_review') {
    if (!isCorrect) {
      const newLapseCount = state.lapseCount + 1
      if (newLapseCount >= config.lapseThreshold) {
        return {
          ...state,
          wrongCount: state.wrongCount + 1,
          lapseCount: 0,
          masteryCount: 0,
          phase: 'learning',
        }
      }
      return {
        ...state,
        wrongCount: state.wrongCount + 1,
        lapseCount: newLapseCount,
      }
    }
    return {
      ...state,
      correctCount: state.correctCount + 1,
      masteryCount: state.masteryCount + 1,
    }
  }

  // learning phase
  if (isCorrect) {
    const newMasteryCount = state.masteryCount + 1
    const transitionsToReview = newMasteryCount >= masteryThreshold
    return {
      ...state,
      correctCount: state.correctCount + 1,
      masteryCount: newMasteryCount,
      phase: transitionsToReview ? 'srsM2_review' : 'learning',
    }
  }

  return {
    ...state,
    wrongCount: state.wrongCount + 1,
    masteryCount: Math.max(0, state.masteryCount - 1),
  }
}
