import { describe, it, expect } from 'vitest'
import { SrsEngine } from '../srs-engine.js'
import type { WordState, SrsConfig } from '../types.js'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const baseConfig: SrsConfig = {
  masteryThreshold: { curated: 3, foundational: 2 },
  lapseThreshold: 3,
  batchSize: 10,
  activeWordLimit: 20,
  newWordsPerBatch: 5,
  shelveAfterBatches: 3,
  maxShelved: 2,
  continuousWrongThreshold: 3,
  questionTypeSplit: { mc: 0.7, wordBlock: 0.2, audio: 0.1 },
  foundationalAllocation: { active: 0.2, postDepletion: 0.05 },
  desiredRetention: 0.9,
  maxIntervalDays: 90,
}

function makeLearning(overrides: Partial<WordState> = {}): WordState {
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

function makeReview(overrides: Partial<WordState> = {}): WordState {
  return makeLearning({ phase: 'srsM2_review', ...overrides })
}

// ---------------------------------------------------------------------------
// Config validation (ST01)
// ---------------------------------------------------------------------------

describe('SrsEngine — config validation', () => {
  it('constructs without error given a valid config', () => {
    expect(() => new SrsEngine(baseConfig)).not.toThrow()
  })

  it('throws when batchSize is 0', () => {
    expect(() => new SrsEngine({ ...baseConfig, batchSize: 0 })).toThrow('batchSize')
  })

  it('throws when batchSize is negative', () => {
    expect(() => new SrsEngine({ ...baseConfig, batchSize: -1 })).toThrow('batchSize')
  })

  it('throws when masteryThreshold.curated is 0', () => {
    expect(() =>
      new SrsEngine({ ...baseConfig, masteryThreshold: { curated: 0, foundational: 2 } }),
    ).toThrow('masteryThreshold.curated')
  })

  it('throws when masteryThreshold.foundational is 0', () => {
    expect(() =>
      new SrsEngine({ ...baseConfig, masteryThreshold: { curated: 3, foundational: 0 } }),
    ).toThrow('masteryThreshold.foundational')
  })

  it('throws when lapseThreshold is 0', () => {
    expect(() => new SrsEngine({ ...baseConfig, lapseThreshold: 0 })).toThrow('lapseThreshold')
  })

  it('throws when activeWordLimit is 0', () => {
    expect(() => new SrsEngine({ ...baseConfig, activeWordLimit: 0 })).toThrow('activeWordLimit')
  })

  it('throws when newWordsPerBatch is 0', () => {
    expect(() => new SrsEngine({ ...baseConfig, newWordsPerBatch: 0 })).toThrow('newWordsPerBatch')
  })

  it('throws when shelveAfterBatches is 0', () => {
    expect(() => new SrsEngine({ ...baseConfig, shelveAfterBatches: 0 })).toThrow(
      'shelveAfterBatches',
    )
  })

  it('throws when maxShelved is 0', () => {
    expect(() => new SrsEngine({ ...baseConfig, maxShelved: 0 })).toThrow('maxShelved')
  })

  it('throws when continuousWrongThreshold is 0', () => {
    expect(() => new SrsEngine({ ...baseConfig, continuousWrongThreshold: 0 })).toThrow(
      'continuousWrongThreshold',
    )
  })

  it('throws when desiredRetention is 0', () => {
    expect(() => new SrsEngine({ ...baseConfig, desiredRetention: 0 })).toThrow('desiredRetention')
  })

  it('throws when desiredRetention exceeds 1', () => {
    expect(() => new SrsEngine({ ...baseConfig, desiredRetention: 1.1 })).toThrow('desiredRetention')
  })

  it('throws when maxIntervalDays is 0', () => {
    expect(() => new SrsEngine({ ...baseConfig, maxIntervalDays: 0 })).toThrow('maxIntervalDays')
  })
})

// ---------------------------------------------------------------------------
// composeBatch (ST01)
// ---------------------------------------------------------------------------

describe('SrsEngine — composeBatch', () => {
  it('returns a batch from word states', () => {
    const engine = new SrsEngine(baseConfig)
    const words = [
      makeLearning({ wordId: 'w1' }),
      makeLearning({ wordId: 'w2' }),
      makeLearning({ wordId: 'w3' }),
    ]
    const batch = engine.composeBatch(words)
    expect(batch.questions.length).toBeGreaterThan(0)
    expect(batch.batchSize).toBe(batch.questions.length)
  })

  it('excludes shelved words from the batch', () => {
    const engine = new SrsEngine(baseConfig)
    const shelvedUntil = new Date(Date.now() + 60_000)
    const words = [
      makeLearning({ wordId: 'w1' }),
      makeLearning({ wordId: 'w2', shelvedUntil }),
    ]
    const batch = engine.composeBatch(words)
    const ids = batch.questions.map((q) => q.wordId)
    expect(ids).toContain('w1')
    expect(ids).not.toContain('w2')
  })

  it('respects newWordsPerBatch limit for learning words', () => {
    const config = { ...baseConfig, newWordsPerBatch: 2, activeWordLimit: 20 }
    const engine = new SrsEngine(config)
    // 5 learning words, only 2 should enter the batch (newWordsPerBatch = 2)
    const words = Array.from({ length: 5 }, (_, i) => makeLearning({ wordId: `w${i}` }))
    const batch = engine.composeBatch(words)
    expect(batch.questions.length).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// Scenario 1: Learning → srsM2_review transition
// ---------------------------------------------------------------------------

describe('Integration: Learning → srsM2_review transition', () => {
  it('promotes a curated word to srsM2_review after reaching masteryThreshold correct answers', () => {
    const engine = new SrsEngine(baseConfig) // masteryThreshold.curated = 3
    let state = makeLearning({ wordId: 'w1', masteryCount: 2 }) // one correct away

    const [result] = engine.processAnswers([{ wordId: 'w1', isCorrect: true }], [state])

    expect(result.phase).toBe('srsM2_review')
    expect(result.masteryCount).toBe(3)
  })

  it('does not apply FSRS scheduling to a word that just transitioned into srsM2_review', () => {
    const engine = new SrsEngine(baseConfig)
    const state = makeLearning({ wordId: 'w1', masteryCount: 2 })

    const [result] = engine.processAnswers([{ wordId: 'w1', isCorrect: true }], [state])

    // Word was learning before this answer — no FSRS scheduling applied
    expect(result.fsrsState).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// Scenario 2: 3-lapse ANKI → Learning reset
// ---------------------------------------------------------------------------

describe('Integration: 3-lapse srsM2_review → Learning reset', () => {
  it('demotes a review word back to learning after lapseThreshold lapses', () => {
    const engine = new SrsEngine(baseConfig) // lapseThreshold = 3
    const state = makeReview({ wordId: 'w1', lapseCount: 2 }) // one lapse from threshold

    const [result] = engine.processAnswers([{ wordId: 'w1', isCorrect: false }], [state])

    expect(result.phase).toBe('learning')
    expect(result.masteryCount).toBe(0)
    expect(result.lapseCount).toBe(0)
  })

  it('applies FSRS scheduling before demotion (word was in srsM2_review)', () => {
    const engine = new SrsEngine(baseConfig)
    const state = makeReview({ wordId: 'w1', lapseCount: 2 })

    const [result] = engine.processAnswers([{ wordId: 'w1', isCorrect: false }], [state])

    // FSRS state should be set because the word was in srsM2_review before this answer
    expect(result.fsrsState).toBeDefined()
  })

  it('accumulates lapses without demotion until threshold', () => {
    const engine = new SrsEngine(baseConfig)
    const state = makeReview({ wordId: 'w1', lapseCount: 0 })

    const [result] = engine.processAnswers([{ wordId: 'w1', isCorrect: false }], [state])

    expect(result.phase).toBe('srsM2_review') // not yet demoted
    expect(result.lapseCount).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// Scenario 3: Stuck word shelved after shelveAfterBatches batches
// ---------------------------------------------------------------------------

describe('Integration: Stuck word shelving', () => {
  it('shelves a stuck word after it reaches shelveAfterBatches without progress', () => {
    const engine = new SrsEngine(baseConfig) // shelveAfterBatches = 3
    // Word already has 2 batches of no progress; one more wrong answer pushes it to 3 → shelved
    const state = makeLearning({ wordId: 'w1', batchesSinceLastProgress: 2 })

    const [result] = engine.processAnswers([{ wordId: 'w1', isCorrect: false }], [state])

    expect(result.shelvedUntil).toBeDefined()
    expect(result.shelvedUntil).not.toBeNull()
    expect(result.shelvedUntil!.getTime()).toBeGreaterThan(Date.now())
  })

  it('does not shelve a word that makes progress', () => {
    const engine = new SrsEngine(baseConfig)
    const state = makeLearning({ wordId: 'w1', batchesSinceLastProgress: 2 })

    const [result] = engine.processAnswers([{ wordId: 'w1', isCorrect: true }], [state])

    expect(result.shelvedUntil).toBeUndefined()
    expect(result.batchesSinceLastProgress).toBe(0)
  })

  it('respects the maxShelved cap', () => {
    const engine = new SrsEngine(baseConfig) // maxShelved = 2
    const alreadyShelved = makeLearning({
      wordId: 'w0',
      shelvedUntil: new Date(Date.now() + 60_000),
      batchesSinceLastProgress: 5,
    })
    const stuck1 = makeLearning({ wordId: 'w1', batchesSinceLastProgress: 2 })
    const stuck2 = makeLearning({ wordId: 'w2', batchesSinceLastProgress: 2 })

    // Both w1 and w2 would become stuck; but maxShelved=2 and w0 already occupies 1 slot
    const results = engine.processAnswers(
      [
        { wordId: 'w1', isCorrect: false },
        { wordId: 'w2', isCorrect: false },
      ],
      [alreadyShelved, stuck1, stuck2],
    )

    const shelvedCount = results.filter((r) => r.shelvedUntil && r.shelvedUntil.getTime() > Date.now()).length
    expect(shelvedCount).toBeLessThanOrEqual(baseConfig.maxShelved)
  })
})

// ---------------------------------------------------------------------------
// Scenario 4: Shelved word re-enters batch as carry-over
// ---------------------------------------------------------------------------

describe('Integration: Shelved word re-entry', () => {
  it('excludes currently shelved words from composeBatch', () => {
    const engine = new SrsEngine(baseConfig)
    const shelvedUntil = new Date(Date.now() + 60_000)
    const shelved = makeReview({ wordId: 'shelved', shelvedUntil })
    const active = makeReview({ wordId: 'active' })

    const batch = engine.composeBatch([shelved, active])
    const ids = batch.questions.map((q) => q.wordId)

    expect(ids).not.toContain('shelved')
    expect(ids).toContain('active')
  })

  it('includes a word whose shelvedUntil has expired (re-entry as carry-over)', () => {
    const engine = new SrsEngine(baseConfig)
    // shelvedUntil in the past = expired = no longer shelved
    const expired = makeReview({ wordId: 'expired', shelvedUntil: new Date(Date.now() - 1000) })

    const batch = engine.composeBatch([expired])
    const ids = batch.questions.map((q) => q.wordId)

    expect(ids).toContain('expired')
  })
})

// ---------------------------------------------------------------------------
// Scenario 5: Foundational continuous wrong reset
// ---------------------------------------------------------------------------

describe('Integration: Foundational continuous wrong reset', () => {
  it('resets masteryCount to 0 after continuousWrongThreshold consecutive wrongs', () => {
    const engine = new SrsEngine(baseConfig) // continuousWrongThreshold = 3
    const state = makeLearning({
      wordId: 'f1',
      category: 'foundational',
      masteryCount: 5,
      consecutiveWrongCount: 2, // one more wrong triggers reset
    })

    const [result] = engine.processAnswers([{ wordId: 'f1', isCorrect: false }], [state])

    expect(result.masteryCount).toBe(0)
    expect(result.consecutiveWrongCount).toBe(0)
    expect(result.phase).toBe('learning')
  })

  it('increments consecutiveWrongCount without reset before threshold', () => {
    const engine = new SrsEngine(baseConfig)
    const state = makeLearning({
      wordId: 'f1',
      category: 'foundational',
      masteryCount: 3,
      consecutiveWrongCount: 1,
    })

    const [result] = engine.processAnswers([{ wordId: 'f1', isCorrect: false }], [state])

    expect(result.consecutiveWrongCount).toBe(2)
    expect(result.masteryCount).toBe(2) // decremented by updateMastery
  })

  it('resets consecutiveWrongCount to 0 on correct answer', () => {
    const engine = new SrsEngine(baseConfig)
    const state = makeLearning({
      wordId: 'f1',
      category: 'foundational',
      masteryCount: 2,
      consecutiveWrongCount: 2,
    })

    const [result] = engine.processAnswers([{ wordId: 'f1', isCorrect: true }], [state])

    expect(result.consecutiveWrongCount).toBe(0)
    expect(result.masteryCount).toBe(3)
  })

  it('does not apply foundational wrong rule to srsM2_review foundational words', () => {
    const engine = new SrsEngine(baseConfig)
    const state = makeReview({
      wordId: 'f1',
      category: 'foundational',
      masteryCount: 5,
      consecutiveWrongCount: 2,
    })

    const [result] = engine.processAnswers([{ wordId: 'f1', isCorrect: false }], [state])

    // lapseCount incremented by updateMastery but no consecutiveWrongCount change
    expect(result.consecutiveWrongCount).toBe(2)
    expect(result.phase).toBe('srsM2_review') // not reset to learning
  })
})

// ---------------------------------------------------------------------------
// Words not in the answer set are passed through unchanged
// ---------------------------------------------------------------------------

describe('processAnswers — pass-through for unanswered words', () => {
  it('leaves words with no corresponding answer unchanged', () => {
    const engine = new SrsEngine(baseConfig)
    const answered = makeLearning({ wordId: 'w1' })
    const bystander = makeLearning({ wordId: 'w2', masteryCount: 7 })

    const results = engine.processAnswers([{ wordId: 'w1', isCorrect: true }], [answered, bystander])

    const bystanderResult = results.find((r) => r.wordId === 'w2')!
    expect(bystanderResult.masteryCount).toBe(7)
  })
})
