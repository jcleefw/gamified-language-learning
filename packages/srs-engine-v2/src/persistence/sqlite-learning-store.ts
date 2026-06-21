import Database from 'better-sqlite3';
import { initDb } from './init-db.js';
import type { LearningStore } from './learning-store.js';
import type { WordState, RunState } from '../types/word-state.js';
import type { SentenceState, SentenceRunState } from '../types/sentence-state.js';

interface WordStateRow {
  user_id: string;
  word_id: string;
  seen: number;
  correct: number;
  mastery: number;
  correct_streak: number;
  wrong_streak: number;
}

interface SentenceStateRow {
  user_id: string;
  sentence_id: string;
  sentence_streak: number;
  last_batch_seen: number;
  daily_count: number;
  session_wrong_streak: number;
  active: number;
}

export class SqliteLearningStore implements LearningStore {
  private readonly db: Database.Database;
  private readonly stmts: {
    getAllWordStates: Database.Statement;
    upsertWordState: Database.Statement;
    getAllSentenceStates: Database.Statement;
    upsertSentenceState: Database.Statement;
  };

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    initDb(this.db);

    this.stmts = {
      getAllWordStates: this.db.prepare(
        'SELECT * FROM user_word_states WHERE user_id = ?',
      ),
      upsertWordState: this.db.prepare(`
        INSERT OR REPLACE INTO user_word_states
          (user_id, word_id, seen, correct, mastery, correct_streak, wrong_streak)
        VALUES
          (@userId, @wordId, @seen, @correct, @mastery, @correctStreak, @wrongStreak)
      `),
      getAllSentenceStates: this.db.prepare(
        'SELECT * FROM user_sentence_states WHERE user_id = ?',
      ),
      upsertSentenceState: this.db.prepare(`
        INSERT OR REPLACE INTO user_sentence_states
          (user_id, sentence_id, sentence_streak, last_batch_seen, daily_count, session_wrong_streak, active)
        VALUES
          (@userId, @sentenceId, @sentenceStreak, @lastBatchSeen, @dailyCount, @sessionWrongStreak, @active)
      `),
    };
  }

  getAllWordStates(userId: string): RunState {
    const rows = this.stmts.getAllWordStates.all(userId) as WordStateRow[];
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
        } satisfies WordState,
      ]),
    );
  }

  upsertWordState(userId: string, state: WordState): void {
    this.stmts.upsertWordState.run({
      userId,
      wordId: state.wordId,
      seen: state.seen,
      correct: state.correct,
      mastery: state.mastery,
      correctStreak: state.correctStreak,
      wrongStreak: state.wrongStreak,
    });
  }

  getAllSentenceStates(userId: string): SentenceRunState {
    const rows = this.stmts.getAllSentenceStates.all(userId) as SentenceStateRow[];
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
    this.stmts.upsertSentenceState.run({
      userId,
      sentenceId: state.sentenceId,
      sentenceStreak: state.sentenceStreak,
      lastBatchSeen: state.lastBatchSeen,
      dailyCount: state.dailyCount,
      sessionWrongStreak: state.sessionWrongStreak,
      active: state.active ? 1 : 0,
    });
  }

  close(): void {
    this.db.close();
  }
}
