import { ref, computed, type Ref } from 'vue';
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
  type BatchState,
  type WordState,
} from '@gll/srs-engine-v2';
import { evaluateShelving } from '@gll/srs-shelving';
import type { AppDeckPayload } from '@gll/api-contract';
import { loadRunState, postAnswer, clearStore } from './useStore';
import {
  loadShelvedWords,
  applyShelving,
  unshelveAll,
  updateStagnationCounters,
  getStagnantWords,
  resetStagnationCounters,
  getShelvingConfig,
} from './useShelving';
import { useDebugRecording } from './useDebugRecording';
import type { BatchSummary } from '../components/BatchResults.vue';
import type { ConfigType } from '../types';

export const LAST_DECK_KEY = 'srs-demo-last-deck';

// Route params/query passed alongside a named route on navigate(); kept loose
// (not the full RouteLocationRaw) so this composable stays router-agnostic.
export type NavigateFn = (
  name: string,
  params?: Record<string, string>,
  query?: Record<string, string>,
) => void | Promise<void>;

export interface UseLearningSessionDeps {
  wordPool: Ref<QuizItem[]>;
  appDecks: Ref<AppDeckPayload[]>;
  CONFIG: Ref<ConfigType>;
  configReady: Ref<boolean>;
  apiError: Ref<string | null>;
  navigate: NavigateFn;
}

export function useLearningSession(deps: UseLearningSessionDeps) {
  const { wordPool, appDecks, CONFIG, configReady, apiError, navigate } = deps;

  const recorder = useDebugRecording();

  // Per-batch correlation ids in answer order, one per answered WORD question —
  // captured at answer time (when both the result and the served question's cid
  // are known) so the finish-time bulk POST can stitch each answer to the exact
  // question that produced it. Word-only, so it aligns 1:1 with `wordResults`.
  let wordCids: (string | null)[] = [];

  const hasSavedSession = ref(false);
  const deckId = ref<string | null>(null);

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

  // Issue a correlation id for a served question (no-op unless recording) and
  // record the serve as read-only appearance context. One id per served question
  // is the finest scope the transition channel keys on.
  function serveCorrelation(question: QuizQuestion | null): void {
    if (!question) return;
    const cid = recorder.nextCorrelationId();
    recorder.recordAppearance({
      correlationId: cid || null,
      kind: 'question-served',
      data:
        question.kind === 'mcq'
          ? { wordId: question.wordId, direction: question.direction, kind: question.kind }
          : { sentenceId: question.sentenceId, direction: question.direction, kind: question.kind },
    });
  }

  // Record an active-pool selection (initAdaptiveSession / post-shelving rebalance)
  // as read-only appearance context, stitched to the current served question.
  function recordPoolSelected(active: QuizItem[], queue: QuizItem[]): void {
    recorder.recordAppearance({
      correlationId: recorder.currentCorrelationId(),
      kind: 'pool-selected',
      data: { active: active.map((w) => w.id), queue: queue.map((w) => w.id) },
    });
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
      shelvedSet.value,
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

    // A fresh batch consumes a fresh answer→cid stitch list (finishBatch's
    // results are per-batch, so wordCids must be too).
    wordCids = [];

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
    serveCorrelation(question);

    void navigate('quiz', deckId.value ? { deckId: deckId.value } : undefined);
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

    // Appearance context: the initial active-pool selection (before any serve).
    recordPoolSelected(sessionState.value.active, sessionState.value.queue);

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
    void navigate('select');
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

    // Appearance context: a re-asked missed word is a recheck trigger, stitched to
    // the served question that produced this answer (wordCids aligns with wordResults).
    recheckFlags.forEach((isRecheck, i) => {
      if (!isRecheck) return;
      recorder.recordAppearance({
        correlationId: wordCids[i] ?? null,
        kind: 'recheck-triggered',
        data: { wordId: wordResults[i].wordId },
      });
    });

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
        const authoritative = await postAnswer(
          {
            wordId: r.wordId,
            correct: r.correct,
            latencyMs: 0,
            recheck: recheckFlags[i],
          },
          wordCids[i],
        );
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

        // Appearance context: which words were shelved this batch (read-only).
        recorder.recordAppearance({
          correlationId: recorder.currentCorrelationId(),
          kind: 'shelving',
          data: { shelved: [...decision.toShelve] },
        });

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

        // Appearance context: the post-shelving active-pool re-selection.
        recordPoolSelected(active, queue);
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

    void navigate('results');
  }

  function onAnswered(result: QuizResult) {
    if (!batchState.value) return;

    // Stitch this answer to the served question's correlation id. Captured here,
    // in answer order, only for WORD answers (the transition channel) — sentence
    // answers do not hit /api/answer (ADR D4).
    if ('wordId' in result) {
      wordCids.push(recorder.currentCorrelationId());
    }

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
      serveCorrelation(question);
    }
  }

  function onExitBatch() {
    if (!batchState.value || batchState.value.results.length === 0) {
      void navigate('select');
      return;
    }
    void finishBatchAndTransition();
  }

  function onNext() {
    startBatch();
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

  function onUpdateWordStates(wordStates: Map<string, WordState>) {
    for (const [wordId, state] of wordStates) {
      globalRunState.value.set(wordId, state);
    }
  }

  return {
    // state
    sessionState,
    globalRunState,
    batchState,
    currentQuestion,
    batchNum,
    sentenceRunState,
    deckId,
    hasSavedSession,
    shelvedSet,
    completedDeckIds,
    batchScore,
    summary,
    questionKey,
    // computed
    savedDeckName,
    activeItems,
    queue,
    masteredDeck,
    masteredGlobal,
    nextDeckId,
    shelvedItems,
    // functions
    recalculateCompletedDecks,
    getDeckWords,
    startBatch,
    initSession,
    onSelect,
    onResume,
    onClear,
    finishBatchAndTransition,
    onAnswered,
    onExitBatch,
    onNext,
    onNextDeck,
    onUnshelveWord,
    onUpdateShelvedSet,
    onUpdateWordStates,
  };
}
