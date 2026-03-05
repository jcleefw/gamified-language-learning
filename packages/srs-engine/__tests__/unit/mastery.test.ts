import { describe, it, expect } from 'vitest'
import { updateMastery } from '../../src/mastery.js'
import type { WordState, SrsConfig } from '../../src/types.js'

const baseConfig: SrsConfig = {
  masteryThreshold: { curated: 10, foundational: 5 },
  lapseThreshold: 3,
  batchSize: 10,
  activeWordLimit: 20,
  newWordsPerBatch: 3,
  shelveAfterBatches: 3,
  maxShelved: 50,
  continuousWrongThreshold: 3,
  questionTypeSplit: { mc: 60, wordBlock: 30, audio: 10 },
  foundationalAllocation: { active: 3, postDepletion: 0 },
  desiredRetention: 0.9,
  maxIntervalDays: 90,
}

function makeLearningWord(overrides: Partial<WordState> = {}): WordState {
  return {
    wordId: 'word-1',
    category: 'curated',
    masteryCount: 0,
    phase: 'learning',
    lapseCount: 0,
    correctCount: 0,
    wrongCount: 0,
    ...overrides,
  }
}

describe('updateMastery — learning phase', () => {
  it('increments masteryCount by 1 on correct answer', () => {
    const state = makeLearningWord({ masteryCount: 3 })
    const next = updateMastery(state, true, baseConfig)
    expect(next.masteryCount).toBe(4)
  })

  it('decrements masteryCount by 1 on wrong answer', () => {
    const state = makeLearningWord({ masteryCount: 3 })
    const next = updateMastery(state, false, baseConfig)
    expect(next.masteryCount).toBe(2)
  })

  it('floors masteryCount at 0 on wrong answer when already 0', () => {
    const state = makeLearningWord({ masteryCount: 0 })
    const next = updateMastery(state, false, baseConfig)
    expect(next.masteryCount).toBe(0)
  })

  it('increments correctCount on correct answer', () => {
    const state = makeLearningWord({ correctCount: 2 })
    const next = updateMastery(state, true, baseConfig)
    expect(next.correctCount).toBe(3)
  })

  it('increments wrongCount on wrong answer', () => {
    const state = makeLearningWord({ wrongCount: 1 })
    const next = updateMastery(state, false, baseConfig)
    expect(next.wrongCount).toBe(2)
  })

  it('transitions curated word to srsM2_review when masteryCount reaches curated threshold', () => {
    const state = makeLearningWord({ category: 'curated', masteryCount: 9 })
    const next = updateMastery(state, true, baseConfig)
    expect(next.phase).toBe('srsM2_review')
    expect(next.masteryCount).toBe(10)
  })

  it('transitions foundational word to srsM2_review when masteryCount reaches foundational threshold', () => {
    const state = makeLearningWord({ category: 'foundational', masteryCount: 4 })
    const next = updateMastery(state, true, baseConfig)
    expect(next.phase).toBe('srsM2_review')
    expect(next.masteryCount).toBe(5)
  })

  it('does not transition to srsM2_review when masteryCount is below threshold', () => {
    const state = makeLearningWord({ category: 'curated', masteryCount: 8 })
    const next = updateMastery(state, true, baseConfig)
    expect(next.phase).toBe('learning')
  })

  it('does not mutate the input state', () => {
    const state = makeLearningWord({ masteryCount: 5 })
    updateMastery(state, true, baseConfig)
    expect(state.masteryCount).toBe(5)
  })
})

describe('updateMastery — srsM2_review phase', () => {
  function makeAnkiWord(overrides: Partial<WordState> = {}): WordState {
    return makeLearningWord({ phase: 'srsM2_review', masteryCount: 10, ...overrides })
  }

  it('increments lapseCount on wrong answer', () => {
    const state = makeAnkiWord({ lapseCount: 1 })
    const next = updateMastery(state, false, baseConfig)
    expect(next.lapseCount).toBe(2)
  })

  it('resets to learning when lapseCount reaches lapseThreshold', () => {
    const state = makeAnkiWord({ lapseCount: 2 })
    const next = updateMastery(state, false, baseConfig)
    expect(next.phase).toBe('learning')
    expect(next.masteryCount).toBe(0)
    expect(next.lapseCount).toBe(0)
  })

  it('does not lapse on correct answer in srsM2_review', () => {
    const state = makeAnkiWord({ lapseCount: 2 })
    const next = updateMastery(state, true, baseConfig)
    expect(next.phase).toBe('srsM2_review')
    expect(next.lapseCount).toBe(2)
  })

  it('increments correctCount on correct answer in srsM2_review', () => {
    const state = makeAnkiWord({ correctCount: 5 })
    const next = updateMastery(state, true, baseConfig)
    expect(next.correctCount).toBe(6)
  })
})
