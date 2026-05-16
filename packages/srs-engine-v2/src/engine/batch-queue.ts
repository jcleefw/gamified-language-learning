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
 * Manages the serving and re-enqueueing of questions within a single batch.
 * Enforces per-batch and per-session retry limits and ensures replay consistency (D11).
 */
export class BatchQueueManager {
  private queue: QuizQuestion[];
  private results: QuizResult[] = [];
  /** Tracks retries used EXCLUSIVELY within this batch instance. */
  private currentBatchRetryCounts: Map<string, number> = new Map();
  /** Caches the first instance of a question served to ensure identical retries (D11). */
  private questionCache: Map<string, QuizQuestion> = new Map();
  /** Initial number of questions in the batch (for UI progress). */
  public readonly totalCount: number;

  constructor(
    initialQuestions: QuizQuestion[],
    private retryPerWordCap: number,
    private sessionRetryCounts: Map<string, number>,
    private retryPerSessionCap: number,
  ) {
    this.queue = [...initialQuestions];
    this.totalCount = initialQuestions.length;
  }

  /**
   * Returns true if there are no more questions to serve in this batch.
   */
  get isDone(): boolean {
    return this.queue.length === 0;
  }

  /**
   * Serves the next question from the queue.
   * Returns null if the queue is empty.
   */
  next(): QuizQuestion | null {
    const q = this.queue.shift() || null;
    if (q) {
      const id = this.getQuestionId(q);
      // D11: Cache the first time we see an ID to ensure replay consistency
      if (!this.questionCache.has(id)) {
        this.questionCache.set(id, q);
      }
      return this.questionCache.get(id)!;
    }
    return null;
  }

  /**
   * Submits a result for the last served question.
   * If incorrect, re-enqueues the item if it hasn't hit retry caps.
   */
  submitResult(result: QuizResult): void {
    this.results.push(result);

    if (!result.correct) {
      const id = this.getResultId(result);
      const batchRetries = this.currentBatchRetryCounts.get(id) || 0;
      const totalSessionRetries = this.sessionRetryCounts.get(id) || 0;

      // Check both the per-batch cap and the per-session cap
      const canRetryInBatch = batchRetries < this.retryPerWordCap;
      const canRetryInSession = totalSessionRetries < this.retryPerSessionCap;

      if (canRetryInBatch && canRetryInSession) {
        this.currentBatchRetryCounts.set(id, batchRetries + 1);
        const cached = this.questionCache.get(id);
        if (cached) {
          this.queue.push(cached);
        }
      }
    }
  }

  /**
   * Finalizes the batch, calculating the updated session-wide retry counts.
   */
  finish(): BatchOutput {
    const updatedSessionCounts = new Map(this.sessionRetryCounts);

    for (const [id, count] of this.currentBatchRetryCounts.entries()) {
      const previousTotal = updatedSessionCounts.get(id) || 0;
      updatedSessionCounts.set(id, previousTotal + count);
    }

    return {
      results: this.results,
      sessionRetryCounts: updatedSessionCounts,
    };
  }

  private getQuestionId(q: QuizQuestion): string {
    return q.kind === 'mcq' ? q.wordId : q.sentenceId;
  }

  private getResultId(r: QuizResult): string {
    return 'wordId' in r ? r.wordId : r.sentenceId;
  }
}
