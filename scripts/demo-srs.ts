import { updateMastery, FsrsScheduler } from '@gll/srs-engine'
import type { SrsConfig, WordState } from '@gll/srs-engine'

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

let word: WordState = {
  wordId: 'hello',
  category: 'curated',
  masteryCount: 0,
  phase: 'learning',
  lapseCount: 0,
  correctCount: 0,
  wrongCount: 0,
}

console.log('--- SRS Demo: Learning → ANKI progression ---')
console.log(`Word: "${word.wordId}" | category: ${word.category} | threshold: ${config.masteryThreshold.curated}`)
console.log()

while (word.phase === 'learning') {
  word = updateMastery(word, true, config)
  console.log(`  mastery: ${word.masteryCount} | phase: ${word.phase}`)
}

console.log()
console.log(`Phase flipped to: ${word.phase}`)
console.log()

const scheduler = new FsrsScheduler(config)
const result = scheduler.scheduleReview(word, true)

console.log('--- First ANKI review (correct) ---')
console.log(`  nextIntervalDays: ${result.nextIntervalDays}`)
console.log(`  isLapse: ${result.isLapse}`)
console.log()
console.log('Demo complete.')
