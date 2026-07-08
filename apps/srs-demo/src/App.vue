<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import {
  assembleBatch,
  initAdaptiveSession,
  advanceAdaptiveSession,
  classifyRechecks,
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
  nextActivePool,
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
import { loadRunState, postAnswer, clearStore } from './composables/useStore';
import {
  loadShelvedWords,
  applyShelving,
  unshelveAll,
  updateStagnationCounters,
  getStagnantWords,
  resetStagnationCounters,
  getShelvingConfig,
} from './composables/useShelving';
import {
  logDeckStarted,
  logBatchStarted,
  logBatchQuestions,
  logBatchResult,
  flushLogs as flushDebugLogs,
  clearLogs,
} from './composables/useQuizDebugLog';
import DeckSelector from './components/DeckSelector.vue';
import QuizCard from './components/QuizCard.vue';
import BatchResults, { type BatchSummary } from './components/BatchResults.vue';
import DeckOverview from './components/DeckOverview.vue';

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

type Screen = 'select' | 'quiz' | 'results' | 'overview';

const screen = ref<Screen>('select');
const hasSavedSession = ref(false);
const deckId = ref<string | null>(null);
const overviewDeckId = ref<string | null>(null);

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

async function applyShelvingDecisions(
  deckIdParam: string,
  activeIds: string[],
  batchNumParam: number,
  shelvedSetParam: Set<string>,
): Promise<{ newShelvedSet: Set<string> }> {
  const shelvingConfig = await getShelvingConfig();
  const stagnantIds = await getStagnantWords(
    deckIdParam,
    shelvingConfig.stagnationBatchWindow,
  ).catch(() => [] as string[]);
  const decision = evaluateShelving(stagnantIds, shelvedSetParam, shelvingConfig);

  if (decision.toShelve.length > 0) {
    const toShelvePayload = decision.toShelve.map((id: string) => ({
      wordId: id,
      batchNum: batchNumParam,
    }));
    console.log('[SHELVING] Applying shelving:', {
      deckId: deckIdParam,
      toShelve: toShelvePayload,
    });
    try {
      await applyShelving({ deckId: deckIdParam, toShelve: toShelvePayload });
      console.log('[SHELVING] Successfully persisted to DB');
    } catch (err) {
      console.error('[SHELVING] Failed to persist:', err);
    }
    decision.toShelve.forEach((id: string) => shelvedSetParam.add(id));
  }

  return { newShelvedSet: shelvedSetParam };
}

const shelvedItems = computed<QuizItem[]>(() => {
  if (!deckId.value) return [];
  const allWords = getDeckWords(deckId.value);
  return allWords.filter((w) => shelvedSet.value.has(w.id));
});

function startBatch() {
  if (!sessionState.value) return;

  // Log batch start with pool state, word states, and shelved status
  logBatchStarted(wordPool.value.length, wordPool.value, batchNum.value + 1, sessionState.value.runState, shelvedSet.value);

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

  // Log questions served in this batch
  logBatchQuestions(batchNum.value, questions, questions.length);

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
    clearLogs();
    shelvedSet.value = new Set();
    await Promise.all([
      unshelveAll({ deckId: id }).catch(console.error),
      resetStagnationCounters({ deckId: id }).catch(console.error),
    ]);
  }
  // On resume (isNewSession=false), shelvedSet is already populated by onMounted or onResume

  // Exclude already-mastered words so they don't fill the active pool on re-entry
  // Also exclude shelved words on resume
  const words = allWords.filter((w) => {
    const ws = globalRunState.value.get(w.id);
    const isMasteredWord = ws != null && isMastered(ws, CONFIG.value.masteryThreshold);
    const isShelvedWord = shelvedSet.value.has(w.id);
    return !isMasteredWord && !isShelvedWord;
  });

  // Initialize adaptive session
  sessionState.value = initAdaptiveSession(
    words,
    CONFIG.value,
    new Set(),
    globalRunState.value,
  );

  // Log deck start with pool state, word states, and shelved status
  logDeckStarted(words.length, words, globalRunState.value, shelvedSet.value);

  startBatch();
}

function onSelect(id: string) {
  void initSession(id);
}

function onOverview(id: string) {
  overviewDeckId.value = id;
  screen.value = 'overview';
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

  const wordResults = output.results.filter(
    (r): r is WordQuizResult => 'wordId' in r,
  );
  // Recheck flags derived from the PRE-advance recheckPending — the same guard
  // advanceAdaptiveSession folds through, so the server reproduces the client's
  // WordState exactly (mastery frozen on a re-asked miss).
  const recheckFlags = classifyRechecks(wordResults, sessionState.value.recheckPending);

  // Advance adaptive session state via the orchestrator (pools/recheck/shelving
  // stay client-side; the server owns persisted WordState).
  sessionState.value = advanceAdaptiveSession(sessionState.value, output, CONFIG.value);
  globalRunState.value = sessionState.value.runState;

  const uniqueWordIds = [...new Set(wordResults.map((r) => r.wordId))];

  // Server-authoritative persistence: replay each answer through /api/answer in
  // order and adopt the returned canonical WordState. `confirmed` tracks what the
  // server has actually persisted (seeded from the pre-advance state); on a failed
  // POST we revert that word to its last confirmed value so local state never
  // advances past the DB, and surface the error rather than silently dropping it.
  const confirmed = new Map(prevState);
  let persistFailed = false;
  for (let i = 0; i < wordResults.length; i++) {
    const r = wordResults[i];
    try {
      const authoritative = await postAnswer({
        wordId: r.wordId,
        correct: r.correct,
        latencyMs: 0,
        recheck: recheckFlags[i],
      });
      confirmed.set(r.wordId, authoritative);
      sessionState.value.runState.set(r.wordId, authoritative);
    } catch (err) {
      console.error('[ANSWER] persistence failed for', r.wordId, err);
      persistFailed = true;
      const good = confirmed.get(r.wordId);
      if (good) sessionState.value.runState.set(r.wordId, good);
      else sessionState.value.runState.delete(r.wordId);
    }
  }
  if (persistFailed) {
    apiError.value = 'Could not save some answers. Your latest progress may not be recorded — please check the server and try again.';
  }

  // DS02 shelving pipeline: stagnation detection via persistent DB counters.
  if (deckId.value) {
    const activeIds = sessionState.value.active.map((w) => w.id);
    await updateStagnationCounters({ deckId: deckId.value, activeWordIds: activeIds }).catch(console.error);
    const shelvingConfig = await getShelvingConfig();
    const stagnantIds = await getStagnantWords(deckId.value, shelvingConfig.stagnationBatchWindow).catch(() => [] as string[]);
    const decision = evaluateShelving(stagnantIds, shelvedSet.value, shelvingConfig);
    if (decision.toShelve.length > 0) {
      const toShelvePayload = decision.toShelve.map((id: string) => ({ wordId: id, batchNum: batchNum.value }));
      console.log('[SHELVING] Applying shelving:', { deckId: deckId.value, toShelve: toShelvePayload });
      try {
        await applyShelving({ deckId: deckId.value, toShelve: toShelvePayload });
        console.log('[SHELVING] Successfully persisted to DB');
      } catch (err) {
        console.error('[SHELVING] Failed to persist:', err);
      }
      decision.toShelve.forEach((id: string) => shelvedSet.value.add(id));

      // Rebalance active pool: remove shelved words and pull new ones from queue
      const shelvingSet = new Set(decision.toShelve);
      const newActive = sessionState.value.active.filter((w) => !shelvingSet.has(w.id));
      const newQueue = sessionState.value.queue.filter((w) => !shelvingSet.has(w.id));

      const { active, queue } = nextActivePool(
        newActive,
        newQueue,
        CONFIG.value.wordsPerBatch,
        sessionState.value.runState,
        CONFIG.value.masteryThreshold,
        new Set([...sessionState.value.recheckPending, ...sessionState.value.recheckReentered]),
      );

      sessionState.value.active = active;
      sessionState.value.queue = queue;
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

  // Log batch result and final pool state with word states and shelved status
  logBatchResult(batchNum.value, correct, output.results.length, wordPool.value.length, wordPool.value, sessionState.value.runState, shelvedSet.value);

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

async function flushLogs() {
  await flushDebugLogs();
  alert('Debug logs saved to manual-test-results');
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

function onUnshelveWord(dId: string, wId: string) {
  const newSet = new Set(shelvedSet.value);
  newSet.delete(wId);
  shelvedSet.value = newSet;
}

function onUpdateShelvedSet(newSet: Set<string>) {
  shelvedSet.value = newSet;
}

function onUpdateWordStates(wordStates: Map<string, any>) {
  for (const [wordId, state] of wordStates) {
    globalRunState.value.set(wordId, state);
  }
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
    @overview="onOverview"
  />

  <DeckOverview
    v-else-if="screen === 'overview' && overviewDeckId"
    :deck="appDecks.find(d => d.id === overviewDeckId)!"
    :run-state="globalRunState"
    :shelved-set="shelvedSet"
    :max-mastery="CONFIG.streakThresholds.maxMastery"
    :word-pool="wordPool"
    @back="screen = 'select'"
    @start-quiz="(id) => { void initSession(id, false); }"
    @unshelve-word="onUnshelveWord"
    @update-shelved-set="onUpdateShelvedSet"
    @update-word-states="onUpdateWordStates"
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
    :shelved-items="shelvedItems"
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
    :shelved-items="shelvedItems"
    @next="onNext"
    @select-deck="onSelectDeck"
    @next-deck="onNextDeck"
  />

  <div v-if="screen === 'results'" style="text-align: center; padding: 16px;">
    <button style="padding: 8px 16px; background: #6b7280; color: white; border: none; border-radius: 4px; cursor: pointer;" @click="flushLogs">
      💾 Save Debug Logs
    </button>
  </div>
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
