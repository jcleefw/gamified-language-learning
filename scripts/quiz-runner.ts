import { createInterface } from 'node:readline/promises'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SrsEngine } from '@gll/srs-engine'
import type { SrsConfig, WordState, QuizAnswer, QuestionType } from '@gll/srs-engine'
import { characterToWordState, conversationWordsToWordStates } from '../packages/srs-engine/data/mappers.js'
import type { FoundationalCharacter, ConversationWord } from '../packages/srs-engine/data/types.js'
import { consonants } from '../packages/srs-engine/data/samples/foundations-consonants.js'

// ── Config ──────────────────────────────────────────────────────────────────

const config: SrsConfig = {
  masteryThreshold: { curated: 10, foundational: 5 },
  lapseThreshold: 3,
  batchSize: 15,
  activeWordLimit: 20,
  newWordsPerBatch: 3,
  shelveAfterBatches: 5,
  maxShelved: 50,
  continuousWrongThreshold: 3,
  questionTypeSplit: { mc: 0.6, wordBlock: 0.3, audio: 0.1 },
  foundationalAllocation: { active: 0.2, postDepletion: 0.05 },
  desiredRetention: 0.9,
  maxIntervalDays: 90,
}

// ── Word detail lookup ──────────────────────────────────────────────────────

interface WordDetail {
  native: string
  romanization: string
  english: string
  category: 'foundational' | 'curated'
}

/** Maps wordId → display details for quiz questions. */
const wordDetails = new Map<string, WordDetail>()

function registerFoundational(character: FoundationalCharacter): void {
  wordDetails.set(`foundational:${character.id}`, {
    native: character.char,
    romanization: character.romanization,
    english: character.name,
    category: 'foundational',
  })
}

function registerCurated(word: ConversationWord): void {
  wordDetails.set(`curated:${word.native}`, {
    native: word.native,
    romanization: word.romanization,
    english: word.english,
    category: 'curated',
  })
}

// ── Seed data loading ───────────────────────────────────────────────────────

interface RawConversationWord {
  thai: string
  romanization: string
  english: string
  type: string
}

interface RawConversation {
  id: string
  topic: string
  uniqueWords: RawConversationWord[]
}

function loadSeedData(): WordState[] {
  // Foundational: first 5 consonants
  const firstFive = consonants.slice(0, 5)
  firstFive.forEach(registerFoundational)
  const foundationalStates = firstFive.map(characterToWordState)

  // Conversations: map `thai` → `native` then convert
  const currentDir = dirname(fileURLToPath(import.meta.url))
  const jsonPath = resolve(currentDir, '../packages/srs-engine/data/samples/conversations-2026-03-08.json')
  const rawConversations: RawConversation[] = JSON.parse(readFileSync(jsonPath, 'utf-8'))

  const allConversationWords: ConversationWord[] = rawConversations
    .filter((conversation) => conversation.uniqueWords.length > 0)
    .flatMap((conversation) =>
      conversation.uniqueWords.map((word) => ({
        native: word.thai,
        romanization: word.romanization,
        english: word.english,
        type: word.type,
      })),
    )

  allConversationWords.forEach(registerCurated)
  const curatedStates = conversationWordsToWordStates(allConversationWords)

  return [...foundationalStates, ...curatedStates]
}

// ── Quiz question display ───────────────────────────────────────────────────

function formatQuestion(wordId: string, questionType: QuestionType): string {
  const detail = wordDetails.get(wordId)
  if (!detail) return wordId

  if (detail.category === 'foundational') {
    switch (questionType) {
      case 'mc':
        return `What is "${detail.native}"?  (answer: ${detail.english} — ${detail.romanization})`
      case 'wordBlock':
        return `Spell the romanization of "${detail.native}"  (answer: ${detail.romanization})`
      case 'audio':
        return `Listen: "${detail.native}" — what sound does it make?  (answer: ${detail.romanization})`
    }
  }

  // curated word
  switch (questionType) {
    case 'mc':
      return `What does "${detail.native}" mean?  (answer: ${detail.english})`
    case 'wordBlock':
      return `Arrange: "${detail.english}" in Thai  (answer: ${detail.native} — ${detail.romanization})`
    case 'audio':
      return `Listen: "${detail.native}" — what does it mean?  (answer: ${detail.english})`
  }
}

// ── Display helpers ─────────────────────────────────────────────────────────

function header(title: string): void {
  console.log(`\n${'─'.repeat(60)}`)
  console.log(`  ${title}`)
  console.log('─'.repeat(60))
}

function printMasterySummary(wordStates: WordState[], batchWordIds: Set<string>): void {
  console.log('\n  Updated mastery:')
  console.log('  ' + '─'.repeat(50))

  for (const state of wordStates) {
    if (!batchWordIds.has(state.wordId)) continue
    const detail = wordDetails.get(state.wordId)
    const label = detail ? `${detail.native} (${detail.english})` : state.wordId
    const displayLabel = label.length > 28 ? label.slice(0, 26) + '…' : label
    console.log(
      `  ${displayLabel.padEnd(30)} ${state.phase.padEnd(14)} mastery=${state.masteryCount}  lapse=${state.lapseCount}`,
    )
  }
}

// ── Quiz loop ───────────────────────────────────────────────────────────────

async function runQuiz(): Promise<void> {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const engine = new SrsEngine(config)
  let wordStates = loadSeedData()
  let batchNumber = 1

  const foundationalCount = wordStates.filter((w) => w.category === 'foundational').length
  const curatedCount = wordStates.filter((w) => w.category === 'curated').length
  console.log(`\nLoaded ${wordStates.length} words (${foundationalCount} foundational, ${curatedCount} curated)`)
  console.log('Answer (c)orrect, (w)rong, or (q)uit for each question.\n')

  try {
    while (true) {
      header(`Batch ${batchNumber}`)

      const batch = engine.composeBatch(wordStates)

      if (batch.questions.length === 0) {
        console.log('\n  All words mastered or no eligible words! Quiz complete.')
        break
      }

      console.log(`  ${batch.batchSize} questions\n`)

      const answers: QuizAnswer[] = []

      for (let questionIndex = 0; questionIndex < batch.questions.length; questionIndex++) {
        const question = batch.questions[questionIndex]
        const questionText = formatQuestion(question.wordId, question.type)

        console.log(`  Q${questionIndex + 1}. [${question.type}] ${questionText}`)
        const input = await rl.question('  → Did you get it right? (c/w/q): ')
        const trimmed = input.trim().toLowerCase()

        if (trimmed === 'q') {
          console.log('\n  Quitting quiz. Goodbye!')
          return
        }

        answers.push({
          wordId: question.wordId,
          isCorrect: trimmed === 'c' || trimmed === 'y',
        })
        console.log()
      }

      wordStates = engine.processAnswers(answers, wordStates)

      const batchWordIds = new Set(batch.questions.map((q) => q.wordId))
      printMasterySummary(wordStates, batchWordIds)

      batchNumber++
    }
  } finally {
    rl.close()
  }
}

runQuiz().catch((error: unknown) => {
  console.error('Quiz runner error:', error)
  process.exit(1)
})
