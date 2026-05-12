<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {
  composeBatchMulti,
  nextActivePool,
  updateMasteryState,
  type QuizItem,
  type QuizQuestion,
  type QuizResult,
  type RunState,
} from '@gll/srs-engine-v2'
import { appDecks } from './data/decks'
import { deckToQuizItems, buildWordPool } from './data/transformer'
import { saveSession, loadSession, clearSession } from './composables/useSession'
import DeckSelector from './components/DeckSelector.vue'
import QuizCard from './components/QuizCard.vue'
import BatchResults, { type BatchSummary } from './components/BatchResults.vue'

const wordPool = buildWordPool(appDecks) as QuizItem[]

const CONFIG = {
  questionLimit: 8,
  masteryThreshold: 2,
  streakThresholds: { correctStreakThreshold: 2, wrongStreakThreshold: 2, maxMastery: 2 },
}

type Screen = 'select' | 'quiz' | 'results'

const screen = ref<Screen>('select')
const deckId = ref<string | null>(null)
const activeItems = ref<QuizItem[]>([])
const queue = ref<QuizItem[]>([])
const runState = ref<RunState>(new Map())
const recheckPending = ref(new Set<string>())
const recheckReentered = ref(new Set<string>())

const questions = ref<QuizQuestion[]>([])
const currentIndex = ref(0)
const answers = ref<QuizResult[]>([])
const summary = ref<BatchSummary[]>([])
const batchScore = ref({ correct: 0, total: 0 })

function getDeckWords(id: string): QuizItem[] {
  const deck = appDecks.find(d => d.id === id)
  if (!deck) return []
  return deckToQuizItems(deck) as QuizItem[]
}

function startBatch() {
  const qs = composeBatchMulti(activeItems.value, wordPool, { questionLimit: CONFIG.questionLimit })
  questions.value = qs
  currentIndex.value = 0
  answers.value = []
  screen.value = 'quiz'
}

function initSession(id: string) {
  deckId.value = id
  const words = getDeckWords(id)
  const pool = nextActivePool(words, [], CONFIG.questionLimit, new Map(), CONFIG.masteryThreshold)
  activeItems.value = pool.active
  queue.value = pool.queue
  runState.value = new Map()
  recheckPending.value = new Set()
  recheckReentered.value = new Set()
  startBatch()
}

function onSelect(id: string) {
  initSession(id)
}

function onResume() {
  const saved = loadSession()
  if (!saved) return
  deckId.value = saved.deckId
  activeItems.value = saved.activeItems
  queue.value = saved.queue
  runState.value = saved.runState
  recheckPending.value = saved.recheckPending
  recheckReentered.value = saved.recheckReentered
  startBatch()
}

function onClear() {
  clearSession()
  deckId.value = null
  activeItems.value = []
  queue.value = []
  runState.value = new Map()
  recheckPending.value = new Set()
  recheckReentered.value = new Set()
  screen.value = 'select'
}

function onAnswered(result: QuizResult) {
  answers.value.push(result)
  currentIndex.value++

  if (currentIndex.value < questions.value.length) return

  // Batch complete
  const prevState = new Map(runState.value)
  const masteryResult = updateMasteryState(
    answers.value,
    runState.value,
    prevState,
    recheckPending.value,
    recheckReentered.value,
    CONFIG.masteryThreshold,
    CONFIG.streakThresholds,
  )
  runState.value = masteryResult.runState
  recheckPending.value = masteryResult.recheckPending
  recheckReentered.value = masteryResult.recheckReentered

  const nextPool = nextActivePool(
    activeItems.value,
    queue.value,
    CONFIG.questionLimit,
    runState.value,
    CONFIG.masteryThreshold,
    masteryResult.recheckReentered,
  )
  activeItems.value = nextPool.active
  queue.value = nextPool.queue

  saveSession(
    deckId.value ?? '',
    activeItems.value,
    queue.value,
    runState.value,
    recheckPending.value,
    recheckReentered.value,
  )

  const correct = answers.value.filter(a => a.correct).length
  batchScore.value = { correct, total: answers.value.length }

  summary.value = [...new Set(answers.value.map(a => a.wordId))].map(wid => ({
    wordId: wid,
    state: runState.value.get(wid) ?? { wordId: wid, seen: 0, correct: 0, mastery: 0, correctStreak: 0, wrongStreak: 0 },
    newlyMastered: masteryResult.newlyMasteredIds.includes(wid),
  }))

  screen.value = 'results'
}

function onNext() {
  startBatch()
}

onMounted(() => {
  const saved = loadSession()
  if (saved) {
    // Stay on select — DeckSelector will show the resume banner
    screen.value = 'select'
  }
})
</script>

<template>
  <DeckSelector v-if="screen === 'select'" @select="onSelect" @resume="onResume" @clear="onClear" />

  <QuizCard
    v-else-if="screen === 'quiz' && questions.length > 0"
    :question="questions[currentIndex]"
    :index="currentIndex"
    :total="questions.length"
    @answered="onAnswered"
  />

  <BatchResults
    v-else-if="screen === 'results'"
    :summary="summary"
    :batch-score="batchScore"
    :active-items="activeItems"
    :queue="queue"
    @next="onNext"
  />
</template>
