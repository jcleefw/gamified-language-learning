import { describe, it, expect } from 'vitest'
import { composeBatch } from '../batch.js'
import type { WordState, SrsConfig } from '../types.js'

const baseConfig: SrsConfig = {
  masteryThreshold: { curated: 10, foundational: 5 },
  lapseThreshold: 3,
  batchSize: 15,
  activeWordLimit: 20,
  newWordsPerBatch: 3,
  shelveAfterBatches: 3,
  maxShelved: 50,
  continuousWrongThreshold: 3,
  questionTypeSplit: { mc: 70, wordBlock: 20, audio: 10 },
  foundationalAllocation: { active: 3, postDepletion: 0 },
  desiredRetention: 0.9,
  maxIntervalDays: 90,
}

function makeWordState(overrides: Partial<WordState> = {}): WordState {
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

describe('composeBatch — priority ordering', () => {
  it('prioritizes carry-over (curated, srsM2_review) first', () => {
    const carryOver = [
      makeWordState({ wordId: 'carry-1', category: 'curated', phase: 'srsM2_review' }),
      makeWordState({ wordId: 'carry-2', category: 'curated', phase: 'srsM2_review' }),
    ]
    const newWords = [
      makeWordState({ wordId: 'new-1', category: 'curated', phase: 'learning' }),
    ]

    const batch = composeBatch([...newWords, ...carryOver], baseConfig)

    expect(batch.questions[0].wordId).toBe('carry-1')
    expect(batch.questions[1].wordId).toBe('carry-2')
    expect(batch.questions[2].wordId).toBe('new-1')
  })

  it('prioritizes foundational revision (foundational, srsM2_review) second', () => {
    const carryOver = [
      makeWordState({ wordId: 'carry-1', category: 'curated', phase: 'srsM2_review' }),
    ]
    const foundRevision = [
      makeWordState({ wordId: 'found-rev-1', category: 'foundational', phase: 'srsM2_review' }),
    ]
    const newWords = [
      makeWordState({ wordId: 'new-1', category: 'curated', phase: 'learning' }),
    ]

    const batch = composeBatch([...newWords, ...foundRevision, ...carryOver], baseConfig)

    expect(batch.questions[0].wordId).toBe('carry-1')
    expect(batch.questions[1].wordId).toBe('found-rev-1')
    expect(batch.questions[2].wordId).toBe('new-1')
  })

  it('prioritizes new words (curated, learning) third', () => {
    const carryOver = [
      makeWordState({ wordId: 'carry-1', category: 'curated', phase: 'srsM2_review' }),
    ]
    const foundRevision = [
      makeWordState({ wordId: 'found-rev-1', category: 'foundational', phase: 'srsM2_review' }),
    ]
    const newWords = [
      makeWordState({ wordId: 'new-1', category: 'curated', phase: 'learning' }),
      makeWordState({ wordId: 'new-2', category: 'curated', phase: 'learning' }),
    ]
    const foundLearning = [
      makeWordState({ wordId: 'found-learn-1', category: 'foundational', phase: 'learning' }),
    ]

    const batch = composeBatch(
      [...foundLearning, ...newWords, ...foundRevision, ...carryOver],
      baseConfig
    )

    expect(batch.questions[0].wordId).toBe('carry-1')
    expect(batch.questions[1].wordId).toBe('found-rev-1')
    expect(batch.questions[2].wordId).toBe('new-1')
    expect(batch.questions[3].wordId).toBe('new-2')
    expect(batch.questions[4].wordId).toBe('found-learn-1')
  })

  it('includes foundational learning (foundational, learning) last', () => {
    const foundLearning = [
      makeWordState({ wordId: 'found-learn-1', category: 'foundational', phase: 'learning' }),
      makeWordState({ wordId: 'found-learn-2', category: 'foundational', phase: 'learning' }),
    ]
    const batch = composeBatch(foundLearning, baseConfig)

    expect(batch.questions[0].wordId).toBe('found-learn-1')
    expect(batch.questions[1].wordId).toBe('found-learn-2')
  })

  it('respects batchSize limit', () => {
    const words = Array.from({ length: 25 }, (_, i) =>
      makeWordState({ wordId: `word-${i}`, category: 'curated', phase: 'learning' })
    )

    const batch = composeBatch(words, baseConfig)

    expect(batch.questions.length).toBe(15)
  })

  it('returns fewer questions when pool is smaller than batchSize', () => {
    const words = Array.from({ length: 10 }, (_, i) =>
      makeWordState({ wordId: `word-${i}`, category: 'curated', phase: 'learning' })
    )

    const batch = composeBatch(words, baseConfig)

    expect(batch.questions.length).toBe(10)
    expect(batch.batchSize).toBe(10)
  })

  it('returns empty batch when no words available', () => {
    const batch = composeBatch([], baseConfig)

    expect(batch.questions.length).toBe(0)
    expect(batch.batchSize).toBe(0)
  })

  it('does not mutate input wordStates', () => {
    const words = [
      makeWordState({ wordId: 'word-1', category: 'curated', phase: 'learning' }),
    ]
    const original = JSON.stringify(words)

    composeBatch(words, baseConfig)

    expect(JSON.stringify(words)).toBe(original)
  })
})
