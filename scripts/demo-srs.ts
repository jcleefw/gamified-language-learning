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

const scheduler = new FsrsScheduler(config)

function header(title: string) {
  console.log(`\n${'─'.repeat(60)}`)
  console.log(`  ${title}`)
  console.log('─'.repeat(60))
}

// ── Scenario A: Wrong answers decrement mastery in Learning ─────────────────

header('Scenario A: Wrong answers in Learning phase')

let wordA: WordState = {
  wordId: 'hola',
  category: 'curated',
  masteryCount: 0,
  phase: 'learning',
  lapseCount: 0,
  correctCount: 0,
  wrongCount: 0,
}

// Build up to mastery=3, then take 2 wrong hits
const answersA = [true, true, true, false, false, true]
for (const isCorrect of answersA) {
  wordA = updateMastery(wordA, isCorrect, config)
  console.log(
    `  ${isCorrect ? '✓ correct' : '✗ wrong  '} → mastery: ${wordA.masteryCount} | phase: ${wordA.phase}`,
  )
}

// ── Scenario B: Learning → srsM2_review phase transition ───────────────────

header('Scenario B: Learning → srsM2_review (10 correct answers)')

let wordB: WordState = {
  wordId: 'gracias',
  category: 'curated',
  masteryCount: 0,
  phase: 'learning',
  lapseCount: 0,
  correctCount: 0,
  wrongCount: 0,
}

while (wordB.phase === 'learning') {
  wordB = updateMastery(wordB, true, config)
  console.log(`  mastery: ${wordB.masteryCount} | phase: ${wordB.phase}`)
}

// ── Scenario C: ANKI interval growth over multiple correct reviews ──────────

header('Scenario C: ANKI interval growth (5 correct reviews)')
console.log('  (carries fsrsState between reviews to accumulate history)')

for (let i = 1; i <= 5; i++) {
  const result = scheduler.scheduleReview(wordB, true)
  // Backdate lastReview so FSRS sees elapsed_days = scheduledDays on the next call,
  // simulating that the card came due and was reviewed on schedule.
  wordB = {
    ...wordB,
    fsrsState: {
      ...result.updatedFsrsState,
      lastReview: new Date(Date.now() - result.nextIntervalDays * 86_400_000),
    },
  }
  console.log(`  review ${i}: nextIntervalDays=${result.nextIntervalDays} | isLapse=${result.isLapse}`)
}

// ── Scenario D: 3 lapses in srsM2_review → reset to Learning ───────────────

header('Scenario D: 3 lapses in srsM2_review → reset to Learning + mastery=0')

let wordD: WordState = {
  wordId: 'adios',
  category: 'curated',
  masteryCount: 0,
  phase: 'learning',
  lapseCount: 0,
  correctCount: 0,
  wrongCount: 0,
}

// Promote to srsM2_review
while (wordD.phase === 'learning') {
  wordD = updateMastery(wordD, true, config)
}
console.log(`  Starting: mastery=${wordD.masteryCount} | phase=${wordD.phase} | lapseCount=${wordD.lapseCount}`)

// Apply 3 wrong answers
for (let lapse = 1; lapse <= 3; lapse++) {
  wordD = updateMastery(wordD, false, config)
  console.log(
    `  lapse ${lapse}: mastery=${wordD.masteryCount} | phase=${wordD.phase} | lapseCount=${wordD.lapseCount}`,
  )
}

console.log()
console.log('Demo complete.')
