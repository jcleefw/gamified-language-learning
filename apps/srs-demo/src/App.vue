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
  type SentenceRunState,
  type AdaptiveSessionState,
  type SessionConfig,
  type BatchState,
  type SentenceQuestion,
} from '@gll/srs-engine-v2';
import { evaluateShelving } from '@gll/srs-shelving';
import type { AppDeckPayload, GetDecksResponse } from '@gll/api-contract';
import { loadRunState, saveWordState, clearStore } from './composables/useStore';
import {
  loadShelvedWords,
  applyShelving,
  unshelveAll,
  updateStagnationCounters,
  getStagnantWords,
  resetStagnationCounters,
  getShelvingConfig,
} from './composables/useShelving';
import DeckSelector from './components/DeckSelector.vue';
import QuizCard from './components/QuizCard.vue';
import BatchResults, { type BatchSummary } from './components/BatchResults.vue';

const LAST_DECK_KEY = 'srs-demo-last-deck';

const apiError = ref<string | null>(null);

const appDecks = ref<AppDeckPayload[]>([]);
const wordPool = ref<QuizItem[]>([]);

type ConfigType = SessionConfig & {
  maxRetryPerWord: number;
  sentenceScheduling: { minSeenForSentence: number; sentenceBatchGap: number };
  sentenceGraduation: { sentenceCorrectStreakThreshold: number; sentenceWrongStreakThreshold: number };
  sentenceDirections: SentenceQuestion['direction'][];
};

const CONFIG = ref<ConfigType>({
  wordsPerBatch: 3,
  masteryThreshold: 2,
  streakThresholds: {
    correctStreakThreshold: 2,
    wrongStreakThreshold: 2,
    maxMastery: 2,
  },
  maxRetryPerSession: 5,
  maxRetryPerWord: 2,
  sentenceScheduling: {
    minSeenForSentence: 1,
    sentenceBatchGap: 2,
  },
  sentenceGraduation: {
    sentenceCorrectStreakThreshold: 2,
    sentenceWrongStreakThreshold: 3,
  },
  sentenceDirections: [
    'english-to-native',
    'romanization-to-native',
    'native-to-romanization',
  ],
});

type Screen = 'select' | 'quiz' | 'results';

const screen = ref<Screen>('select');
const hasSavedSession = ref(false);
const deckId = ref<string | null>(null);

const savedDeckName = computed(() => {
  if (!deckId.value) return null;
  return appDecks.value.find(d => d.id === deckId.value)?.topic ?? null;
});

// Adaptive session state refs
const sessionState = ref<AdaptiveSessionState | null>(null);
const globalRunState = ref<RunState>(new Map());
const batchState = ref<BatchState | null>(null);
const currentQuestion = ref<QuizQuestion | null>(null);

// Sentence state (in-memory only; not persisted in EP31)
const sentenceRunState = ref<SentenceRunState>(new Map());
const batchNum = ref(0);

const sentenceCorpus = computed(() => {
  const deck = appDecks.value.find((d) => d.id === deckId.value);
  if (!deck) return [];
  return deck.lines.map((line) => ({
    sentenceId: line.sentenceId,
    englishSentence: line.english,
    wordOrder: line.wordIds,
  }));
});

const defaultWordState = {
  wordId: '',
  seen: 0,
  correct: 0,
  mastery: 0,
  correctStreak: 0,
  wrongStreak: 0,
  lapses: 0,
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
  const deck = appDecks.value.find((d) => d.id === deckId.value);
  if (!deck) return [];
  return (deck.words as QuizItem[]).filter((w) => {
    const ws = currentRunState.value.get(w.id);
    return ws != null && isMastered(ws, CONFIG.value.masteryThreshold);
  });
});

const masteredGlobal = computed<QuizItem[]>(() =>
  wordPool.value.filter((w) => {
    const ws = currentRunState.value.get(w.id);
    return ws != null && isMastered(ws, CONFIG.value.masteryThreshold);
  }),
);

const completedDeckIds = ref<Set<string>>(new Set());

// Shelving state
const shelvedSet = ref<Set<string>>(new Set());

function recalculateCompletedDecks() {
  const completed = new Set<string>();
  for (const deck of appDecks.value) {
    const words = deck.words as QuizItem[];
    if (
      words.length > 0 &&
      words.every((w) => {
        const ws = currentRunState.value.get(w.id);
        return ws != null && isMastered(ws, CONFIG.value.masteryThreshold);
      })
    ) {
      completed.add(deck.id);
    }
  }
  completedDeckIds.value = completed;
}

const nextDeckId = computed<string | null>(() => {
  const idx = appDecks.value.findIndex((d) => d.id === deckId.value);
  return idx !== -1 && idx + 1 < appDecks.value.length ? appDecks.value[idx + 1].id : null;
});

const batchScore = ref({ correct: 0, total: 0 });
const summary = ref<BatchSummary[]>([]);
const questionKey = ref(0);

function getDeckWords(id: string): QuizItem[] {
  const deck = appDecks.value.find((d) => d.id === id);
  return deck ? (deck.words as QuizItem[]) : [];
}

function startBatch() {
  if (!sessionState.value) return;

  // Resolve eligible sentence contexts based on word seen counts and batch spacing
  const eligibleSentences = resolveEligibleContexts(
    sentenceCorpus.value,
    sessionState.value.runState,
    wordPool.value,
    sentenceRunState.value,
    batchNum.value,
    CONFIG.value.sentenceScheduling,
  );

  // One thunk per eligible sentence × configured direction
  const sentenceThunks = eligibleSentences.flatMap(({ ctx, tiles }) =>
    CONFIG.value.sentenceDirections.map(
      (dir) => () =>
        composeSentenceBatch(ctx, tiles, 'th').filter((q) => q.direction === dir),
    ),
  );

  // Assemble batch questions using the composer registry pattern internally
  const questions = assembleBatch(
    sessionState.value.active,
    wordPool.value,
    [], // foundationalPool is empty in this demo
    CONFIG.value.wordsPerBatch,
    { extraThunks: sentenceThunks, excludeIds: shelvedSet.value },
  );

  batchNum.value++;

  // Initialize serializable batch state
  batchState.value = initBatchState(
    questions,
    CONFIG.value.maxRetryPerWord,
    sessionState.value.sessionRetryCounts,
    CONFIG.value.maxRetryPerSession,
  );

  // Fetch the first question from the queue
  const { question, state: nextState } = nextQuestion(batchState.value);
  batchState.value = nextState;
  currentQuestion.value = question;
  questionKey.value++;

  screen.value = 'quiz';
}

async function initSession(id: string, isNewSession = true) {
  deckId.value = id;
  localStorage.setItem(LAST_DECK_KEY, id);
  const allWords = getDeckWords(id);

  if (isNewSession) {
    // New session: clear shelving + stagnation state
    shelvedSet.value = new Set();
    await Promise.all([
      unshelveAll({ deckId: id }).catch(console.error),
      resetStagnationCounters({ deckId: id }).catch(console.error),
    ]);
  }
  // On resume (isNewSession=false), shelvedSet is already populated by onMounted or onResume

  // Exclude already-mastered words so they don't fill the active pool on re-entry
  const words = allWords.filter((w) => {
    const ws = globalRunState.value.get(w.id);
    return ws == null || !isMastered(ws, CONFIG.value.masteryThreshold);
  });

  // Initialize adaptive session
  sessionState.value = initAdaptiveSession(
    words,
    CONFIG.value,
    new Set(),
    globalRunState.value,
  );

  startBatch();
}

function onSelect(id: string) {
  void initSession(id);
}

async function onResume() {
  apiError.value = null;
  let runState: RunState;
  try {
    runState = await loadRunState();
  } catch {
    apiError.value = 'Could not reach the server. Please check that it is running and try again.';
    return;
  }
  globalRunState.value = runState;
  const savedDeckId = localStorage.getItem(LAST_DECK_KEY);
  if (!savedDeckId) return;
  deckId.value = savedDeckId;
  // Load shelved words before initSession so shelvedSet is correct for the resumed session
  try {
    const shelvedWords = await loadShelvedWords(savedDeckId);
    shelvedSet.value = new Set(shelvedWords.map((sw) => sw.wordId));
  } catch { /* non-fatal */ }
  await initSession(savedDeckId, false);
}

async function onClear() {
  await clearStore();
  localStorage.removeItem(LAST_DECK_KEY);
  hasSavedSession.value = false;
  deckId.value = null;
  sessionState.value = null;
  globalRunState.value = new Map();
  sentenceRunState.value = new Map();
  shelvedSet.value = new Set();
  batchNum.value = 0;
  batchState.value = null;
  currentQuestion.value = null;
  recalculateCompletedDecks();
  screen.value = 'select';
}

async function finishBatchAndTransition() {
  if (!sessionState.value || !batchState.value) return;

  const output = finishBatch(batchState.value);
  const prevState = sessionState.value.runState;

  // Advance adaptive session state via the orchestrator
  sessionState.value = advanceAdaptiveSession(sessionState.value, output, CONFIG.value);
  globalRunState.value = sessionState.value.runState;

  // Persist updated word states (write-on-answer)
  const wordResults = output.results.filter(
    (r): r is WordQuizResult => 'wordId' in r,
  );
  const uniqueWordIds = [...new Set(wordResults.map((r) => r.wordId))];
  for (const wid of uniqueWordIds) {
    const ws = sessionState.value.runState.get(wid);
    if (ws) saveWordState(ws).catch(console.error);
  }

  // DS02 shelving pipeline: stagnation detection via persistent DB counters.
  if (deckId.value) {
    const activeIds = sessionState.value.active.map((w) => w.id);
    await updateStagnationCounters({ deckId: deckId.value, activeWordIds: activeIds }).catch(console.error);
    const shelvingConfig = await getShelvingConfig();
    const stagnantIds = await getStagnantWords(deckId.value, shelvingConfig.stagnationBatchWindow).catch(() => [] as string[]);
    const decision = evaluateShelving(stagnantIds, shelvedSet.value, shelvingConfig);
    if (decision.toShelve.length > 0) {
      await applyShelving({ deckId: deckId.value, toShelve: decision.toShelve.map((id: string) => ({ wordId: id, batchNum: batchNum.value })) }).catch(console.error);
      decision.toShelve.forEach((id: string) => shelvedSet.value.add(id));
    }
  }

  // Determine newly mastered words in this specific batch
  const newlyMasteredIds = getNewlyMasteredIds(
    prevState,
    sessionState.value.runState,
    uniqueWordIds,
    CONFIG.value.masteryThreshold,
  );

  const correct = output.results.filter((a) => a.correct).length;
  batchScore.value = { correct, total: output.results.length };

  const deckWordMap = new Map(getDeckWords(deckId.value ?? '').map((w) => [w.id, w]));
  summary.value = uniqueWordIds.map((wid) => ({
    wordId: wid,
    native: deckWordMap.get(wid)?.native ?? wid,
    state: sessionState.value!.runState.get(wid) ?? { ...defaultWordState, wordId: wid },
    newlyMastered: newlyMasteredIds.includes(wid),
  }));

  recalculateCompletedDecks();

  screen.value = 'results';
}

function onAnswered(result: QuizResult) {
  if (!batchState.value) return;

  // Update sentence run state immediately on answer
  if ('sentenceId' in result) {
    updateSentenceRunState(
      sentenceRunState.value,
      [result as SentenceQuizResult],
      batchNum.value,
      CONFIG.value.sentenceGraduation,
    );
  }

  // Submit result to serializable batch state
  batchState.value = submitBatchResult(batchState.value, result);

  if (isBatchDone(batchState.value)) {
    void finishBatchAndTransition();
  } else {
    // Pull the next question
    const { question, state: nextState } = nextQuestion(batchState.value);
    batchState.value = nextState;
    currentQuestion.value = question;
    questionKey.value++;
  }
}

function onExitBatch() {
  if (!batchState.value || batchState.value.results.length === 0) {
    screen.value = 'select';
    return;
  }
  void finishBatchAndTransition();
}

function onNext() {
  startBatch();
}

function onSelectDeck() {
  screen.value = 'select';
}

function onNextDeck(id: string) {
  void initSession(id);
}

onMounted(async () => {
  // Fetch decks from API first — required before any other initialisation
  try {
    const decksRes = await fetch('/api/decks');
    if (!decksRes.ok) throw new Error(`GET /api/decks failed: ${decksRes.status}`);
    const decksBody = (await decksRes.json()) as { success: true; data: GetDecksResponse };
    appDecks.value = decksBody.data;

    // Build flat, deduplicated word pool across all decks
    const seen = new Set<string>();
    const pool: QuizItem[] = [];
    for (const deck of appDecks.value) {
      for (const word of deck.words) {
        if (!seen.has(word.id)) {
          seen.add(word.id);
          pool.push(word as QuizItem);
        }
      }
    }
    wordPool.value = pool;
  } catch {
    apiError.value = 'Could not reach the server. Please check that it is running and try again.';
    return;
  }

  let runState: RunState;
  try {
    runState = await loadRunState();
  } catch {
    apiError.value = 'Could not reach the server. Please check that it is running and try again.';
    recalculateCompletedDecks();
    return;
  }
  if (runState.size > 0) {
    hasSavedSession.value = true;
    globalRunState.value = runState;
    deckId.value = localStorage.getItem(LAST_DECK_KEY);
  }

  // Load persisted shelved words for the last active deck on mount
  const savedDeckId = localStorage.getItem(LAST_DECK_KEY);
  if (savedDeckId) {
    try {
      const shelvedWords = await loadShelvedWords(savedDeckId);
      shelvedSet.value = new Set(shelvedWords.map((sw) => sw.wordId));
    } catch {
      // Non-fatal: shelving state will be empty
    }
  }

  // Load sentence config override for tests
  try {
    const res = await fetch('/api/test/config/sentence');
    if (res.ok) {
      const body = (await res.json()) as { success: boolean; data: object | null };
      if (body.success && body.data) {
        const override = body.data as Partial<typeof CONFIG.value>;
        CONFIG.value = {
          ...CONFIG.value,
          ...override,
          sentenceScheduling: { ...CONFIG.value.sentenceScheduling, ...override.sentenceScheduling },
          sentenceGraduation: { ...CONFIG.value.sentenceGraduation, ...override.sentenceGraduation },
        };
      }
    }
  } catch {
    // Non-fatal: use default config
  }

  recalculateCompletedDecks();
});
</script>

<template>
  <div v-if="apiError" class="api-error" role="alert">
    {{ apiError }}
  </div>

  <DeckSelector
    v-if="screen === 'select'"
    :decks="appDecks"
    :has-saved-session="hasSavedSession"
    :saved-deck-id="deckId"
    :saved-deck-name="savedDeckName"
    :completed-deck-ids="completedDeckIds"
    @select="onSelect"
    @resume="onResume"
    @clear="onClear"
  />

  <QuizCard
    v-else-if="screen === 'quiz' && currentQuestion && batchState"
    :key="questionKey"
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

<style scoped>
.api-error {
  max-width: 480px;
  margin: 24px auto;
  padding: 12px 16px;
  background: #fef2f2;
  color: #b91c1c;
  border: 1px solid #fca5a5;
  border-radius: 8px;
  font-size: 0.95rem;
  text-align: center;
}
</style>
