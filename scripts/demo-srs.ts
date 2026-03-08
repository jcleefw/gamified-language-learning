import { updateMastery, FsrsScheduler, composeBatch, getEligibleWords, detectStuckWords, shelveWord, unshelveWord, isShelved, getActiveFoundationalWords, applyFoundationalWrongRule, getFoundationalAllocation } from '@gll/srs-engine'
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

// ── Scenario E: composeBatch — priority ordering with real word states ───────

header('Scenario E: composeBatch priority ordering (real word states)')

// Build pool via updateMastery — no hand-crafted phases
function makeWord(wordId: string, category: 'curated' | 'foundational'): WordState {
  return { wordId, category, masteryCount: 0, phase: 'learning', lapseCount: 0, correctCount: 0, wrongCount: 0 }
}

function promoteToReview(word: WordState, cfg: SrsConfig): WordState {
  let w = word
  while (w.phase === 'learning') w = updateMastery(w, true, cfg)
  return w
}

// Carry-over: curated words already in srsM2_review
const carryOver1 = promoteToReview(makeWord('hola', 'curated'), config)
const carryOver2 = promoteToReview(makeWord('gracias', 'curated'), config)

// Foundational revision: foundational word in srsM2_review (5 correct needed)
const foundRev1 = promoteToReview(makeWord('uno', 'foundational'), config)

// New words: curated, still in learning
const newWord1 = makeWord('buenas', 'curated')
const newWord2 = makeWord('adios', 'curated')
const newWord3 = makeWord('por favor', 'curated')

// Foundational learning: foundational, still in learning
const foundLearn1 = makeWord('dos', 'foundational')
const foundLearn2 = makeWord('tres', 'foundational')
// Extra words to fill batchSize=10 so audio slot appears
const newWord4 = makeWord('si', 'curated')
const newWord5 = makeWord('no', 'curated')

const pool: WordState[] = [
  newWord1, newWord2, foundLearn1, carryOver1, foundRev1, newWord3, carryOver2, foundLearn2, newWord4, newWord5,
]

const batchE = composeBatch(pool, config)

const bucketLabel = (wordId: string): string => {
  if (wordId === carryOver1.wordId || wordId === carryOver2.wordId) return '[carry-over]'
  if (wordId === foundRev1.wordId) return '[found.revision]'
  if ([newWord1.wordId, newWord2.wordId, newWord3.wordId, newWord4.wordId, newWord5.wordId].includes(wordId)) return '[new word]'
  return '[found.learning]'
}

console.log(`  Pool: ${pool.length} words → batch: ${batchE.batchSize} questions`)
for (const q of batchE.questions) {
  console.log(`  ${bucketLabel(q.wordId).padEnd(18)} wordId=${q.wordId.padEnd(12)} type=${q.type}`)
}
console.log(`  Distribution: mc=${batchE.distributionBreakdown.mc} | wordBlock=${batchE.distributionBreakdown.wordBlock} | audio=${batchE.distributionBreakdown.audio}`)

// ── Scenario F: audio redistribution — side-by-side comparison ──────────────

header('Scenario F: audio redistribution (audioAvailable true vs false)')

const batchWithAudio    = composeBatch(pool, config, { audioAvailable: true })
const batchWithoutAudio = composeBatch(pool, config, { audioAvailable: false })

console.log('                    audioAvailable=true   audioAvailable=false')
console.log(`  mc              : ${String(batchWithAudio.distributionBreakdown.mc).padStart(6)}                 ${String(batchWithoutAudio.distributionBreakdown.mc).padStart(6)}`)
console.log(`  wordBlock       : ${String(batchWithAudio.distributionBreakdown.wordBlock).padStart(6)}                 ${String(batchWithoutAudio.distributionBreakdown.wordBlock).padStart(6)}`)
console.log(`  audio           : ${String(batchWithAudio.distributionBreakdown.audio).padStart(6)}                 ${String(batchWithoutAudio.distributionBreakdown.audio).padStart(6)}`)
console.log(`  total           : ${String(batchWithAudio.batchSize).padStart(6)}                 ${String(batchWithoutAudio.batchSize).padStart(6)}`)

// ── Scenario G: Active window slot calculation ───────────────────────────────

header('Scenario G: Active window slot calculation (activeWordLimit=5, newWordsPerBatch=3)')

// Use a tighter config so we can demonstrate newSlots=0 without 20 words
const windowConfig: SrsConfig = { ...config, activeWordLimit: 5, newWordsPerBatch: 3 }

// Build pool: 3 curated driven to srsM2_review, 2 curated left in learning
const activeWord1 = promoteToReview(makeWord('hola', 'curated'), windowConfig)
const activeWord2 = promoteToReview(makeWord('gracias', 'curated'), windowConfig)
const activeWord3 = promoteToReview(makeWord('adios', 'curated'), windowConfig)
const learningWord1 = makeWord('buenas', 'curated')
const learningWord2 = makeWord('por favor', 'curated')

const poolG1: WordState[] = [activeWord1, activeWord2, activeWord3, learningWord1, learningWord2]
const resultG1 = getEligibleWords(poolG1, windowConfig)
console.log(`  3 active, 2 learning:`)
console.log(`    active.length  = ${resultG1.active.length}`)
console.log(`    newSlots       = ${resultG1.newSlots}   (min(3, 5-3) = 2)`)
console.log(`    eligible.length= ${resultG1.eligible.length}`)

// Fill the active window to show newSlots = 0
const activeWord4 = promoteToReview(makeWord('si', 'curated'), windowConfig)
const activeWord5 = promoteToReview(makeWord('no', 'curated'), windowConfig)

const poolG2: WordState[] = [activeWord1, activeWord2, activeWord3, activeWord4, activeWord5, learningWord1]
const resultG2 = getEligibleWords(poolG2, windowConfig)
console.log(`  5 active (at limit), 1 learning:`)
console.log(`    active.length  = ${resultG2.active.length}`)
console.log(`    newSlots       = ${resultG2.newSlots}   (window full → 0)`)
console.log(`    eligible.length= ${resultG2.eligible.length}`)

// ── Scenario H: Stuck word detection + shelving ──────────────────────────────

header('Scenario H: Stuck word detection + shelving (shelveAfterBatches=5, maxShelved=2)')

// Use a config with maxShelved=2 to demonstrate cap behaviour cleanly
const shelveConfig: SrsConfig = { ...config, shelveAfterBatches: 5, maxShelved: 2 }

// Build pool; set batchesSinceLastProgress directly (caller-managed field)
const stuckWord1: WordState = { ...makeWord('uno', 'foundational'), batchesSinceLastProgress: 5 }
const stuckWord2: WordState = { ...makeWord('dos', 'foundational'), batchesSinceLastProgress: 5 }
const almostStuck: WordState = { ...makeWord('tres', 'foundational'), batchesSinceLastProgress: 2 }
const fineWord: WordState   = { ...makeWord('cuatro', 'foundational'), batchesSinceLastProgress: 0 }

const poolH: WordState[] = [stuckWord1, stuckWord2, almostStuck, fineWord]
const resultH = detectStuckWords(poolH, shelveConfig)
console.log(`  detectStuckWords (no words shelved yet):`)
console.log(`    stuck.length   = ${resultH.stuck.length}  (batchesSinceLastProgress >= 5)`)
console.log(`    toShelve       = [${resultH.toShelve.map((w) => w.wordId).join(', ')}]`)
console.log(`    canReShelve    = ${resultH.canReShelve}`)

// shelveWord + isShelved
const shelvedW1 = shelveWord(stuckWord1, 86_400_000)
console.log(`  shelveWord('uno', 1 day):`)
console.log(`    isShelved(shelvedW1)   = ${isShelved(shelvedW1)}`)

// unshelveWord
const unshelvedW1 = unshelveWord(shelvedW1)
console.log(`  unshelveWord('uno'):`)
console.log(`    isShelved(unshelvedW1) = ${isShelved(unshelvedW1)}`)

// Cap behaviour: pre-shelve 2 words, then detect 3rd stuck word
const preShelved1: WordState = shelveWord({ ...makeWord('seis', 'curated'), batchesSinceLastProgress: 5 }, 86_400_000)
const preShelved2: WordState = shelveWord({ ...makeWord('siete', 'curated'), batchesSinceLastProgress: 5 }, 86_400_000)
const thirdStuck: WordState  = { ...makeWord('ocho', 'curated'), batchesSinceLastProgress: 5 }

const poolHCap: WordState[] = [preShelved1, preShelved2, thirdStuck]
const resultHCap = detectStuckWords(poolHCap, shelveConfig)
console.log(`  cap behaviour (2 already shelved, 1 new stuck word):`)
console.log(`    stuck.length   = ${resultHCap.stuck.length}`)
console.log(`    toShelve       = [${resultHCap.toShelve.map((w) => w.wordId).join(', ')}]  (newest stuck word)`)
console.log(`    canReShelve    = ${resultHCap.canReShelve}  (cap reached)`)

// ── Scenario I: Foundational active limit ────────────────────────────────────

header('Scenario I: Foundational active limit (max 3 active)')

const foundActive1 = makeWord('uno', 'foundational')
const foundActive2 = makeWord('dos', 'foundational')
const foundActive3 = makeWord('tres', 'foundational')
const foundInactive = promoteToReview(makeWord('cuatro', 'foundational'), config)

// 3 foundational words in learning → all 3 active, no slots left
const poolI1: WordState[] = [foundActive1, foundActive2, foundActive3, foundInactive]
const resultI1 = getActiveFoundationalWords(poolI1, config)
console.log(`  3 foundational in learning, 1 in srsM2_review:`)
console.log(`    active.length    = ${resultI1.active.length}`)
console.log(`    availableSlots   = ${resultI1.availableSlots}   (3 - 3 = 0)`)

// 1 foundational word in learning → 2 slots available
const poolI2: WordState[] = [foundActive1, foundInactive]
const resultI2 = getActiveFoundationalWords(poolI2, config)
console.log(`  1 foundational in learning, 1 in srsM2_review:`)
console.log(`    active.length    = ${resultI2.active.length}`)
console.log(`    availableSlots   = ${resultI2.availableSlots}   (3 - 1 = 2)`)

// ── Scenario J: Continuous wrong rule ────────────────────────────────────────

header('Scenario J: Continuous wrong rule (3 consecutive wrongs → mastery reset)')

// Build foundational word to mastery=4 via updateMastery
let wordJ = makeWord('cinco', 'foundational')
for (let i = 0; i < 4; i++) wordJ = updateMastery(wordJ, true, config)
console.log(`  After 4 correct: mastery=${wordJ.masteryCount} | phase=${wordJ.phase}`)

// Apply 3 consecutive wrongs via applyFoundationalWrongRule
for (let wrong = 1; wrong <= 3; wrong++) {
  wordJ = applyFoundationalWrongRule(wordJ, config)
  console.log(
    `  wrong ${wrong}: mastery=${wordJ.masteryCount} | consecutiveWrongCount=${wordJ.consecutiveWrongCount ?? 0} | phase=${wordJ.phase}`,
  )
}

// Correct answer after 2 wrongs resets consecutiveWrongCount
let wordJ2 = makeWord('seis', 'foundational')
for (let i = 0; i < 3; i++) wordJ2 = updateMastery(wordJ2, true, config)
wordJ2 = applyFoundationalWrongRule(wordJ2, config)
wordJ2 = applyFoundationalWrongRule(wordJ2, config)
console.log(`  After 2 wrongs: mastery=${wordJ2.masteryCount} | consecutiveWrongCount=${wordJ2.consecutiveWrongCount ?? 0}`)
wordJ2 = updateMastery(wordJ2, true, config)
console.log(`  After correct:  mastery=${wordJ2.masteryCount} | consecutiveWrongCount=${wordJ2.consecutiveWrongCount ?? 0}`)

// ── Scenario K: Foundational batch allocation ────────────────────────────────

header('Scenario K: Foundational batch allocation (active vs depleted pool)')

const allocConfig: SrsConfig = { ...config, foundationalAllocation: { active: 0.2, postDepletion: 0.05 } }

// Active pool: some foundational words below threshold
const foundBelow1 = makeWord('uno', 'foundational')
const foundBelow2 = makeWord('dos', 'foundational')
const foundAbove = promoteToReview(makeWord('tres', 'foundational'), allocConfig)

const activePool = [foundBelow1, foundBelow2, foundAbove]
const allocActive = getFoundationalAllocation(allocConfig.batchSize, activePool, allocConfig)
console.log(`  Active pool (2 below threshold, 1 above):`)
console.log(`    slots        = ${allocActive.slots}   (Math.round(10 × 0.2) = 2)`)
console.log(`    poolDepleted = ${allocActive.poolDepleted}`)

// Depleted pool: all foundational words above threshold
const depletedPool = [
  promoteToReview(makeWord('uno', 'foundational'), allocConfig),
  promoteToReview(makeWord('dos', 'foundational'), allocConfig),
  promoteToReview(makeWord('tres', 'foundational'), allocConfig),
]
const allocDepleted = getFoundationalAllocation(allocConfig.batchSize, depletedPool, allocConfig)
console.log(`  Depleted pool (all above threshold):`)
console.log(`    slots        = ${allocDepleted.slots}   (Math.round(10 × 0.05) = 1)`)
console.log(`    poolDepleted = ${allocDepleted.poolDepleted}`)

console.log()
console.log('Demo complete.')
