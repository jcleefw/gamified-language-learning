import type { ReviewCard } from '@gll/srs-review';

/** One append to the Revision transition channel: the card state before and
 *  after a due answer's advance. Recording only — never feeds the schedule;
 *  the before/after pair is what makes a Revision session replayable to
 *  answer_events fidelity (EP40-ST05). */
export interface ReviewTransitionEventRecord {
  correlationId: string | null;
  userId: string;
  wordId: string;
  beforeCard: ReviewCard; // persisted card at answer time (pre-advance)
  afterCard: ReviewCard;  // card after the scheduler advance
  createdAt: string; // ISO-8601
}

/** Append-only log of Revision card-state transitions, kept alongside (not
 *  instead of) the review_cards table. Rows are written on the due branch only. */
export interface IReviewTransitionEventStore {
  /** Append one transition record. Throws on failure (caller decides fail-open). */
  appendReviewTransitionEvent(record: ReviewTransitionEventRecord): Promise<void>;
}
