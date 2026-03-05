import { describe, it, expect } from 'vitest'
import { FsrsScheduler } from '../FsrsScheduler.js'
import type { WordState } from '../../types.js'

const defaultConfig = { desiredRetention: 0.9, maxIntervalDays: 90 }

function makeWordState(overrides: Partial<WordState> = {}): WordState {
  return {
    wordId: 'test-word',
    category: 'curated',
    masteryCount: 10,
    phase: 'srsM2_review',
    lapseCount: 0,
    correctCount: 10,
    wrongCount: 0,
    fsrsState: undefined,
    ...overrides,
  }
}

describe('FsrsScheduler', () => {
  describe('scheduleReview', () => {
    it('correct answer produces isLapse=false', () => {
      const scheduler = new FsrsScheduler(defaultConfig)
      const state = makeWordState()
      const result = scheduler.scheduleReview(state, true)
      expect(result.isLapse).toBe(false)
    })

    it('wrong answer produces isLapse=true', () => {
      const scheduler = new FsrsScheduler(defaultConfig)
      const state = makeWordState()
      const result = scheduler.scheduleReview(state, false)
      expect(result.isLapse).toBe(true)
    })

    it('correct answers produce increasing intervals across sequential reviews', () => {
      const scheduler = new FsrsScheduler(defaultConfig)
      const state = makeWordState()

      const result1 = scheduler.scheduleReview(state, true)
      const stateAfterFirst = makeWordState({ fsrsState: result1.updatedFsrsState })
      const result2 = scheduler.scheduleReview(stateAfterFirst, true)

      expect(result2.nextIntervalDays).toBeGreaterThanOrEqual(result1.nextIntervalDays)
    })

    it('wrong answer produces a shorter interval than correct answer', () => {
      const scheduler = new FsrsScheduler(defaultConfig)
      const state = makeWordState()

      const correctResult = scheduler.scheduleReview(state, true)
      const wrongResult = scheduler.scheduleReview(state, false)

      expect(wrongResult.nextIntervalDays).toBeLessThan(correctResult.nextIntervalDays)
    })

    it('nextIntervalDays never exceeds maxIntervalDays', () => {
      const scheduler = new FsrsScheduler({ desiredRetention: 0.9, maxIntervalDays: 5 })
      const state = makeWordState({
        fsrsState: {
          stability: 100,
          difficulty: 1,
          elapsedDays: 365,
          scheduledDays: 365,
          reps: 50,
          lapses: 0,
          lastReview: new Date('2025-01-01'),
        },
      })

      const result = scheduler.scheduleReview(state, true)
      expect(result.nextIntervalDays).toBeLessThanOrEqual(5)
    })

    it('word with no prior fsrsState returns a valid ReviewResult', () => {
      const scheduler = new FsrsScheduler(defaultConfig)
      const state = makeWordState({ fsrsState: undefined })

      const result = scheduler.scheduleReview(state, true)

      expect(result.nextIntervalDays).toBeGreaterThan(0)
      expect(result.updatedFsrsState).toBeDefined()
      expect(result.isLapse).toBe(false)
    })

    it('updatedFsrsState is populated in every ReviewResult', () => {
      const scheduler = new FsrsScheduler(defaultConfig)

      const correctResult = scheduler.scheduleReview(makeWordState(), true)
      expect(correctResult.updatedFsrsState).toBeDefined()
      expect(correctResult.updatedFsrsState.stability).toBeGreaterThan(0)

      const wrongResult = scheduler.scheduleReview(makeWordState(), false)
      expect(wrongResult.updatedFsrsState).toBeDefined()
    })

    it('scheduleReview does not mutate input WordState', () => {
      const scheduler = new FsrsScheduler(defaultConfig)
      const state = makeWordState()
      const stateBefore = JSON.stringify(state)

      scheduler.scheduleReview(state, true)

      expect(JSON.stringify(state)).toBe(stateBefore)
    })
  })

  describe('getNextInterval', () => {
    it('returns 1 for word with no fsrsState', () => {
      const scheduler = new FsrsScheduler(defaultConfig)
      const state = makeWordState({ fsrsState: undefined })
      expect(scheduler.getNextInterval(state)).toBe(1)
    })

    it('returns scheduledDays (capped) for word with fsrsState', () => {
      const scheduler = new FsrsScheduler({ desiredRetention: 0.9, maxIntervalDays: 90 })
      const state = makeWordState({
        fsrsState: {
          stability: 10,
          difficulty: 5,
          elapsedDays: 7,
          scheduledDays: 120,
          reps: 5,
          lapses: 0,
          lastReview: new Date(),
        },
      })
      expect(scheduler.getNextInterval(state)).toBe(90)
    })

    it('returns exact scheduledDays when below cap', () => {
      const scheduler = new FsrsScheduler(defaultConfig)
      const state = makeWordState({
        fsrsState: {
          stability: 5,
          difficulty: 5,
          elapsedDays: 3,
          scheduledDays: 7,
          reps: 2,
          lapses: 0,
          lastReview: new Date(),
        },
      })
      expect(scheduler.getNextInterval(state)).toBe(7)
    })
  })
})
