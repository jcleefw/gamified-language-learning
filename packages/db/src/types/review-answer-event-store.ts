/** One append to the review-answer channel: the raw review answer plus the inferred rating.
 *  Recording only — never feeds the rating; seed data for the deferred response-time feature. */
export interface ReviewAnswerEventRecord {
  correlationId: string | null;
  userId: string;
  wordId: string;
  correct: boolean;
  latencyMs: number;
  questionType: string;
  rating: string | null; // null on the not-due (eager) branch — no FSRS rating
  createdAt: string; // ISO-8601
}

/** Append-only log of review answers, kept alongside (not instead of) the review_cards table. */
export interface IReviewAnswerEventStore {
  /** Append one review-answer record. Throws on failure (caller decides fail-open). */
  appendReviewAnswerEvent(record: ReviewAnswerEventRecord): Promise<void>;
}
