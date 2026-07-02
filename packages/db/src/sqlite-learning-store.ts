import { and, eq, gte, inArray } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type BetterSqlite3 from 'better-sqlite3';
import type { WordState, RunState, SentenceState, SentenceRunState } from '@gll/srs-engine-v2';
import type { ShelvedWord } from '@gll/srs-shelving';
import type { LearningStore } from './learning-store.js';
import * as schema from './schema.js';

type DbClient = BetterSQLite3Database<typeof schema> & { $client: BetterSqlite3.Database };

export class SqliteLearningStore implements LearningStore {
  constructor(private readonly db: DbClient) {}

  getAllWordStates(userId: string): RunState {
    const rows = this.db
      .select()
      .from(schema.user_word_states)
      .where(eq(schema.user_word_states.user_id, userId))
      .all();

    return new Map(
      rows.map((row) => [
        row.word_id,
        {
          wordId: row.word_id,
          seen: row.seen,
          correct: row.correct,
          mastery: row.mastery,
          correctStreak: row.correct_streak,
          wrongStreak: row.wrong_streak,
          lapses: row.lapses,
        } satisfies WordState,
      ]),
    );
  }

  upsertWordState(userId: string, state: WordState): void {
    this.db
      .insert(schema.user_word_states)
      .values({
        user_id: userId,
        word_id: state.wordId,
        seen: state.seen,
        correct: state.correct,
        mastery: state.mastery,
        correct_streak: state.correctStreak,
        wrong_streak: state.wrongStreak,
        lapses: state.lapses,
      })
      .onConflictDoUpdate({
        target: [schema.user_word_states.user_id, schema.user_word_states.word_id],
        set: {
          seen: state.seen,
          correct: state.correct,
          mastery: state.mastery,
          correct_streak: state.correctStreak,
          wrong_streak: state.wrongStreak,
          lapses: state.lapses,
        },
      })
      .run();
  }

  getAllSentenceStates(userId: string): SentenceRunState {
    const rows = this.db
      .select()
      .from(schema.user_sentence_states)
      .where(eq(schema.user_sentence_states.user_id, userId))
      .all();

    return new Map(
      rows.map((row) => [
        row.sentence_id,
        {
          sentenceId: row.sentence_id,
          sentenceStreak: row.sentence_streak,
          lastBatchSeen: row.last_batch_seen,
          dailyCount: row.daily_count,
          sessionWrongStreak: row.session_wrong_streak,
          active: row.active === 1,
        } satisfies SentenceState,
      ]),
    );
  }

  upsertSentenceState(userId: string, state: SentenceState): void {
    this.db
      .insert(schema.user_sentence_states)
      .values({
        user_id: userId,
        sentence_id: state.sentenceId,
        sentence_streak: state.sentenceStreak,
        last_batch_seen: state.lastBatchSeen,
        daily_count: state.dailyCount,
        session_wrong_streak: state.sessionWrongStreak,
        active: state.active ? 1 : 0,
      })
      .onConflictDoUpdate({
        target: [schema.user_sentence_states.user_id, schema.user_sentence_states.sentence_id],
        set: {
          sentence_streak: state.sentenceStreak,
          last_batch_seen: state.lastBatchSeen,
          daily_count: state.dailyCount,
          session_wrong_streak: state.sessionWrongStreak,
          active: state.active ? 1 : 0,
        },
      })
      .run();
  }

  clearUserState(userId: string): void {
    this.db.delete(schema.user_word_states).where(eq(schema.user_word_states.user_id, userId)).run();
    this.db.delete(schema.user_sentence_states).where(eq(schema.user_sentence_states.user_id, userId)).run();
    this.db.delete(schema.user_shelved_words).where(eq(schema.user_shelved_words.user_id, userId)).run();
    this.db.delete(schema.user_deck_word_tracking).where(eq(schema.user_deck_word_tracking.user_id, userId)).run();
  }

  // ---------------------------------------------------------------------------
  // Stagnation tracking
  // ---------------------------------------------------------------------------

  updateStagnationCounters(userId: string, deckId: string, activeWordIds: string[]): void {
    if (activeWordIds.length === 0) return;

    // Fetch current mastery for all active words
    const masteryRows = this.db
      .select({ word_id: schema.user_word_states.word_id, mastery: schema.user_word_states.mastery })
      .from(schema.user_word_states)
      .where(
        and(
          eq(schema.user_word_states.user_id, userId),
          inArray(schema.user_word_states.word_id, activeWordIds),
        ),
      )
      .all();

    const masteryByWordId = new Map(masteryRows.map((row) => [row.word_id, row.mastery]));

    // Fetch existing tracking rows
    const trackingRows = this.db
      .select()
      .from(schema.user_deck_word_tracking)
      .where(
        and(
          eq(schema.user_deck_word_tracking.user_id, userId),
          eq(schema.user_deck_word_tracking.deck_id, deckId),
          inArray(schema.user_deck_word_tracking.word_id, activeWordIds),
        ),
      )
      .all();

    const trackingByWordId = new Map(trackingRows.map((row) => [row.word_id, row]));

    for (const wordId of activeWordIds) {
      const currentMastery = masteryByWordId.get(wordId) ?? 0;
      const existing = trackingByWordId.get(wordId);

      if (!existing) {
        // First time seen — create row, counter starts at 1 (this boundary counts)
        this.db
          .insert(schema.user_deck_word_tracking)
          .values({
            user_id: userId,
            deck_id: deckId,
            word_id: wordId,
            stagnation_count: 1,
            last_boundary_mastery: currentMastery,
          })
          .run();
      } else if (currentMastery === existing.last_boundary_mastery) {
        // Mastery unchanged — increment counter
        this.db
          .insert(schema.user_deck_word_tracking)
          .values({
            user_id: userId,
            deck_id: deckId,
            word_id: wordId,
            stagnation_count: existing.stagnation_count + 1,
            last_boundary_mastery: existing.last_boundary_mastery,
          })
          .onConflictDoUpdate({
            target: [
              schema.user_deck_word_tracking.user_id,
              schema.user_deck_word_tracking.deck_id,
              schema.user_deck_word_tracking.word_id,
            ],
            set: { stagnation_count: existing.stagnation_count + 1 },
          })
          .run();
      } else {
        // Mastery changed — reset counter, update baseline
        this.db
          .insert(schema.user_deck_word_tracking)
          .values({
            user_id: userId,
            deck_id: deckId,
            word_id: wordId,
            stagnation_count: 1,
            last_boundary_mastery: currentMastery,
          })
          .onConflictDoUpdate({
            target: [
              schema.user_deck_word_tracking.user_id,
              schema.user_deck_word_tracking.deck_id,
              schema.user_deck_word_tracking.word_id,
            ],
            set: { stagnation_count: 1, last_boundary_mastery: currentMastery },
          })
          .run();
      }
    }
  }

  getStagnantWords(userId: string, deckId: string, threshold: number): string[] {
    const rows = this.db
      .select({ word_id: schema.user_deck_word_tracking.word_id })
      .from(schema.user_deck_word_tracking)
      .where(
        and(
          eq(schema.user_deck_word_tracking.user_id, userId),
          eq(schema.user_deck_word_tracking.deck_id, deckId),
          gte(schema.user_deck_word_tracking.stagnation_count, threshold),
        ),
      )
      .all();

    return rows.map((row) => row.word_id);
  }

  resetStagnationCounters(userId: string, deckId: string): void {
    this.db
      .delete(schema.user_deck_word_tracking)
      .where(
        and(
          eq(schema.user_deck_word_tracking.user_id, userId),
          eq(schema.user_deck_word_tracking.deck_id, deckId),
        ),
      )
      .run();
  }

  resetStagnationCountersForWords(userId: string, deckId: string, wordIds: string[]): void {
    if (wordIds.length === 0) return;
    this.db
      .delete(schema.user_deck_word_tracking)
      .where(
        and(
          eq(schema.user_deck_word_tracking.user_id, userId),
          eq(schema.user_deck_word_tracking.deck_id, deckId),
          inArray(schema.user_deck_word_tracking.word_id, wordIds),
        ),
      )
      .run();
  }

  // ---------------------------------------------------------------------------
  // Shelving (deck-scoped)
  // ---------------------------------------------------------------------------

  getShelvedWords(userId: string, deckId: string): ShelvedWord[] {
    const rows = this.db
      .select()
      .from(schema.user_shelved_words)
      .where(
        and(
          eq(schema.user_shelved_words.user_id, userId),
          eq(schema.user_shelved_words.deck_id, deckId),
        ),
      )
      .all();

    return rows.map((row) => ({
      wordId: row.word_id,
      shelvedAtBatch: row.shelved_at_batch,
    }));
  }

  shelveWord(userId: string, deckId: string, wordId: string, batchNum: number): void {
    this.db
      .insert(schema.user_shelved_words)
      .values({
        user_id: userId,
        deck_id: deckId,
        word_id: wordId,
        shelved_at_batch: batchNum,
      })
      .onConflictDoUpdate({
        target: [
          schema.user_shelved_words.user_id,
          schema.user_shelved_words.deck_id,
          schema.user_shelved_words.word_id,
        ],
        set: { shelved_at_batch: batchNum },
      })
      .run();
  }

  unshelveWord(userId: string, deckId: string, wordId: string): void {
    this.db
      .delete(schema.user_shelved_words)
      .where(
        and(
          eq(schema.user_shelved_words.user_id, userId),
          eq(schema.user_shelved_words.deck_id, deckId),
          eq(schema.user_shelved_words.word_id, wordId),
        ),
      )
      .run();
  }

  unshelveAllWords(userId: string, deckId: string): void {
    this.db
      .delete(schema.user_shelved_words)
      .where(
        and(
          eq(schema.user_shelved_words.user_id, userId),
          eq(schema.user_shelved_words.deck_id, deckId),
        ),
      )
      .run();
  }

  close(): void {
    this.db.$client.close();
  }
}
