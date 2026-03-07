/**
 * Integration: batch composition with real `updateMastery`-promoted word states
 *
 * Tests the cross-module boundary between mastery promotion (updateMastery) and
 * batch assembly (composeBatch). Unit tests for composeBatch use hand-crafted
 * WordState fixtures; these tests verify that words promoted through a real
 * updateMastery progression are correctly classified and ordered by composeBatch.
 *
 * Scenarios:
 * - Promoted (srsM2_review) words appear before learning words regardless of input order
 * - Foundational srsM2_review words are ordered after curated srsM2_review words (carry-over → foundational revision → new)
 * - distributionBreakdown (mc + wordBlock + audio) sums to batchSize with a real mixed pool
 * - Audio redistribution: audio slots collapse to 0 and fold into mc when audioAvailable=false
 */
import { describe, it, expect } from 'vitest'
import { updateMastery, composeBatch } from '../../src/index.js'
import type { SrsConfig, WordState } from '../../src/index.js'

const config: SrsConfig = {
  masteryThreshold: { curated: 10, foundational: 5 },
  lapseThreshold: 3,
  batchSize: 10,
  activeWordLimit: 20,
  newWordsPerBatch: 3,
  shelveAfterBatches: 5,
  maxShelved: 50,
  continuousWrongThreshold: 3,
  questionTypeSplit: { mc: 0.6, wordBlock: 0.3, audio: 0.1 },
  foundationalAllocation: { active: 5, postDepletion: 0 },
  desiredRetention: 0.9,
  maxIntervalDays: 90,
}

function makeLearningWord(wordId: string, category: WordState['category']): WordState {
  return {
    wordId,
    category,
    masteryCount: 0,
    phase: 'learning',
    lapseCount: 0,
    correctCount: 0,
    wrongCount: 0,
  }
}

function promoteToReview(word: WordState): WordState {
  let w = word
  while (w.phase === 'learning') w = updateMastery(w, true, config)
  return w
}

describe('batch-lifecycle integration', () => {
  it('words promoted via updateMastery appear before learning words in batch', () => {
    const carryOver = promoteToReview(makeLearningWord('hola', 'curated'))
    const newWord = makeLearningWord('buenas', 'curated')

    const batch = composeBatch([newWord, carryOver], config)

    // carry-over must come first regardless of input order
    expect(batch.questions[0].wordId).toBe('hola')
    expect(batch.questions[1].wordId).toBe('buenas')
  })

  it('foundational srsM2_review words appear after curated srsM2_review words', () => {
    const curatedCarryOver      = promoteToReview(makeLearningWord('hola', 'curated'))
    const foundationalRevision  = promoteToReview(makeLearningWord('uno', 'foundational'))
    const newWord               = makeLearningWord('buenas', 'curated')

    const batch = composeBatch([foundationalRevision, newWord, curatedCarryOver], config)

    expect(batch.questions[0].wordId).toBe('hola')        // curated carry-over first
    expect(batch.questions[1].wordId).toBe('uno')         // foundational revision second
    expect(batch.questions[2].wordId).toBe('buenas')      // new word third
  })

  it('distributionBreakdown sums to batchSize with a real mixed pool', () => {
    const pool: WordState[] = [
      promoteToReview(makeLearningWord('hola',     'curated')),
      promoteToReview(makeLearningWord('gracias',  'curated')),
      promoteToReview(makeLearningWord('uno',      'foundational')),
      makeLearningWord('buenas',    'curated'),
      makeLearningWord('adios',     'curated'),
      makeLearningWord('por favor', 'curated'),
      makeLearningWord('si',        'curated'),
      makeLearningWord('no',        'curated'),
      makeLearningWord('dos',       'foundational'),
      makeLearningWord('tres',      'foundational'),
    ]

    const batch = composeBatch(pool, config)
    const { mc, wordBlock, audio } = batch.distributionBreakdown

    expect(mc + wordBlock + audio).toBe(batch.batchSize)
    expect(batch.batchSize).toBe(10)
  })

  it('audio redistribution produces audio=0 with a real mixed pool', () => {
    const pool: WordState[] = [
      promoteToReview(makeLearningWord('hola',    'curated')),
      promoteToReview(makeLearningWord('gracias', 'curated')),
      makeLearningWord('buenas',    'curated'),
      makeLearningWord('adios',     'curated'),
      makeLearningWord('por favor', 'curated'),
      makeLearningWord('si',        'curated'),
      makeLearningWord('no',        'curated'),
      makeLearningWord('dos',       'foundational'),
      makeLearningWord('tres',      'foundational'),
      makeLearningWord('cuatro',    'foundational'),
    ]

    const withAudio    = composeBatch(pool, config, { audioAvailable: true })
    const withoutAudio = composeBatch(pool, config, { audioAvailable: false })

    expect(withoutAudio.distributionBreakdown.audio).toBe(0)
    expect(withoutAudio.distributionBreakdown.mc).toBe(
      withAudio.distributionBreakdown.mc + withAudio.distributionBreakdown.audio
    )
    expect(withoutAudio.batchSize).toBe(withAudio.batchSize)
  })
})
