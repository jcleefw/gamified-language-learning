import { type QuizQuestion, type QuizResult } from '../types/quiz.js';

/**
 * Output of a completed batch, containing results and updated retry tracking.
 */
export interface BatchOutput {
  results: QuizResult[];
  /** Maps word/sentence ID to the TOTAL number of retries it has used in the session so far. */
  sessionRetryCounts: Map<string, number>;
}

/**
 * Serializable state for a batch execution.
 * This should be owned by the host environment (e.g. Vue ref, CLI loop).
 */
export interface BatchState {
  queue: QuizQuestion[];
  results: QuizResult[];
  /** Tracks retries used EXCLUSIVELY within this batch instance. */
  batchRetryCounts: Map<string, number>;
  /** Caches the first instance of a question served to ensure identical retries (D11). */
  questionCache: Map<string, QuizQuestion>;
  /** Initial number of questions in the batch (for UI progress). */
  initialCount: number;
  // Config/Session constraints
  retryPerWordCap: number;
  retryPerSessionCap: number;
  sessionRetryCounts: Map<string, number>;
}

/**
 * Initializes a new batch state.
 */
export function initBatchState(
  initialQuestions: QuizQuestion[],
  retryPerWordCap: number,
  sessionRetryCounts: Map<string, number>,
  retryPerSessionCap: number,
): BatchState {
  return {
    queue: [...initialQuestions],
    results: [],
    batchRetryCounts: new Map(),
    questionCache: new Map(),
    initialCount: initialQuestions.length,
    retryPerWordCap,
    retryPerSessionCap,
    sessionRetryCounts: new Map(sessionRetryCounts),
  };
}

/**
 * Returns true if there are no more questions to serve in this batch.
 */
export function isBatchDone(state: BatchState): boolean {
  return state.queue.length === 0;
}

/**
 * Serves the next question from the queue.
 * Returns the question and the updated state.
 */
export function nextQuestion(state: BatchState): {
  question: QuizQuestion | null;
  state: BatchState;
} {
  if (state.queue.length === 0) {
    return { question: null, state };
  }

  const nextQueue = [...state.queue];
  const q = nextQueue.shift();
  if (!q) {
    return { question: null, state };
  }
  const id = getQuestionId(q);

  const nextCache = new Map(state.questionCache);
  if (!nextCache.has(id)) {
    nextCache.set(id, q);
  }

  const cached = nextCache.get(id) ?? q;
  return {
    question: cached,
    state: {
      ...state,
      queue: nextQueue,
      questionCache: nextCache,
    },
  };
}

/**
 * Submits a result for a question and returns the updated state.
 * If incorrect, re-enqueues the item if it hasn't hit retry caps.
 */
export function submitBatchResult(
  state: BatchState,
  result: QuizResult,
): BatchState {
  const nextResults = [...state.results, result];
  const nextQueue = [...state.queue];
  const nextBatchRetryCounts = new Map(state.batchRetryCounts);

  if (!result.correct) {
    const id = getResultId(result);
    const batchRetries = nextBatchRetryCounts.get(id) || 0;
    const totalSessionRetries = state.sessionRetryCounts.get(id) || 0;

    // Check both the per-batch cap and the per-session cap
    const canRetryInBatch = batchRetries < state.retryPerWordCap;
    const canRetryInSession = totalSessionRetries < state.retryPerSessionCap;

    if (canRetryInBatch && canRetryInSession) {
      const cached = state.questionCache.get(id);
      if (cached) {
        nextBatchRetryCounts.set(id, batchRetries + 1);
        nextQueue.push(cached);
      }
    }
  }

  return {
    ...state,
    results: nextResults,
    queue: nextQueue,
    batchRetryCounts: nextBatchRetryCounts,
  };
}

/**
 * Finalizes the batch, calculating the updated session-wide retry counts.
 */
export function finishBatch(state: BatchState): BatchOutput {
  const updatedSessionCounts = new Map(state.sessionRetryCounts);

  for (const [id, count] of state.batchRetryCounts.entries()) {
    const previousTotal = updatedSessionCounts.get(id) || 0;
    updatedSessionCounts.set(id, previousTotal + count);
  }

  return {
    results: state.results,
    sessionRetryCounts: updatedSessionCounts,
  };
}

function getQuestionId(q: QuizQuestion): string {
  return q.kind === 'mcq' ? q.wordId : q.sentenceId;
}

function getResultId(r: QuizResult): string {
  return 'wordId' in r ? r.wordId : r.sentenceId;
}
