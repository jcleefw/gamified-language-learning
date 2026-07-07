import type { ReviewCard } from '@gll/srs-review';

export interface ReviewStore {
  /** Insert or replace a user's review card for a word. */
  upsertReviewCard(userId: string, card: ReviewCard): Promise<void>;

  /** The user's card for one word, or null if the word hasn't graduated. */
  getReviewCard(userId: string, wordId: string): Promise<ReviewCard | null>;

  /** All the user's cards with due <= now, ordered by due ascending (most overdue first). */
  getDueReviewCards(userId: string, now: Date): Promise<ReviewCard[]>;

  /** As getDueReviewCards, restricted to words belonging to deckId (JOIN deck_words). */
  getDueReviewCardsForDeck(userId: string, deckId: string, now: Date): Promise<ReviewCard[]>;

  /** All the user's review cards (any due date). */
  getAllReviewCards(userId: string): Promise<ReviewCard[]>;
}
