import type { ReviewCard } from '@gll/srs-review';

/** Per-user FSRS review cards for words that have graduated out of Learning. */
export interface IReviewStore {
  /**
   * Graduation seed — insert a review card ONLY if the word has no card yet
   * (ignore-if-exists). Re-graduating an already-reviewed word must NOT reset its
   * FSRS progress, so this never overwrites an existing card. Graduation is one-way:
   * this is the single, idempotent door from Learning into Review.
   * Returns true if this call inserted the card, false if one already existed.
   */
  seedReviewCard(userId: string, card: ReviewCard): Promise<boolean>;

  /**
   * Advance/replace a user's review card after a review (overwrites due +
   * schedulerData). Use `seedReviewCard` for graduation — NOT this.
   */
  upsertReviewCard(userId: string, card: ReviewCard): Promise<void>;

  /** The user's card for one word, or null if the word hasn't graduated. */
  getReviewCard(userId: string, wordId: string): Promise<ReviewCard | null>;

  /**
   * All the user's cards with due <= now, ordered by due ascending (most overdue first).
   * Join-free and orphan-tolerant: a card whose word was deleted is still returned
   * (it can stay "due" forever; cleanup is a deferred, separate concern).
   */
  getDueReviewCards(userId: string, now: Date): Promise<ReviewCard[]>;

  /**
   * As getDueReviewCards, restricted to words belonging to deckId (JOIN deck_words).
   * A word absent from deck_words is skipped, never a crash.
   */
  getDueReviewCardsForDeck(userId: string, deckId: string, now: Date): Promise<ReviewCard[]>;

  /** All the user's review cards (any due date). */
  getAllReviewCards(userId: string): Promise<ReviewCard[]>;

  /**
   * Last-practised timestamp per word (MAX(created_at) over review_answer_events),
   * covering both scheduled and eager answers. Feeds the anytime-batch recency
   * re-rank; a word absent from the map has never been practised.
   */
  getLastPracticedAtByWord(userId: string): Promise<Map<string, string>>;
}
