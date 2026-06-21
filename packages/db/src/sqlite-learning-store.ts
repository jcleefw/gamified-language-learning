import { eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type BetterSqlite3 from 'better-sqlite3';
import type { WordState, RunState, SentenceState, SentenceRunState } from '@gll/srs-engine-v2';
import type { LearningStore } from './learning-store';
import * as schema from './schema';

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

  close(): void {
    this.db.$client.close();
  }
}
