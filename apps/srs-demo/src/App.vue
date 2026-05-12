<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  composeBatchMulti,
  nextActivePool,
  updateMasteryState,
  isMastered,
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
const hasSavedSession = ref(false)
const deckId = ref<string | null>(null)
const activeItems = ref<QuizItem[]>([])
const queue = ref<QuizItem[]>([])
const runState = ref<RunState>(new Map())
const recheckPending = ref(new Set<string>())
const recheckReentered = ref(new Set<string>())

const defaultWordState = { wordId: '', seen: 0, correct: 0, mastery: 0, correctStreak: 0, wrongStreak: 0 }

const masteredDeck = computed<QuizItem[]>(() => {
  const deck = appDecks.find(d => d.id === deckId.value)
  if (!deck) return []
  return deckToQuizItems(deck).filter(w =>
    isMastered(runState.value.get(w.id) ?? { ...defaultWordState, wordId: w.id }, CONFIG.masteryThreshold)
  ) as QuizItem[]
})

const masteredGlobal = computed<QuizItem[]>(() =>
  wordPool.filter(w =>
    isMastered(runState.value.get(w.id) ?? { ...defaultWordState, wordId: w.id }, CONFIG.masteryThreshold)
  )
)

const completedDeckIds = computed<Set<string>>(() => {
  const completed = new Set<string>()
  for (const deck of appDecks) {
    const words = deckToQuizItems(deck)
    if (words.length > 0 && words.every(w =>
      isMastered(runState.value.get(w.id) ?? { ...defaultWordState, wordId: w.id }, CONFIG.masteryThreshold)
    )) {
      completed.add(deck.id)
    }
  }
  return completed
})

const nextDeckId = computed<string | null>(() => {
  const idx = appDecks.findIndex(d => d.id === deckId.value)
  return idx !== -1 && idx + 1 < appDecks.length ? appDecks[idx + 1].id : null
})

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
  // Preserve runState across deck switches — mastery is global
  const pool = nextActivePool([], words, CONFIG.questionLimit, runState.value, CONFIG.masteryThreshold)
  activeItems.value = pool.active
  queue.value = pool.queue
  recheckPending.value = new Set()
  recheckReentered.value = new Set()
  // Persist immediately so deck switch survives reload before first batch
  saveSession(id, pool.active, pool.queue, runState.value, recheckPending.value, recheckReentered.value)
  hasSavedSession.value = true
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
  hasSavedSession.value = false
  deckId.value = null
  activeItems.value = []
  queue.value = []
  runState.value = new Map()
  recheckPending.value = new Set()
  recheckReentered.value = new Set()
  screen.value = 'select'
}

function finishBatch() {
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
  hasSavedSession.value = true

  const correct = answers.value.filter(a => a.correct).length
  batchScore.value = { correct, total: answers.value.length }

  summary.value = [...new Set(answers.value.map(a => a.wordId))].map(wid => ({
    wordId: wid,
    state: runState.value.get(wid) ?? { wordId: wid, seen: 0, correct: 0, mastery: 0, correctStreak: 0, wrongStreak: 0 },
    newlyMastered: masteryResult.newlyMasteredIds.includes(wid),
  }))

  screen.value = 'results'
}

function onAnswered(result: QuizResult) {
  answers.value.push(result)
  currentIndex.value++
  if (currentIndex.value === questions.value.length) finishBatch()
}

function onExitBatch() {
  if (answers.value.length === 0) {
    screen.value = 'select'
    return
  }
  finishBatch()
}

function onNext() {
  startBatch()
}

function onSelectDeck() {
  screen.value = 'select'
}

function onNextDeck(id: string) {
  initSession(id)
}

onMounted(() => {
  const saved = loadSession()
  if (saved) {
    hasSavedSession.value = true
    deckId.value = saved.deckId
    screen.value = 'select'
  }
})
</script>

<template>
  <DeckSelector v-if="screen === 'select'" :has-saved-session="hasSavedSession" :saved-deck-id="deckId" :completed-deck-ids="completedDeckIds" @select="onSelect" @resume="onResume" @clear="onClear" />

  <QuizCard
    v-else-if="screen === 'quiz' && questions.length > 0"
    :question="questions[currentIndex]"
    :index="currentIndex"
    :total="questions.length"
    :active-items="activeItems"
    :queue="queue"
    :mastered-deck="masteredDeck"
    @answered="onAnswered"
    @exit="onExitBatch"
  />

  <BatchResults
    v-else-if="screen === 'results'"
    :summary="summary"
    :batch-score="batchScore"
    :active-items="activeItems"
    :queue="queue"
    :mastered-deck="masteredDeck"
    :mastered-global="masteredGlobal"
    :max-mastery="CONFIG.streakThresholds.maxMastery"
    :next-deck-id="nextDeckId"
    @next="onNext"
    @select-deck="onSelectDeck"
    @next-deck="onNextDeck"
  />
</template>
