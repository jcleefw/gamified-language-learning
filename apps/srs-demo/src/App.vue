<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import {
  assembleBatch,
  initAdaptiveSession,
  advanceAdaptiveSession,
  getNewlyMasteredIds,
  initBatchState,
  nextQuestion,
  submitBatchResult,
  finishBatch,
  isBatchDone,
  isMastered,
  resolveEligibleContexts,
  updateSentenceRunState,
  composeSentenceBatch,
  type QuizItem,
  type QuizQuestion,
  type QuizResult,
  type WordQuizResult,
  type SentenceQuizResult,
  type RunState,
  type AdaptiveSessionState,
  type SessionConfig,
  type BatchState,
  type SentenceRunState,
} from '@gll/srs-engine-v2';
import { appDecks } from './data/decks';
import { deckToQuizItems, buildWordPool, buildSentenceCorpus } from './data/transformer';
import {
  saveSession,
  loadSession,
  clearSession,
} from './composables/useSession';
import DeckSelector from './components/DeckSelector.vue';
import QuizCard from './components/QuizCard.vue';
import BatchResults, { type BatchSummary } from './components/BatchResults.vue';

const wordPool = buildWordPool(appDecks) as QuizItem[];
const sentenceCorpus = buildSentenceCorpus(appDecks);
const SENTENCE_CONFIG = {
  minSeenForSentence: 2,
  sentenceBatchGap: 1,
  sentenceCorrectStreakThreshold: 3,
  sentenceWrongStreakThreshold: 3,
};

const CONFIG: SessionConfig & { maxRetryPerWord: number } = {
  wordsPerBatch: 3,
  masteryThreshold: 2,
  streakThresholds: {
    correctStreakThreshold: 2,
    wrongStreakThreshold: 2,
    maxMastery: 2,
  },
  maxRetryPerSession: 5,
  maxRetryPerWord: 2,
};

type Screen = 'select' | 'quiz' | 'results';

const screen = ref<Screen>('select');
const hasSavedSession = ref(false);
const deckId = ref<string | null>(null);

// Adaptive session state refs
const sessionState = ref<AdaptiveSessionState | null>(null);
const globalRunState = ref<RunState>(new Map());
const sentenceRunState = ref<SentenceRunState>(new Map());
const batchState = ref<BatchState | null>(null);
const currentQuestion = ref<QuizQuestion | null>(null);

const defaultWordState = {
  wordId: '',
  seen: 0,
  correct: 0,
  mastery: 0,
  correctStreak: 0,
  wrongStreak: 0,
};

const currentRunState = computed<RunState>(() => {
  return sessionState.value ? sessionState.value.runState : globalRunState.value;
});

const activeItems = computed<QuizItem[]>(() => {
  return sessionState.value ? sessionState.value.active : [];
});

const queue = computed<QuizItem[]>(() => {
  return sessionState.value ? sessionState.value.queue : [];
});

const masteredDeck = computed<QuizItem[]>(() => {
  const deck = appDecks.find((d) => d.id === deckId.value);
  if (!deck) return [];
  return deckToQuizItems(deck).filter((w) => {
    const ws = currentRunState.value.get(w.id);
    return ws != null && isMastered(ws, CONFIG.masteryThreshold);
  }) as QuizItem[];
});

const masteredGlobal = computed<QuizItem[]>(() =>
  wordPool.filter((w) => {
    const ws = currentRunState.value.get(w.id);
    return ws != null && isMastered(ws, CONFIG.masteryThreshold);
  }),
);

const completedDeckIds = ref<Set<string>>(new Set());

function recalculateCompletedDecks() {
  const completed = new Set<string>();
  for (const deck of appDecks) {
    const words = deckToQuizItems(deck);
    if (
      words.length > 0 &&
      words.every((w) => {
        const ws = currentRunState.value.get(w.id);
        return ws != null && isMastered(ws, CONFIG.masteryThreshold);
      })
    ) {
      completed.add(deck.id);
    }
  }
  completedDeckIds.value = completed;
}

const nextDeckId = computed<string | null>(() => {
  const idx = appDecks.findIndex((d) => d.id === deckId.value);
  return idx !== -1 && idx + 1 < appDecks.length ? appDecks[idx + 1].id : null;
});

const batchScore = ref({ correct: 0, total: 0 });
const summary = ref<BatchSummary[]>([]);

function getDeckWords(id: string): QuizItem[] {
  const deck = appDecks.find((d) => d.id === id);
  if (!deck) return [];
  return deckToQuizItems(deck) as QuizItem[];
}

function startBatch() {
  if (!sessionState.value) return;

  const extraThunks = resolveEligibleContexts(
    sentenceCorpus,
    sessionState.value.runState,
    wordPool,
    sentenceRunState.value,
    sessionState.value.batchNum + 1,
    SENTENCE_CONFIG,
  ).map(({ ctx, tiles }) => () => composeSentenceBatch(ctx, tiles, 'th', { shuffle: true }));

  const questions = assembleBatch(
    sessionState.value.active,
    wordPool,
    [], // foundationalPool is empty in this demo
    CONFIG.wordsPerBatch,
    { extraThunks },
  );

  // Initialize serializable batch state
  batchState.value = initBatchState(
    questions,
    CONFIG.maxRetryPerWord,
    sessionState.value.sessionRetryCounts,
    CONFIG.maxRetryPerSession,
  );

  // Fetch the first question from the queue
  const { question, state: nextState } = nextQuestion(batchState.value);
  batchState.value = nextState;
  currentQuestion.value = question;

  screen.value = 'quiz';
}

function initSession(id: string) {
  deckId.value = id;
  const words = getDeckWords(id);

  // Build recheck IDs based on globalRunState
  const recheckIds = new Set(
    words
      .filter((w) => {
        const ws = globalRunState.value.get(w.id);
        return ws != null && isMastered(ws, CONFIG.masteryThreshold);
      })
      .map((w) => w.id),
  );

  // Initialize adaptive session
  sessionState.value = initAdaptiveSession(
    words,
    CONFIG,
    recheckIds,
    globalRunState.value,
  );

  sentenceRunState.value = new Map();
  saveSession(id, sessionState.value);
  hasSavedSession.value = true;
  startBatch();
}

function onSelect(id: string) {
  initSession(id);
}

function onResume() {
  const saved = loadSession();
  if (!saved) return;
  deckId.value = saved.deckId;
  sessionState.value = saved.sessionState;
  globalRunState.value = saved.sessionState.runState;

  if (sessionState.value.active.length === 0 && sessionState.value.queue.length === 0) {
    const allWordIds = [...sessionState.value.runState.keys()];
    batchScore.value = { correct: allWordIds.length, total: allWordIds.length };
    summary.value = allWordIds.map((wid) => ({
      wordId: wid,
      state: sessionState.value!.runState.get(wid) ?? { ...defaultWordState, wordId: wid },
      newlyMastered: false,
    }));
    screen.value = 'results';
  } else {
    startBatch();
  }
}

function onClear() {
  clearSession();
  hasSavedSession.value = false;
  deckId.value = null;
  sessionState.value = null;
  globalRunState.value = new Map();
  sentenceRunState.value = new Map();
  batchState.value = null;
  currentQuestion.value = null;
  recalculateCompletedDecks();
  screen.value = 'select';
}

function finishBatchAndTransition() {
  if (!sessionState.value || !batchState.value) return;

  const output = finishBatch(batchState.value);
  const prevState = sessionState.value.runState;

  // Advance adaptive session state via the orchestrator
  sessionState.value = advanceAdaptiveSession(sessionState.value, output, CONFIG);
  globalRunState.value = sessionState.value.runState;

  // Determine newly mastered words in this specific batch
  const wordResults = output.results.filter(
    (r): r is WordQuizResult => 'wordId' in r,
  );
  const uniqueWordIds = [...new Set(wordResults.map((r) => r.wordId))];
  const newlyMasteredIds = getNewlyMasteredIds(
    prevState,
    sessionState.value.runState,
    uniqueWordIds,
    CONFIG.masteryThreshold,
  );

  const sentenceResults = output.results.filter(
    (r): r is SentenceQuizResult => 'sentenceId' in r,
  );
  sentenceRunState.value = updateSentenceRunState(
    sentenceRunState.value,
    sentenceResults,
    sessionState.value.batchNum,
    SENTENCE_CONFIG,
  );

  const correct = output.results.filter((a) => a.correct).length;
  batchScore.value = { correct, total: output.results.length };

  summary.value = uniqueWordIds.map((wid) => ({
    wordId: wid,
    state: sessionState.value!.runState.get(wid) ?? { ...defaultWordState, wordId: wid },
    newlyMastered: newlyMasteredIds.includes(wid),
  }));

  saveSession(deckId.value ?? '', sessionState.value);
  hasSavedSession.value = true;

  recalculateCompletedDecks();

  screen.value = 'results';
}

function onAnswered(result: QuizResult) {
  if (!batchState.value) return;

  // Submit result to serializable batch state
  batchState.value = submitBatchResult(batchState.value, result);

  if (isBatchDone(batchState.value)) {
    finishBatchAndTransition();
  } else {
    // Pull the next question
    const { question, state: nextState } = nextQuestion(batchState.value);
    batchState.value = nextState;
    currentQuestion.value = question;
  }
}

function onExitBatch() {
  if (!batchState.value || batchState.value.results.length === 0) {
    screen.value = 'select';
    return;
  }
  finishBatchAndTransition();
}

function onNext() {
  startBatch();
}

function onSelectDeck() {
  screen.value = 'select';
}

function onNextDeck(id: string) {
  initSession(id);
}

onMounted(() => {
  const saved = loadSession();
  if (saved) {
    hasSavedSession.value = true;
    deckId.value = saved.deckId;
    globalRunState.value = saved.sessionState.runState;
    screen.value = 'select';
  }
  recalculateCompletedDecks();
});
</script>

<template>
  <DeckSelector
    v-if="screen === 'select'"
    :has-saved-session="hasSavedSession"
    :saved-deck-id="deckId"
    :completed-deck-ids="completedDeckIds"
    @select="onSelect"
    @resume="onResume"
    @clear="onClear"
  />

  <QuizCard
    v-else-if="screen === 'quiz' && currentQuestion && batchState"
    :question="currentQuestion"
    :index="batchState.results.length"
    :total="batchState.initialCount"
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
