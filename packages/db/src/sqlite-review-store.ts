import { and, asc, eq, inArray, lte, sql } from 'drizzle-orm';
import type { ReviewCard } from '@gll/srs-review';
import type { IReviewStore } from './types/review-store.js';
import * as schema from './schema.js';
import type { DbClient } from './types/db-client.js';

function toReviewCard(
  row: typeof schema.review_cards.$inferSelect,
): ReviewCard {
  return {
    wordId: row.word_id,
    due: new Date(row.due),
    schedulerData: JSON.parse(row.scheduler_data),
  };
}

export class SqliteReviewStore implements IReviewStore {
  constructor(private readonly db: DbClient) {}

  async seedReviewCard(userId: string, card: ReviewCard): Promise<boolean> {
    const res = this.db
      .insert(schema.review_cards)
      .values({
        user_id: userId,
        word_id: card.wordId,
        due: card.due.toISOString(),
        scheduler_data: JSON.stringify(card.schedulerData),
      })
      .onConflictDoNothing({
        target: [schema.review_cards.user_id, schema.review_cards.word_id],
      })
      .run();

    return res.changes > 0;
  }

  async upsertReviewCard(userId: string, card: ReviewCard): Promise<void> {
    this.db
      .insert(schema.review_cards)
      .values({
        user_id: userId,
        word_id: card.wordId,
        due: card.due.toISOString(),
        scheduler_data: JSON.stringify(card.schedulerData),
      })
      .onConflictDoUpdate({
        target: [schema.review_cards.user_id, schema.review_cards.word_id],
        set: {
          due: card.due.toISOString(),
          scheduler_data: JSON.stringify(card.schedulerData),
        },
      })
      .run();
  }

  async getReviewCard(
    userId: string,
    wordId: string,
  ): Promise<ReviewCard | null> {
    const row = this.db
      .select()
      .from(schema.review_cards)
      .where(
        and(
          eq(schema.review_cards.user_id, userId),
          eq(schema.review_cards.word_id, wordId),
        ),
      )
      .get();

    return row ? toReviewCard(row) : null;
  }

  async getDueReviewCards(userId: string, now: Date): Promise<ReviewCard[]> {
    const rows = this.db
      .select()
      .from(schema.review_cards)
      .where(
        and(
          eq(schema.review_cards.user_id, userId),
          lte(schema.review_cards.due, now.toISOString()),
        ),
      )
      .orderBy(asc(schema.review_cards.due))
      .all();

    return rows.map(toReviewCard);
  }

  async getDueReviewCardsForDeck(
    userId: string,
    deckId: string,
    now: Date,
  ): Promise<ReviewCard[]> {
    const deckWordRows = this.db
      .select({ word_id: schema.deck_words.word_id })
      .from(schema.deck_words)
      .where(eq(schema.deck_words.deck_id, deckId))
      .all();

    const wordIds = deckWordRows.map((row) => row.word_id);
    if (wordIds.length === 0) return [];

    const rows = this.db
      .select()
      .from(schema.review_cards)
      .where(
        and(
          eq(schema.review_cards.user_id, userId),
          lte(schema.review_cards.due, now.toISOString()),
          inArray(schema.review_cards.word_id, wordIds),
        ),
      )
      .orderBy(asc(schema.review_cards.due))
      .all();

    return rows.map(toReviewCard);
  }

  async getAllReviewCards(userId: string): Promise<ReviewCard[]> {
    const rows = this.db
      .select()
      .from(schema.review_cards)
      .where(eq(schema.review_cards.user_id, userId))
      .all();

    return rows.map(toReviewCard);
  }

  async getLastPracticedAtByWord(userId: string): Promise<Map<string, string>> {
    const rows = this.db
      .select({
        word_id: schema.review_answer_events.word_id,
        last: sql<string>`MAX(${schema.review_answer_events.created_at})`,
      })
      .from(schema.review_answer_events)
      .where(eq(schema.review_answer_events.user_id, userId))
      .groupBy(schema.review_answer_events.word_id)
      .all();

    return new Map(rows.map((r) => [r.word_id, r.last]));
  }
}
