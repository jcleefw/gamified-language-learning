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
import type {
  AppDeckPayload,
  GetDecksResponse,
  DueReviewItem,
  ReviewQuestionType,
} from '@gll/api-contract';
import {
  loadRunState,
  postAnswer,
  clearStore,
  loadConfig,
  loadDueReviews,
  postReviewAnswer,
} from './composables/useStore';
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
import HomeDashboard from './components/HomeDashboard.vue';
import ReviewSummary from './components/ReviewSummary.vue';
import NavMenu from './components/NavMenu.vue';

const LAST_DECK_KEY = 'srs-demo-last-deck';

const apiError = ref<string | null>(null);

const appDecks = ref<AppDeckPayload[]>([]);
const wordPool = ref<QuizItem[]>([]);

type ConfigType = SessionConfig & {
  maxRetryPerWord: number;
  sentenceScheduling: { minSeenForSentence: number; sentenceBatchGap: number };
  sentenceGraduation: {
    sentenceCorrectStreakThreshold: number;
    sentenceWrongStreakThreshold: number;
  };
  sentenceDirections: SentenceQuestion['direction'][];
};

// No config is declared in the FE. The whole surface is fetched read-only from
// GET /api/config at boot (see EP37-DS05 + the Config Ownership ADR). Until then
// CONFIG is empty; `configReady` gates session start so nothing runs the engine
// with unset config (fail-closed — no hardcoded fallback).
const CONFIG = ref<ConfigType>({} as ConfigType);
const configReady = ref(false);

type Screen = 'home' | 'select' | 'quiz' | 'results' | 'overview' | 'review';

const screen = ref<Screen>('home');
const hasSavedSession = ref(false);
const deckId = ref<string | null>(null);
const overviewDeckId = ref<string | null>(null);

// --- Review mode (EP38-DS02) — pool-global session; the client is a dumb
// terminal: it renders questions, self-reports facts, and adopts the schedule
// the server returns. It computes no rating and no `due`, and imports no FSRS
// scheduler. ---
const dueReviews = ref<DueReviewItem[]>([]); // from GET /api/reviews
const dueReviewCount = ref<number | null>(null); // badge; null until fetched
const badgeError = ref(false); // due-count fetch failed (never masquerade as "caught up")
const reviewBatchState = ref<BatchState | null>(null);
const reviewQuestion = ref<QuizQuestion | null>(null);
const reviewShownAt = ref<number>(0); // latency start for the current review question
const reviewQuestionKey = ref(0);
const reviewCaughtUp = ref(false); // nothing was due on entry
const reviewSummary = ref<{ reviewed: number; nextDue: string | null }>({
  reviewed: 0,
  nextDue: null,
});

const savedDeckName = computed(() => {
  if (!deckId.value) return null;
  return appDecks.value.find((d) => d.id === deckId.value)?.topic ?? null;
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
  return sessionState.value
    ? sessionState.value.runState
    : globalRunState.value;
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

// Review unlock gate — purely local truth; no server call. Epic: "locked until
// any word is mastered." Fail-closed when config isn't ready (no threshold to test).
const reviewUnlocked = computed(
  () =>
    configReady.value &&
    [...globalRunState.value.values()].some((ws) =>
      isMastered(ws, CONFIG.value.masteryThreshold),
    ),
);

// wordId → QuizItem resolution against the already-preloaded, cross-deck
// wordPool. Orphans (word deleted; no pool match) are skipped, not errored —
// pillar-3 tolerance carried through the UI.
function resolveDueItems(reviews: DueReviewItem[]): QuizItem[] {
  const byId = new Map(wordPool.value.map((w) => [w.id, w]));
  return reviews
    .map((r) => byId.get(r.wordId))
    .filter((w): w is QuizItem => w != null);
}

// ReviewQuestionType mirrors QuizQuestion.kind, so the client reports what was
// shown as-is — no mapping/renaming (a DS01 wire fact, not policy).
function toReviewQuestionType(q: QuizQuestion): ReviewQuestionType {
  return q.kind;
}

// --- Top nav menu (EP38-ST08) ---
// Which top-level destination the current screen belongs to (for highlighting).
const activeNav = computed<'home' | 'learn' | 'review'>(() => {
  if (screen.value === 'home') return 'home';
  if (screen.value === 'review') return 'review';
  return 'learn'; // 'select' | 'quiz' | 'results' | 'overview'
});

// Navigate from the always-visible nav menu. The nav is shown on every screen,
// so leaving an active Learning quiz mid-batch must not silently drop answers:
// Learning persists on batch finish (not per-answer), so flush the partial batch
// first (same path as Exit). Review is write-on-answer — each answered card is
// already durable — so no flush is needed there.
async function navTo(target: 'home' | 'select' | 'review') {
  if (
    screen.value === 'quiz' &&
    batchState.value &&
    batchState.value.results.length > 0
  ) {
    await finishBatchAndTransition(); // persists the answered results
  }
  if (target === 'review') {
    void onReview();
    return;
  }
  screen.value = target;
}

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
  return idx !== -1 && idx + 1 < appDecks.value.length
    ? appDecks.value[idx + 1].id
    : null;
});

const batchScore = ref({ correct: 0, total: 0 });
const summary = ref<BatchSummary[]>([]);
const questionKey = ref(0);

// Guards finishBatchAndTransition against re-entrant invocation (e.g. Exit
// clicked while the last answer's /api/answer replay is still in flight) —
// a second concurrent run would double-POST the same answers.
const isFinishingBatch = ref(false);

function getDeckWords(id: string): QuizItem[] {
  const deck = appDecks.value.find((d) => d.id === id);
  return deck ? (deck.words as QuizItem[]) : [];
}

const shelvedItems = computed<QuizItem[]>(() => {
  if (!deckId.value) return [];
  const allWords = getDeckWords(deckId.value);
  return allWords.filter((w) => shelvedSet.value.has(w.id));
});

function startBatch() {
  if (!sessionState.value) return;

  // Log batch start with pool state, word states, and shelved status
  logBatchStarted(
    wordPool.value.length,
    wordPool.value,
    batchNum.value + 1,
    sessionState.value.runState,
    shelvedSet.value,
  );

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
        composeSentenceBatch(ctx, tiles, 'th').filter(
          (q) => q.direction === dir,
        ),
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
  // Fail-closed: never run the engine without server-sourced config.
  if (!configReady.value) {
    apiError.value =
      'Learning settings are not loaded yet. Please check the server and try again.';
    return;
  }
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
    const isMasteredWord =
      ws != null && isMastered(ws, CONFIG.value.masteryThreshold);
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
  // Fail-closed: DeckOverview reads CONFIG.value.streakThresholds.maxMastery.
  if (!configReady.value) {
    apiError.value =
      'Learning settings are not loaded yet. Please check the server and try again.';
    return;
  }
  overviewDeckId.value = id;
  screen.value = 'overview';
}

async function onResume() {
  apiError.value = null;
  let runState: RunState;
  try {
    runState = await loadRunState();
  } catch {
    apiError.value =
      'Could not reach the server. Please check that it is running and try again.';
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
  } catch {
    /* non-fatal */
  }
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
  if (isFinishingBatch.value) return;
  isFinishingBatch.value = true;
  try {
    await finishBatchAndTransitionImpl();
  } finally {
    isFinishingBatch.value = false;
  }
}

async function finishBatchAndTransitionImpl() {
  if (!sessionState.value || !batchState.value) return;

  const output = finishBatch(batchState.value);
  const prevState = sessionState.value.runState;

  const wordResults = output.results.filter(
    (r): r is WordQuizResult => 'wordId' in r,
  );
  // Recheck flags derived from the PRE-advance recheckPending — the same guard
  // advanceAdaptiveSession folds through, so the server reproduces the client's
  // WordState exactly (mastery frozen on a re-asked miss).
  const recheckFlags = classifyRechecks(
    wordResults,
    sessionState.value.recheckPending,
  );

  // Advance adaptive session state via the orchestrator (pools/recheck/shelving
  // stay client-side; the server owns persisted WordState).
  sessionState.value = advanceAdaptiveSession(
    sessionState.value,
    output,
    CONFIG.value,
  );
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
    apiError.value =
      'Could not save some answers. Your latest progress may not be recorded — please check the server and try again.';
  }

  // DS02 shelving pipeline: stagnation detection via persistent DB counters.
  if (deckId.value) {
    const activeIds = sessionState.value.active.map((w) => w.id);
    await updateStagnationCounters({
      deckId: deckId.value,
      activeWordIds: activeIds,
    }).catch(console.error);
    const shelvingConfig = await getShelvingConfig();
    const stagnantIds = await getStagnantWords(
      deckId.value,
      shelvingConfig.stagnationBatchWindow,
    ).catch(() => [] as string[]);
    const decision = evaluateShelving(
      stagnantIds,
      shelvedSet.value,
      shelvingConfig,
    );
    if (decision.toShelve.length > 0) {
      const toShelvePayload = decision.toShelve.map((id: string) => ({
        wordId: id,
        batchNum: batchNum.value,
      }));
      console.log('[SHELVING] Applying shelving:', {
        deckId: deckId.value,
        toShelve: toShelvePayload,
      });
      try {
        await applyShelving({
          deckId: deckId.value,
          toShelve: toShelvePayload,
        });
        console.log('[SHELVING] Successfully persisted to DB');
      } catch (err) {
        console.error('[SHELVING] Failed to persist:', err);
      }
      decision.toShelve.forEach((id: string) => shelvedSet.value.add(id));

      // Rebalance active pool: remove shelved words and pull new ones from queue
      const shelvingSet = new Set(decision.toShelve);
      const newActive = sessionState.value.active.filter(
        (w) => !shelvingSet.has(w.id),
      );
      const newQueue = sessionState.value.queue.filter(
        (w) => !shelvingSet.has(w.id),
      );

      const { active, queue } = nextActivePool(
        newActive,
        newQueue,
        CONFIG.value.wordsPerBatch,
        sessionState.value.runState,
        CONFIG.value.masteryThreshold,
        new Set([
          ...sessionState.value.recheckPending,
          ...sessionState.value.recheckReentered,
        ]),
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
  logBatchResult(
    batchNum.value,
    correct,
    output.results.length,
    wordPool.value.length,
    wordPool.value,
    sessionState.value.runState,
    shelvedSet.value,
  );

  const deckWordMap = new Map(
    getDeckWords(deckId.value ?? '').map((w) => [w.id, w]),
  );
  summary.value = uniqueWordIds.map((wid) => ({
    wordId: wid,
    native: deckWordMap.get(wid)?.native ?? wid,
    state: sessionState.value!.runState.get(wid) ?? {
      ...defaultWordState,
      wordId: wid,
    },
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

// --- Review handlers (EP38-DS02) ---

function onLearn() {
  screen.value = 'select';
}

// Enter a pool-global review session. Refreshes due cards (also keeps the badge
// honest), resolves them against wordPool (skipping orphans), and builds
// questions via the same pipeline Learning uses. An empty due list shows the
// caught-up state rather than an error.
async function onReview() {
  apiError.value = null;
  let reviews: DueReviewItem[];
  try {
    reviews = await loadDueReviews();
  } catch {
    // Gate is local truth; a failed fetch must surface, not fake "caught up".
    badgeError.value = true;
    apiError.value =
      'Could not load your reviews. Please check that the server is running and try again.';
    return; // stay on home
  }
  dueReviews.value = reviews;
  dueReviewCount.value = reviews.length;
  badgeError.value = false;

  reviewSummary.value = { reviewed: 0, nextDue: null };
  reviewBatchState.value = null;
  reviewQuestion.value = null;

  const items = resolveDueItems(reviews);
  if (items.length === 0) {
    reviewCaughtUp.value = true;
    screen.value = 'review';
    return;
  }
  reviewCaughtUp.value = false;

  // Same pipeline/UI as Learning; distractors come from the full cross-deck
  // wordPool. Retries disabled (0) so each due word is asked exactly once.
  const questions = assembleBatch(items, wordPool.value, [], items.length, {
    excludeIds: new Set<string>(),
  });
  reviewBatchState.value = initBatchState(questions, 0, new Map(), 0);
  const { question, state } = nextQuestion(reviewBatchState.value);
  reviewBatchState.value = state;
  reviewQuestion.value = question;
  reviewShownAt.value = performance.now();
  reviewQuestionKey.value++;
  screen.value = 'review';
}

function advanceReviewQueue(result: QuizResult) {
  if (!reviewBatchState.value) return;
  reviewBatchState.value = submitBatchResult(reviewBatchState.value, result);
  if (isBatchDone(reviewBatchState.value)) {
    reviewQuestion.value = null; // → summary sub-state on the 'review' screen
  } else {
    const { question, state } = nextQuestion(reviewBatchState.value);
    reviewBatchState.value = state;
    reviewQuestion.value = question;
    reviewShownAt.value = performance.now();
    reviewQuestionKey.value++;
  }
}

async function onReviewAnswered(result: QuizResult) {
  if (!reviewBatchState.value || !reviewQuestion.value) return;
  const questionType = toReviewQuestionType(reviewQuestion.value);

  // Review only generates word MCQs (word items, no sentence thunks). Guard a
  // stray sentence result rather than POST a malformed request.
  if (!('wordId' in result)) {
    advanceReviewQueue(result);
    return;
  }

  const latencyMs = Math.max(0, Math.round(performance.now() - reviewShownAt.value));
  let res;
  try {
    res = await postReviewAnswer({
      wordId: result.wordId,
      correct: result.correct,
      latencyMs,
      questionType,
    });
  } catch (err) {
    // DS01 leaves the card unchanged on error; do not advance past this word or
    // fake success — surface it (write-on-answer contract).
    console.error('[REVIEW] answer persistence failed for', result.wordId, err);
    apiError.value =
      'Could not save your review answer. Your progress may not be recorded — please check the server and try again.';
    return;
  }

  // Adopt the server-returned schedule for the summary horizon (no client math).
  reviewSummary.value.reviewed++;
  const prev = reviewSummary.value.nextDue;
  if (prev === null || new Date(res.due).getTime() < new Date(prev).getTime()) {
    reviewSummary.value.nextDue = res.due;
  }

  advanceReviewQueue(result);
}

function onReviewExit() {
  // Already-answered advances are durable server-side; re-entry reloads only the
  // still-due cards (partial-session resume).
  screen.value = 'home';
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
    if (!decksRes.ok)
      throw new Error(`GET /api/decks failed: ${decksRes.status}`);
    const decksBody = (await decksRes.json()) as {
      success: true;
      data: GetDecksResponse;
    };
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
    apiError.value =
      'Could not reach the server. Please check that it is running and try again.';
    return;
  }

  // Config is server-owned — fetch the whole surface before anything reads it
  // (completed-deck detection, session init). Fail closed: no session without it.
  try {
    const cfg = await loadConfig();
    CONFIG.value = { ...cfg.user, ...cfg.pedagogy };
    configReady.value = true;
  } catch {
    apiError.value =
      'Could not load learning settings. Please check that the server is running and try again.';
    return;
  }

  let runState: RunState;
  try {
    runState = await loadRunState();
  } catch {
    apiError.value =
      'Could not reach the server. Please check that it is running and try again.';
    recalculateCompletedDecks();
    return;
  }
  if (runState.size > 0) {
    hasSavedSession.value = true;
    globalRunState.value = runState;
    deckId.value = localStorage.getItem(LAST_DECK_KEY);
  }

  // Review due-count badge — only when unlocked (gate is local; badge needs the
  // route). A failed fetch flags badgeError so home shows a dash, never a false
  // "0 / caught up".
  if (reviewUnlocked.value) {
    try {
      const reviews = await loadDueReviews();
      dueReviews.value = reviews;
      dueReviewCount.value = reviews.length;
      badgeError.value = false;
    } catch {
      badgeError.value = true;
    }
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
      const body = (await res.json()) as {
        success: boolean;
        data: object | null;
      };
      if (body.success && body.data) {
        const override = body.data as Partial<typeof CONFIG.value>;
        CONFIG.value = {
          ...CONFIG.value,
          ...override,
          sentenceScheduling: {
            ...CONFIG.value.sentenceScheduling,
            ...override.sentenceScheduling,
          },
          sentenceGraduation: {
            ...CONFIG.value.sentenceGraduation,
            ...override.sentenceGraduation,
          },
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
  <NavMenu
    :active="activeNav"
    :review-unlocked="reviewUnlocked"
    :due-count="dueReviewCount"
    :badge-error="badgeError"
    @home="navTo('home')"
    @learn="navTo('select')"
    @review="navTo('review')"
  />

  <div v-if="apiError" class="api-error" role="alert">
    {{ apiError }}
  </div>

  <HomeDashboard
    v-if="screen === 'home'"
    :review-unlocked="reviewUnlocked"
    :due-count="dueReviewCount"
    :badge-error="badgeError"
    @learn="onLearn"
    @review="onReview"
  />

  <DeckSelector
    v-else-if="screen === 'select'"
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
    :deck="appDecks.find((d) => d.id === overviewDeckId)!"
    :run-state="globalRunState"
    :shelved-set="shelvedSet"
    :max-mastery="CONFIG.streakThresholds.maxMastery"
    :word-pool="wordPool"
    @back="screen = 'select'"
    @start-quiz="
      (id) => {
        void initSession(id, false);
      }
    "
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

  <!-- Review session: same QuizCard UI as Learning (D5 — no self-rating prompt).
       Three sub-states: active question, end-of-session summary, or caught-up. -->
  <template v-else-if="screen === 'review'">
    <QuizCard
      v-if="reviewQuestion && reviewBatchState"
      :key="reviewQuestionKey"
      :question="reviewQuestion"
      :index="reviewBatchState.results.length"
      :total="reviewBatchState.initialCount"
      :active-items="[]"
      :queue="[]"
      :mastered-deck="[]"
      @answered="onReviewAnswered"
      @exit="onReviewExit"
    />
    <ReviewSummary
      v-else
      :caught-up="reviewCaughtUp"
      :reviewed="reviewSummary.reviewed"
      :next-due="reviewSummary.nextDue"
      @home="onReviewExit"
    />
  </template>

  <div v-if="screen === 'results'" style="text-align: center; padding: 16px">
    <button
      style="
        padding: 8px 16px;
        background: #6b7280;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
      "
      @click="flushLogs"
    >
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
