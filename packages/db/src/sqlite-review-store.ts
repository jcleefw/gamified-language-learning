import { and, asc, eq, inArray, lte } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type BetterSqlite3 from 'better-sqlite3';
import type { ReviewCard } from '@gll/srs-review';
import type { ReviewStore } from './review-store.js';
import * as schema from './schema.js';

type DbClient = BetterSQLite3Database<typeof schema> & { $client: BetterSqlite3.Database };

function toReviewCard(row: typeof schema.review_cards.$inferSelect): ReviewCard {
  return {
    wordId: row.word_id,
    due: new Date(row.due),
    schedulerData: JSON.parse(row.scheduler_data),
  };
}

export class SqliteReviewStore implements ReviewStore {
  constructor(private readonly db: DbClient) {}

  upsertReviewCard(userId: string, card: ReviewCard): Promise<void> {
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
    return Promise.resolve();
  }

  getReviewCard(userId: string, wordId: string): Promise<ReviewCard | null> {
    const row = this.db
      .select()
      .from(schema.review_cards)
      .where(and(eq(schema.review_cards.user_id, userId), eq(schema.review_cards.word_id, wordId)))
      .get();

    return Promise.resolve(row ? toReviewCard(row) : null);
  }

  getDueReviewCards(userId: string, now: Date): Promise<ReviewCard[]> {
    const rows = this.db
      .select()
      .from(schema.review_cards)
      .where(and(eq(schema.review_cards.user_id, userId), lte(schema.review_cards.due, now.toISOString())))
      .orderBy(asc(schema.review_cards.due))
      .all();

    return Promise.resolve(rows.map(toReviewCard));
  }

  getDueReviewCardsForDeck(userId: string, deckId: string, now: Date): Promise<ReviewCard[]> {
    const deckWordRows = this.db
      .select({ word_id: schema.deck_words.word_id })
      .from(schema.deck_words)
      .where(eq(schema.deck_words.deck_id, deckId))
      .all();

    const wordIds = deckWordRows.map((row) => row.word_id);
    if (wordIds.length === 0) return Promise.resolve([]);

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

    return Promise.resolve(rows.map(toReviewCard));
  }

  getAllReviewCards(userId: string): Promise<ReviewCard[]> {
    const rows = this.db
      .select()
      .from(schema.review_cards)
      .where(eq(schema.review_cards.user_id, userId))
      .all();

    return Promise.resolve(rows.map(toReviewCard));
  }
}
